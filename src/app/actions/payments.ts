"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { assertUser } from "@/lib/auth/guards";
import { mockSignature, paymentProvider } from "@/lib/payments/provider";
import { recordAudit } from "@/lib/audit";
import { minor } from "@/lib/money";
import { stringifyJson } from "@/lib/db/json";

/**
 * Payment orchestration.
 *
 * The amount charged is always recomputed from the winner record on the
 * server. Nothing about the price is taken from the client, and a payment is
 * only ever marked PAID after the provider's signature has been verified.
 */

export type CheckoutSession = {
  ok: boolean;
  message?: string;
  paymentId?: string;
  orderId?: string;
  amount?: number;
  currency?: string;
  provider?: string;
  isMock?: boolean;
  checkout?: Record<string, unknown>;
  /** Only issued by the development gateway, to stand in for a real callback. */
  mockSignature?: string;
};

export async function createCheckout(auctionId: string): Promise<CheckoutSession> {
  const user = await assertUser();

  const winner = await prisma.winner.findUnique({
    where: { auctionId },
    select: {
      userId: true,
      totalDue: true,
      status: true,
      auction: { select: { id: true, currency: true, lotNumber: true, slug: true } },
    },
  });

  if (!winner || winner.userId !== user.id) {
    return { ok: false, message: "No settlement found for this lot." };
  }
  if (winner.status !== "PAYMENT_PENDING") {
    return { ok: false, message: "This lot has already been settled." };
  }

  const amount = minor(winner.totalDue);
  const currency = winner.auction.currency;
  const provider = paymentProvider();

  const order = await provider.createOrder({
    amount,
    currency,
    reference: `LOT-${winner.auction.lotNumber}`,
    customer: { id: user.id, name: user.name, email: user.email },
  });

  const payment = await prisma.payment.create({
    data: {
      auctionId,
      userId: user.id,
      amount,
      currency,
      provider: provider.name,
      providerOrderId: order.orderId,
      status: "PENDING",
      metadata: stringifyJson({ reference: `LOT-${winner.auction.lotNumber}` }),
    },
    select: { id: true },
  });

  return {
    ok: true,
    paymentId: payment.id,
    orderId: order.orderId,
    amount,
    currency,
    provider: provider.name,
    isMock: provider.isMock,
    checkout: order.checkout,
    // In development the "gateway" is us, so the signature the callback will be
    // checked against is handed to the page. A real gateway signs it instead.
    mockSignature: provider.isMock
      ? mockSignature(order.orderId, `mock_pay_${payment.id}`)
      : undefined,
  };
}

export type ConfirmResult = {
  ok: boolean;
  message: string;
  status?: string;
};

/**
 * Confirms a payment from the client callback.
 *
 * The signature is verified by the provider adapter before anything is
 * written; a forged or replayed callback fails here and the winner record
 * stays PAYMENT_PENDING.
 */
export async function confirmPayment(
  paymentId: string,
  payload: Record<string, string>,
): Promise<ConfirmResult> {
  const user = await assertUser();

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      userId: true,
      auctionId: true,
      amount: true,
      status: true,
      provider: true,
      providerOrderId: true,
    },
  });

  if (!payment || payment.userId !== user.id) {
    return { ok: false, message: "Payment not found." };
  }
  if (payment.status === "PAID") {
    return { ok: true, message: "This payment is already settled.", status: "PAID" };
  }

  const provider = paymentProvider();
  const verification = await provider.verifyCallback({
    ...payload,
    orderId: payment.providerOrderId ?? "",
  });

  if (!verification.ok || verification.status !== "PAID") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", metadata: stringifyJson(verification.raw) },
    });
    return {
      ok: false,
      message: "We could not verify that payment. No amount has been captured.",
      status: "FAILED",
    };
  }

  // Mark paid and advance the settlement together, so the two can never
  // disagree about whether the lot has been paid for.
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        providerPaymentId: verification.providerPaymentId,
        metadata: stringifyJson(verification.raw),
      },
    });

    await tx.winner.updateMany({
      where: { auctionId: payment.auctionId, status: "PAYMENT_PENDING" },
      data: { status: "PAYMENT_COMPLETED" },
    });
  });

  await recordAudit({
    actorId: user.id,
    action: "payment.status_change",
    entityType: "payment",
    entityId: payment.id,
    metadata: { to: "PAID", provider: payment.provider },
  });

  revalidatePath(`/payment/${payment.auctionId}`);
  revalidatePath("/profile");

  return { ok: true, message: "Payment received. Thank you.", status: "PAID" };
}
