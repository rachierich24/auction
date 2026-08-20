/**
 * Settlement pipeline vocabulary.
 *
 * Split out of the (server-only) settlements query module because the stage
 * control is a client component and needs the same labels.
 */

export const SETTLEMENT_STAGES = [
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "ORDER_PROCESSING",
  "COMPLETED",
  "CANCELLED",
] as const;

export type SettlementStage = (typeof SETTLEMENT_STAGES)[number];

export const STAGE_LABELS: Record<SettlementStage, string> = {
  PAYMENT_PENDING: "Payment pending",
  PAYMENT_COMPLETED: "Payment completed",
  ORDER_PROCESSING: "Order processing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
