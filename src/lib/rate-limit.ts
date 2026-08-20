import "server-only";

/**
 * Fixed-window rate limiter held in process memory.
 *
 * Adequate for a single instance and for defending the endpoints that matter
 * most (sign-in, registration, password reset, bidding). Behind multiple
 * instances, swap the Map for Redis/Upstash — `limit()` is the only surface
 * callers depend on.
 */

type Bucket = { count: number; resetAt: number };

const globalForLimiter = globalThis as unknown as {
  __rateBuckets?: Map<string, Bucket>;
};

const buckets = globalForLimiter.__rateBuckets ?? new Map<string, Bucket>();
globalForLimiter.__rateBuckets = buckets;

export type RateLimitRule = {
  /** Requests permitted per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export const RATE_LIMITS = {
  login: { max: 8, windowMs: 10 * 60 * 1000 },
  register: { max: 5, windowMs: 60 * 60 * 1000 },
  passwordReset: { max: 5, windowMs: 60 * 60 * 1000 },
  bid: { max: 30, windowMs: 60 * 1000 },
  upload: { max: 40, windowMs: 10 * 60 * 1000 },
  newsletter: { max: 5, windowMs: 60 * 60 * 1000 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function limit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    if (buckets.size > 10_000) sweep(now);
    return { ok: true, remaining: rule.max - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.max - existing.count);
  const ok = existing.count <= rule.max;

  return {
    ok,
    remaining,
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
}

/** Clears a bucket after a successful action, so honest users are not punished. */
export function reset(key: string): void {
  buckets.delete(key);
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Builds a bucket key from the request IP plus an optional identity. */
export function rateKey(
  scope: keyof typeof RATE_LIMITS,
  ip: string | null | undefined,
  identity?: string | null,
): string {
  return `${scope}:${ip ?? "unknown"}:${identity ?? "-"}`;
}
