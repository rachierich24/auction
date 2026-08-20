import type { AuctionStatus } from "@/lib/validation/enums";

/**
 * Auction lifecycle.
 *
 *   DRAFT ──publish──> UPCOMING ──start──> LIVE ──anti-snipe──> EXTENDED
 *                          │                 │                     │
 *                          │                 └────── close ────────┤
 *                          │                                       ▼
 *                          │                                     ENDED
 *                          │                                    ╱     ╲
 *                          │                          reserve met     not met
 *                          │                              ▼             ▼
 *                          │                            SOLD          UNSOLD
 *                          └──────────── cancel ───────────> CANCELLED
 *
 * Transitions not listed here are impossible through any code path, admin UI
 * included — `assertTransition` is called by every mutation that moves status.
 */
const ALLOWED: Record<AuctionStatus, readonly AuctionStatus[]> = {
  DRAFT: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["DRAFT", "LIVE", "CANCELLED"],
  LIVE: ["EXTENDED", "ENDED", "CANCELLED"],
  EXTENDED: ["LIVE", "ENDED", "CANCELLED"],
  ENDED: ["SOLD", "UNSOLD"],
  SOLD: [],
  UNSOLD: [],
  CANCELLED: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: AuctionStatus, to: AuctionStatus) {
    super(`An auction cannot move from ${from} to ${to}.`);
    this.name = "InvalidTransitionError";
  }
}

export function canTransition(
  from: AuctionStatus,
  to: AuctionStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertTransition(
  from: AuctionStatus,
  to: AuctionStatus,
): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

export function allowedTransitions(
  from: AuctionStatus,
): readonly AuctionStatus[] {
  return ALLOWED[from] ?? [];
}

type TimingInput = {
  status: string;
  startAt: Date;
  endAt: Date;
};

/**
 * The status a lot *should* be in given the server clock.
 *
 * Stored status is updated by the settlement sweeper, but a lot can sit for
 * seconds between its scheduled boundary and the next sweep. Read paths call
 * this so the public site is never a tick behind reality. It only ever moves a
 * lot forward in time — it never resurrects a terminal state.
 */
export function effectiveStatus(
  auction: TimingInput,
  now: Date = new Date(),
): AuctionStatus {
  const stored = auction.status as AuctionStatus;

  if (
    stored === "DRAFT" ||
    stored === "CANCELLED" ||
    stored === "SOLD" ||
    stored === "UNSOLD" ||
    stored === "ENDED"
  ) {
    return stored;
  }

  const t = now.getTime();
  if (t < auction.startAt.getTime()) return "UPCOMING";
  if (t >= auction.endAt.getTime()) return "ENDED";
  // Keep EXTENDED visible so bidders can see the anti-snipe fired.
  return stored === "EXTENDED" ? "EXTENDED" : "LIVE";
}

/** Live and inside the final hour — drives the "Ending Soon" rail and badge. */
export const ENDING_SOON_MS = 60 * 60 * 1000;

export function isEndingSoon(
  auction: TimingInput,
  now: Date = new Date(),
): boolean {
  const status = effectiveStatus(auction, now);
  if (status !== "LIVE" && status !== "EXTENDED") return false;
  return auction.endAt.getTime() - now.getTime() <= ENDING_SOON_MS;
}

export function isBiddable(
  auction: TimingInput,
  now: Date = new Date(),
): boolean {
  const status = effectiveStatus(auction, now);
  return status === "LIVE" || status === "EXTENDED";
}

// -- Presentation -----------------------------------------------------------

export type DisplayStatus = AuctionStatus | "ENDING_SOON";

export function displayStatus(
  auction: TimingInput,
  now: Date = new Date(),
): DisplayStatus {
  if (isEndingSoon(auction, now)) return "ENDING_SOON";
  return effectiveStatus(auction, now);
}

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  DRAFT: "Draft",
  UPCOMING: "Upcoming",
  LIVE: "Live",
  ENDING_SOON: "Ending Soon",
  EXTENDED: "Extended",
  ENDED: "Ended",
  SOLD: "Sold",
  UNSOLD: "Unsold",
  CANCELLED: "Cancelled",
};
