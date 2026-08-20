import { z } from "zod";

/**
 * Shared between the server actions and the forms, so the browser and the
 * server never disagree about what is valid. The server always re-validates —
 * client-side checks exist only to save the user a round trip.
 */

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Enter your email address.")
  .max(160, "That email address is too long.")
  .email("Enter a valid email address.");

export const passwordField = z
  .string()
  .min(10, "Use at least 10 characters.")
  .max(200, "That password is too long.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/\d/, "Include a number.");

export const nameField = z
  .string()
  .trim()
  .min(2, "Enter your full name.")
  .max(80, "That name is too long.");

export const phoneField = z
  .string()
  .trim()
  .max(24, "That phone number is too long.")
  .regex(/^[\d+\-()\s]*$/, "Enter a valid phone number.")
  .optional()
  .or(z.literal(""));

export const registerSchema = z.object({
  name: nameField,
  email: emailField,
  password: passwordField,
  phone: phoneField,
  // Honeypot: a real person never fills this in.
  company: z.string().max(0).optional().or(z.literal("")),
});

export const loginSchema = z.object({
  email: emailField,
  // Deliberately lax: an existing account may predate the current policy, and
  // the strength rules must not become a password oracle.
  password: z.string().min(1, "Enter your password.").max(200),
  next: z.string().max(300).optional(),
});

export const forgotPasswordSchema = z.object({ email: emailField });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export const profileSchema = z.object({
  name: nameField,
  phone: phoneField,
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Only ever redirect to a path on this site. Without this, `?next=` is an open
 * redirect that can be used to bounce a freshly authenticated user anywhere.
 */
export function safeRedirect(next: string | undefined | null): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes("\\")) return "/";
  return next;
}
