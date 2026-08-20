import "server-only";

import { headers } from "next/headers";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

/**
 * Origin check for state-changing requests.
 *
 * Server Actions carry Next.js's own origin protection; this covers the plain
 * route handlers (uploads, bid API, auth endpoints) that accept POSTs.
 */
export async function assertSameOrigin(): Promise<void> {
  const h = await headers();
  const origin = h.get("origin");
  // Same-origin form posts and server-to-server calls may omit Origin entirely.
  if (!origin) return;

  const host = h.get("host");
  const allowed = new Set<string>();
  if (host) allowed.add(host);

  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).host);
    } catch {
      /* ignore a malformed env value */
    }
  }

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Request rejected: malformed origin.");
  }

  if (!allowed.has(originHost)) {
    throw new Error("Request rejected: cross-origin request.");
  }
}
