import "server-only";

import { headers } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { stringifyJson } from "@/lib/db/json";
import type { Tx } from "@/lib/db/prisma";

export type AuditAction =
  | "auction.create"
  | "auction.update"
  | "auction.delete"
  | "auction.duplicate"
  | "auction.publish"
  | "auction.unpublish"
  | "auction.start"
  | "auction.end"
  | "auction.cancel"
  | "auction.settle"
  | "bid.retract"
  | "user.suspend"
  | "user.reactivate"
  | "user.role_change"
  | "category.create"
  | "category.update"
  | "category.delete"
  | "content.update"
  | "winner.status_change"
  | "payment.status_change"
  | "media.upload"
  | "media.delete";

type RecordAuditInput = {
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  /** Pass a transaction client to make the log atomic with the change. */
  tx?: Tx;
  ip?: string | null;
};

/**
 * Append-only operational history. Every privileged mutation writes one; the
 * app never updates or deletes rows here.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const client = input.tx ?? prisma;

  let ip = input.ip ?? null;
  if (ip === null && !input.tx) {
    ip = await headers()
      .then((h) => h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null)
      .catch(() => null);
  }

  await client.auditLog
    .create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: stringifyJson(input.metadata ?? {}),
        ip,
      },
    })
    // Auditing must never be the reason a legitimate admin action fails.
    .catch((error) => {
      console.error("[audit] failed to record", input.action, error);
    });
}

/** Shallow before/after diff, so audit metadata stays small and readable. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, next] of Object.entries(after)) {
    const prev = before[key];
    const normalise = (v: unknown) =>
      v instanceof Date ? v.toISOString() : v;
    if (normalise(prev) !== normalise(next)) {
      changes[key] = { from: normalise(prev), to: normalise(next) };
    }
  }
  return changes;
}
