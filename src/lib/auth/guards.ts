import "server-only";

import { redirect } from "next/navigation";

import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/rbac";

export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export class AuthenticationError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Server components: redirect to sign-in, preserving the intended destination. */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const next = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

export async function requirePermission(
  permission: Permission,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!can(user.role, permission)) redirect("/admin/no-access");
  return user;
}

/** Server actions / route handlers: throw instead of redirecting. */
export async function assertUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthenticationError();
  return user;
}

export async function assertPermission(
  permission: Permission,
): Promise<SessionUser> {
  const user = await assertUser();
  if (!can(user.role, permission)) throw new AuthorizationError();
  return user;
}
