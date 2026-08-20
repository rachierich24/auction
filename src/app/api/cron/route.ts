import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

import { runScheduledTasks } from "@/lib/auction/settlement";
import { pruneExpiredSessions } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Scheduled maintenance: open lots that are due to start, close lots whose
 * time is up (determining winners and reserves), warn watchers about imminent
 * closes, and drop expired sessions.
 *
 * Point a scheduler at this every minute. On Vercel, add to vercel.json:
 *
 *   { "crons": [{ "path": "/api/cron", "schedule": "* * * * *" }] }
 *
 * Settlement is also triggered opportunistically on read, so a missed tick
 * delays the bookkeeping but never shows a bidder a stale lot.
 */
export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const started = Date.now();

  try {
    const result = await runScheduledTasks(new Date());
    const prunedSessions = await pruneExpiredSessions();

    return NextResponse.json({
      ok: true,
      ...result,
      prunedSessions,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    console.error("[cron] scheduled tasks failed", error);
    return NextResponse.json(
      { ok: false, error: "Scheduled tasks failed. See server logs." },
      { status: 500 },
    );
  }
}

export const POST = GET;

function authorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;

  // Without a configured secret the endpoint is only reachable in development,
  // so a misconfigured deployment cannot silently expose it.
  if (!secret) return process.env.NODE_ENV !== "production";

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ")
    ? header.slice(7)
    : (request.nextUrl.searchParams.get("secret") ?? "");

  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
