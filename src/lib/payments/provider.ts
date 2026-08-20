import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Payment provider abstraction.
 *
 * Nothing outside this folder knows which gateway is in use. Adding Razorpay or
 * Cashfree for real means filling in the adapter below and setting
 * PAYMENT_PROVIDER — no call sites change.
 */

export type PaymentOrder = {
  /** Provider-side order/intent identifier. */
  orderId: string;
  /** Minor units. */
  amount: number;
  currency: string;
  /** Everything the client checkout widget needs, provider-shaped. */
  checkout: Record<string, unknown>;
};

export type PaymentVerification = {
  ok: boolean;
  providerPaymentId: string | null;
  status: "PAID" | "FAILED" | "PENDING";
  raw: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  /** True when the gateway settles instantly without a real redirect. */
  readonly isMock: boolean;

  createOrder(input: {
    amount: number;
    currency: string;
    reference: string;
    customer: { id: string; name: string; email: string };
  }): Promise<PaymentOrder>;

  /** Verifies a client callback (signature check, never a trusted status field). */
  verifyCallback(payload: Record<string, string>): Promise<PaymentVerification>;

  /** Verifies a server-to-server webhook body against its signature header. */
  verifyWebhook(
    rawBody: string,
    signature: string | null,
  ): Promise<PaymentVerification>;
}

// -- Mock -------------------------------------------------------------------

/**
 * Development provider. It still goes through order creation, signature
 * generation and verification so the production flow is exercised end to end.
 */
const mockProvider: PaymentProvider = {
  name: "mock",
  isMock: true,

  async createOrder({ amount, currency, reference, customer }) {
    const orderId = `mock_order_${randomBytes(8).toString("hex")}`;
    return {
      orderId,
      amount,
      currency,
      checkout: {
        provider: "mock",
        orderId,
        reference,
        customerName: customer.name,
        note: "Development gateway — no card details are collected.",
      },
    };
  },

  async verifyCallback(payload) {
    const orderId = payload.orderId ?? "";
    const paymentId = payload.paymentId ?? `mock_pay_${randomBytes(8).toString("hex")}`;
    const expected = mockSignature(orderId, paymentId);

    if (!safeEqual(payload.signature ?? "", expected)) {
      return { ok: false, providerPaymentId: null, status: "FAILED", raw: payload };
    }
    return {
      ok: true,
      providerPaymentId: paymentId,
      status: "PAID",
      raw: payload,
    };
  },

  async verifyWebhook(rawBody, signature) {
    const expected = createHmac("sha256", secret()).update(rawBody).digest("hex");
    if (!safeEqual(signature ?? "", expected)) {
      return { ok: false, providerPaymentId: null, status: "FAILED", raw: {} };
    }
    const parsed = JSON.parse(rawBody) as Record<string, unknown>;
    return {
      ok: true,
      providerPaymentId: String(parsed.paymentId ?? ""),
      status: "PAID",
      raw: parsed,
    };
  },
};

export function mockSignature(orderId: string, paymentId: string): string {
  return createHmac("sha256", secret())
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
}

// -- Razorpay ---------------------------------------------------------------

const razorpayProvider: PaymentProvider = {
  name: "razorpay",
  isMock: false,

  async createOrder({ amount, currency, reference }) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set.");
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      // Razorpay already speaks minor units, which is what we store.
      body: JSON.stringify({ amount, currency, receipt: reference }),
    });

    if (!response.ok) {
      throw new Error(`Razorpay order failed (${response.status}).`);
    }

    const order = (await response.json()) as { id: string };
    return {
      orderId: order.id,
      amount,
      currency,
      checkout: { provider: "razorpay", key: keyId, orderId: order.id, amount, currency },
    };
  },

  async verifyCallback(payload) {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) throw new Error("RAZORPAY_KEY_SECRET must be set.");

    const expected = createHmac("sha256", keySecret)
      .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
      .digest("hex");

    const ok = safeEqual(payload.razorpay_signature ?? "", expected);
    return {
      ok,
      providerPaymentId: ok ? (payload.razorpay_payment_id ?? null) : null,
      status: ok ? "PAID" : "FAILED",
      raw: payload,
    };
  },

  async verifyWebhook(rawBody, signature) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET must be set.");

    const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    if (!safeEqual(signature ?? "", expected)) {
      return { ok: false, providerPaymentId: null, status: "FAILED", raw: {} };
    }

    const parsed = JSON.parse(rawBody) as {
      event: string;
      payload?: { payment?: { entity?: { id?: string } } };
    };
    const paid = parsed.event === "payment.captured";
    return {
      ok: true,
      providerPaymentId: parsed.payload?.payment?.entity?.id ?? null,
      status: paid ? "PAID" : "PENDING",
      raw: parsed as Record<string, unknown>,
    };
  },
};

// -- Cashfree ---------------------------------------------------------------

const cashfreeProvider: PaymentProvider = {
  name: "cashfree",
  isMock: false,
  async createOrder() {
    throw new Error(
      "Cashfree adapter not implemented. Mirror the Razorpay adapter in src/lib/payments/provider.ts.",
    );
  },
  async verifyCallback() {
    throw new Error("Cashfree adapter not implemented.");
  },
  async verifyWebhook() {
    throw new Error("Cashfree adapter not implemented.");
  },
};

// -- Selection --------------------------------------------------------------

export function paymentProvider(): PaymentProvider {
  switch (process.env.PAYMENT_PROVIDER) {
    case "razorpay":
      return razorpayProvider;
    case "cashfree":
      return cashfreeProvider;
    default:
      return mockProvider;
  }
}

function secret(): string {
  return process.env.AUTH_SECRET ?? "insecure-development-secret";
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
