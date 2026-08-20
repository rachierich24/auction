"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getSessionUser,
} from "@/lib/auth/session";
import { assertUser } from "@/lib/auth/guards";
import {
  fakeVerifyDelay,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import { consumeToken, issueToken } from "@/lib/auth/tokens";
import {
  passwordResetMessage,
  sendEmail,
  verifyEmailMessage,
} from "@/lib/email/mailer";
import { limit, rateKey, RATE_LIMITS, reset } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  profileSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirect,
} from "@/lib/validation/auth";

export type FormState = {
  ok: boolean;
  message?: string;
  /** Field-level messages keyed by input name. */
  errors?: Record<string, string>;
};

const OK: FormState = { ok: true };

function fieldErrors(error: import("zod").ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/* -------------------------------------------------------------------------- */
/* Register                                                                    */
/* -------------------------------------------------------------------------- */

export async function registerAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") ?? "",
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  // Honeypot tripped — accept silently so a bot learns nothing.
  if (parsed.data.company) return OK;

  const ip = await clientIp();
  const gate = limit(rateKey("register", ip), RATE_LIMITS.register);
  if (!gate.ok) {
    return {
      ok: false,
      message: "Too many accounts created from this connection. Try again later.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });

  if (existing) {
    // Deliberately vague: confirming which addresses are registered would leak
    // the bidder list to anyone with an email address.
    return {
      ok: false,
      errors: {
        email: "That email address cannot be used. Try signing in instead.",
      },
    };
  }

  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      passwordHash: await hashPassword(parsed.data.password),
      role: "BIDDER",
      status: "ACTIVE",
    },
    select: { id: true, name: true, email: true },
  });

  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const message = verifyEmailMessage(user.name, token);
  void sendEmail({ ...message, to: user.email }).catch((error) =>
    console.error("[auth] verification email failed", error),
  );

  await createSession(user.id);
  redirect("/profile?welcome=1");
}

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const key = rateKey("login", ip, parsed.data.email);
  const gate = limit(key, RATE_LIMITS.login);
  if (!gate.ok) {
    return {
      ok: false,
      message: `Too many attempts. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, passwordHash: true, status: true },
  });

  if (!user) {
    // Spend comparable time so timing cannot distinguish "no such account"
    // from "wrong password".
    await fakeVerifyDelay();
    return { ok: false, message: "Those details do not match an account." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { ok: false, message: "Those details do not match an account." };
  }

  if (user.status !== "ACTIVE") {
    return {
      ok: false,
      message: "This account is suspended. Contact the saleroom for assistance.",
    };
  }

  reset(key);
  await createSession(user.id);
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect(safeRedirect(parsed.data.next));
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                    */
/* -------------------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

export async function forgotPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const ip = await clientIp();
  const gate = limit(rateKey("passwordReset", ip), RATE_LIMITS.passwordReset);

  // The response is identical whether or not the address is registered, and
  // whether or not the rate limit was hit — this endpoint must not be usable
  // to enumerate accounts.
  const genericResponse: FormState = {
    ok: true,
    message:
      "If that address has an account, a reset link is on its way. Check your inbox.",
  };

  if (!gate.ok) return genericResponse;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, name: true, email: true, status: true },
  });

  if (user && user.status === "ACTIVE") {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    const message = passwordResetMessage(user.name, token);
    void sendEmail({ ...message, to: user.email }).catch((error) =>
      console.error("[auth] reset email failed", error),
    );
  }

  return genericResponse;
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const claim = await consumeToken(parsed.data.token, "PASSWORD_RESET");
  if (!claim) {
    return {
      ok: false,
      message: "That reset link is invalid or has expired. Request a new one.",
    };
  }

  await prisma.user.update({
    where: { id: claim.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Anyone holding a stolen session for this account loses it now.
  await destroyAllSessions(claim.userId);
  await createSession(claim.userId);

  redirect("/profile?reset=1");
}

/* -------------------------------------------------------------------------- */
/* Email verification                                                          */
/* -------------------------------------------------------------------------- */

export async function verifyEmailAction(
  token: string,
): Promise<{ ok: boolean; message: string }> {
  const claim = await consumeToken(token, "EMAIL_VERIFY");
  if (!claim) {
    return {
      ok: false,
      message: "That confirmation link is invalid or has expired.",
    };
  }

  await prisma.user.update({
    where: { id: claim.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return { ok: true, message: "Your email address is confirmed." };
}

export async function resendVerificationAction(): Promise<FormState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (user.emailVerified) return { ok: true, message: "Already confirmed." };

  const ip = await clientIp();
  const gate = limit(rateKey("passwordReset", ip, user.id), RATE_LIMITS.passwordReset);
  if (!gate.ok) {
    return { ok: false, message: "Please wait before requesting another email." };
  }

  const token = await issueToken(user.id, "EMAIL_VERIFY");
  const message = verifyEmailMessage(user.name, token);
  void sendEmail({ ...message, to: user.email }).catch(() => undefined);

  return { ok: true, message: "Confirmation email sent." };
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await assertUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null },
  });

  return { ok: true, message: "Your details have been updated." };
}

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await assertUser();

  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, message: "Account not found." };

  const valid = await verifyPassword(parsed.data.current, user.passwordHash);
  if (!valid) {
    return { ok: false, errors: { current: "That is not your current password." } };
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });

  // Every other device is signed out; this one stays.
  await destroyAllSessions(session.id);
  await createSession(session.id);

  return { ok: true, message: "Password changed. Other devices were signed out." };
}
