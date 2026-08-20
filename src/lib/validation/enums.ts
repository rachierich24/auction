import { z } from "zod";

/**
 * The database stores these as plain strings for SQLite/Postgres portability.
 * These schemas are the single source of truth and are applied at every
 * boundary that reads or writes one.
 */

export const UserRole = z.enum([
  "BIDDER",
  "CONTENT_MANAGER",
  "AUCTION_MANAGER",
  "SUPER_ADMIN",
]);
export type UserRole = z.infer<typeof UserRole>;

export const UserStatus = z.enum(["ACTIVE", "SUSPENDED"]);
export type UserStatus = z.infer<typeof UserStatus>;

export const AuctionStatus = z.enum([
  "DRAFT",
  "UPCOMING",
  "LIVE",
  "EXTENDED",
  "ENDED",
  "SOLD",
  "UNSOLD",
  "CANCELLED",
]);
export type AuctionStatus = z.infer<typeof AuctionStatus>;

export const BidStatus = z.enum([
  "WINNING",
  "OUTBID",
  "WON",
  "LOST",
  "RETRACTED",
]);
export type BidStatus = z.infer<typeof BidStatus>;

export const WinnerStatus = z.enum([
  "PAYMENT_PENDING",
  "PAYMENT_COMPLETED",
  "ORDER_PROCESSING",
  "COMPLETED",
  "CANCELLED",
]);
export type WinnerStatus = z.infer<typeof WinnerStatus>;

export const PaymentStatus = z.enum([
  "CREATED",
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const NotificationType = z.enum([
  "BID_PLACED",
  "OUTBID",
  "ENDING_SOON",
  "AUCTION_WON",
  "AUCTION_LOST",
  "PAYMENT_REMINDER",
  "AUCTION_STARTING",
  "SYSTEM",
]);
export type NotificationType = z.infer<typeof NotificationType>;

export const CategoryStatus = z.enum(["ACTIVE", "HIDDEN"]);
export type CategoryStatus = z.infer<typeof CategoryStatus>;

export const VerificationTokenType = z.enum([
  "EMAIL_VERIFY",
  "PASSWORD_RESET",
]);
export type VerificationTokenType = z.infer<typeof VerificationTokenType>;

/** Statuses a lot can be in while it is publicly browsable. */
export const PUBLIC_AUCTION_STATUSES: AuctionStatus[] = [
  "UPCOMING",
  "LIVE",
  "EXTENDED",
  "ENDED",
  "SOLD",
  "UNSOLD",
];

/** Statuses in which the lot is accepting bids. */
export const BIDDABLE_STATUSES: AuctionStatus[] = ["LIVE", "EXTENDED"];

/** Statuses after which no further bidding or scheduling changes are allowed. */
export const TERMINAL_STATUSES: AuctionStatus[] = [
  "ENDED",
  "SOLD",
  "UNSOLD",
  "CANCELLED",
];

export function isAdminRole(role: string): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "AUCTION_MANAGER" ||
    role === "CONTENT_MANAGER"
  );
}
