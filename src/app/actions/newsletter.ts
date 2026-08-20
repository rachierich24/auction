"use server";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { clientIp } from "@/lib/request";
import { limit, rateKey, RATE_LIMITS } from "@/lib/rate-limit";

const emailSchema = z.string().trim().toLowerCase().email().max(160);

export async function subscribeToNewsletter(
  rawEmail: string,
): Promise<{ ok: boolean; message: string }> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const ip = await clientIp();
  const gate = limit(rateKey("newsletter", ip), RATE_LIMITS.newsletter);
  if (!gate.ok) {
    return { ok: false, message: "Too many attempts. Try again shortly." };
  }

  // Upsert so re-subscribing is idempotent and the response never reveals
  // whether an address was already on the list.
  await prisma.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    create: { email: parsed.data },
    update: {},
  });

  return { ok: true, message: "You're on the list. Catalogue previews will follow." };
}
