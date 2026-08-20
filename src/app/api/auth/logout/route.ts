import { NextResponse } from "next/server";

import { destroySession } from "@/lib/auth/session";
import { assertSameOrigin } from "@/lib/request";

export const runtime = "nodejs";

/**
 * Progressive-enhancement sign-out for the plain form in the mobile menu.
 * POST-only and origin-checked so a stray link or a cross-site form cannot
 * sign someone out.
 */
export async function POST(request: Request) {
  await assertSameOrigin();
  await destroySession();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
