import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import type { VerificationTokenType } from "@/lib/validation/enums";

const TTL: Record<VerificationTokenType, number> = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
};

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Returns the raw token — email it, never store it. */
export async function issueToken(
  userId: string,
  type: VerificationTokenType,
): Promise<string> {
  // One live token per purpose: issuing a new reset link kills the old one.
  await prisma.verificationToken.deleteMany({ where: { userId, type } });

  const token = randomBytes(32).toString("base64url");
  await prisma.verificationToken.create({
    data: {
      userId,
      type,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + TTL[type]),
    },
  });
  return token;
}

/**
 * Single-use consumption: marks the token used inside the same transaction
 * that reads it, so a replayed link cannot succeed twice.
 */
export async function consumeToken(
  token: string,
  type: VerificationTokenType,
): Promise<{ userId: string } | null> {
  const tokenHash = hash(token);

  return prisma.$transaction(async (tx) => {
    const record = await tx.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!record) return null;
    if (record.type !== type) return null;
    if (record.usedAt) return null;
    if (record.expiresAt.getTime() < Date.now()) return null;

    const claimed = await tx.verificationToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    return { userId: record.userId };
  });
}
