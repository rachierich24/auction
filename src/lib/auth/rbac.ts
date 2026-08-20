import type { UserRole } from "@/lib/validation/enums";

/**
 * Capability-based access control. Routes and server actions ask for a
 * capability, never for a role directly, so adding a role is a one-line change
 * to this table rather than a grep across the codebase.
 */
export const PERMISSIONS = [
  "admin.access",
  "auction.view",
  "auction.create",
  "auction.update",
  "auction.delete",
  "auction.publish",
  "auction.lifecycle", // start / end / cancel / extend
  "bid.view",
  "bid.moderate",
  "user.view",
  "user.manage",
  "category.manage",
  "content.manage",
  "analytics.view",
  "audit.view",
  "settlement.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  BIDDER: [],

  CONTENT_MANAGER: [
    "admin.access",
    "auction.view",
    "category.manage",
    "content.manage",
    "analytics.view",
  ],

  AUCTION_MANAGER: [
    "admin.access",
    "auction.view",
    "auction.create",
    "auction.update",
    "auction.delete",
    "auction.publish",
    "auction.lifecycle",
    "bid.view",
    "bid.moderate",
    "user.view",
    "user.manage",
    "category.manage",
    "analytics.view",
    "settlement.manage",
  ],

  SUPER_ADMIN: [...PERMISSIONS],
};

export function can(role: UserRole | string, permission: Permission): boolean {
  const list = ROLE_PERMISSIONS[role as UserRole];
  return Boolean(list?.includes(permission));
}

export function permissionsFor(role: UserRole | string): readonly Permission[] {
  return ROLE_PERMISSIONS[role as UserRole] ?? [];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  BIDDER: "Bidder",
  CONTENT_MANAGER: "Content Manager",
  AUCTION_MANAGER: "Auction Manager",
  SUPER_ADMIN: "Super Admin",
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  BIDDER: "Standard registered bidder. No administrative access.",
  CONTENT_MANAGER: "Homepage, categories and marketing content.",
  AUCTION_MANAGER: "Full auction, bid and bidder operations.",
  SUPER_ADMIN: "Unrestricted access including roles and audit history.",
};
