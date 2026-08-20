import "server-only";

import { Prisma } from "@prisma/client";

import { prisma, type Tx } from "@/lib/db/prisma";
import { effectiveStatus } from "@/lib/auction/status";
import { publish } from "@/lib/realtime/bus";
import { minor } from "@/lib/money";
import { maskBidderName } from "@/lib/privacy";
import { notifyBidPlaced, notifyOutbid } from "@/lib/notifications/service";

/**
 * The bidding engine.
 *
 * The database is the only authority on the state of a lot. Nothing the client
 * sends about the current bid, the minimum, the auction status or the clock is
 * trusted — every one of those is re-read inside the transaction that decides
 * the bid. The client supplies exactly one number: the amount it wants to bid.
 *
 * Concurrency is handled with an optimistic compare-and-set on
 * `auctions.version`. Two bidders landing in the same millisecond both read
 * version N; the first to write moves it to N+1 and the second's UPDATE matches
 * zero rows, so it is rejected rather than silently overwriting. A unique index
 * on (auction_id, amount) is the database-level backstop underneath that.
 *
 * A rejected bid is never retried on the bidder's behalf: the price has moved,
 * so the bidder is shown the new price and asked to decide again.
 */

/** Hard ceiling, in minor units, to contain fat-fingered or malicious input. */
const MAX_BID_MINOR = 1_000_000_000_00; // ₹1,000 crore

export const BID_ERROR_CODES = [
  "AUCTION_NOT_FOUND",
  "NOT_LIVE",
  "NOT_STARTED",
  "CLOSED",
  "BID_TOO_LOW",
  "BID_TOO_LARGE",
  "INVALID_AMOUNT",
  "ALREADY_LEADING",
  "ACCOUNT_SUSPENDED",
  "EMAIL_UNVERIFIED",
  "SELLER_CANNOT_BID",
  "CONCURRENT_UPDATE",
] as const;

export type BidErrorCode = (typeof BID_ERROR_CODES)[number];

export type BidSuccess = {
  ok: true;
  bidId: string;
  amount: number;
  currentBid: number;
  bidCount: number;
  minimumNextBid: number;
  endAt: Date;
  status: string;
  extended: boolean;
  /** True when a competing proxy immediately bid past this bidder. */
  outbidByProxy: boolean;
};

export type BidFailure = {
  ok: false;
  code: BidErrorCode;
  message: string;
  /** Latest server-authoritative figures, so the UI can re-sync on rejection. */
  currentBid: number | null;
  minimumNextBid: number | null;
  endAt: Date | null;
  status: string | null;
};

export type BidResult = BidSuccess | BidFailure;

/**
 * Working shape of a lot inside the engine.
 *
 * Money arrives from Prisma as `bigint` (the columns are 64-bit so a lot is
 * never capped by a 32-bit ceiling) and is normalised to `number` the moment
 * it is read, by `normalise` below. Every calculation past that point is
 * ordinary integer arithmetic in minor units.
 */
type AuctionRow = {
  id: string;
  slug: string;
  title: string;
  lotNumber: string;
  currency: string;
  status: string;
  startAt: Date;
  endAt: Date;
  startingPrice: number;
  currentBid: number | null;
  minimumIncrement: number;
  highestBidderId: string | null;
  bidCount: number;
  version: number;
  extensionEnabled: boolean;
  extensionThresholdSec: number;
  extensionDurationSec: number;
  extensionCount: number;
  proxyBiddingEnabled: boolean;
  createdById: string | null;
};

type RawAuctionRow = Prisma.AuctionGetPayload<{ select: typeof AUCTION_SELECT }>;

function normalise(row: RawAuctionRow): AuctionRow {
  return {
    ...row,
    startingPrice: minor(row.startingPrice),
    currentBid: minor(row.currentBid),
    minimumIncrement: minor(row.minimumIncrement),
  };
}

const AUCTION_SELECT = {
  id: true,
  slug: true,
  title: true,
  lotNumber: true,
  currency: true,
  status: true,
  startAt: true,
  endAt: true,
  startingPrice: true,
  currentBid: true,
  minimumIncrement: true,
  highestBidderId: true,
  bidCount: true,
  version: true,
  extensionEnabled: true,
  extensionThresholdSec: true,
  extensionDurationSec: true,
  extensionCount: true,
  proxyBiddingEnabled: true,
  createdById: true,
} as const;

/**
 * The smallest bid the lot will accept right now.
 * First bid must meet the starting price; every later bid must clear the
 * standing bid by at least one full increment.
 */
export function minimumNextBid(auction: {
  currentBid: number | null;
  startingPrice: number;
  minimumIncrement: number;
}): number {
  if (auction.currentBid === null) return auction.startingPrice;
  return auction.currentBid + auction.minimumIncrement;
}

function failure(
  code: BidErrorCode,
  message: string,
  auction?: AuctionRow | null,
): BidFailure {
  return {
    ok: false,
    code,
    message,
    currentBid: auction?.currentBid ?? null,
    minimumNextBid: auction ? minimumNextBid(auction) : null,
    endAt: auction?.endAt ?? null,
    status: auction ? effectiveStatus(auction) : null,
  };
}

class ConcurrentUpdateError extends Error {
  constructor() {
    super("concurrent update");
    this.name = "ConcurrentUpdateError";
  }
}

export type PlaceBidInput = {
  auctionId: string;
  userId: string;
  /** Minor units. The only client-supplied value the engine trusts as input. */
  amount: number;
  /** Optional proxy ceiling to register alongside the bid. */
  maxAmount?: number | null;
  ip?: string | null;
};

export async function placeBid(input: PlaceBidInput): Promise<BidResult> {
  const { auctionId, userId } = input;

  // Reject nonsense before opening a transaction.
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    return failure("INVALID_AMOUNT", "Enter a valid bid amount.");
  }
  if (input.amount > MAX_BID_MINOR) {
    return failure("BID_TOO_LARGE", "That bid exceeds the maximum we accept.");
  }

  type TxOutcome =
    | { kind: "ok"; payload: BidSuccess; outbidUserId: string | null; auction: AuctionRow }
    | { kind: "fail"; payload: BidFailure };

  let outcome: TxOutcome;

  try {
    outcome = await prisma.$transaction(async (tx): Promise<TxOutcome> => {
      // The server clock decides — never a timestamp from the browser.
      const now = new Date();

      const row = await tx.auction.findUnique({
        where: { id: auctionId },
        select: AUCTION_SELECT,
      });

      if (!row) {
        return {
          kind: "fail",
          payload: failure("AUCTION_NOT_FOUND", "This lot is no longer available."),
        };
      }

      const auction = normalise(row);

      const bidder = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, status: true, emailVerifiedAt: true },
      });

      if (!bidder || bidder.status !== "ACTIVE") {
        return {
          kind: "fail",
          payload: failure(
            "ACCOUNT_SUSPENDED",
            "Your account cannot place bids. Contact the saleroom.",
            auction,
          ),
        };
      }

      if (
        process.env.REQUIRE_EMAIL_VERIFICATION === "true" &&
        !bidder.emailVerifiedAt
      ) {
        return {
          kind: "fail",
          payload: failure(
            "EMAIL_UNVERIFIED",
            "Confirm your email address before bidding.",
            auction,
          ),
        };
      }

      // -- Status and timing, re-derived server-side -----------------------
      const status = effectiveStatus(auction, now);

      if (status === "UPCOMING") {
        return {
          kind: "fail",
          payload: failure("NOT_STARTED", "This lot has not opened yet.", auction),
        };
      }
      if (status !== "LIVE" && status !== "EXTENDED") {
        return {
          kind: "fail",
          payload: failure(
            status === "CANCELLED" ? "NOT_LIVE" : "CLOSED",
            status === "CANCELLED"
              ? "This lot has been withdrawn."
              : "This auction has ended.",
            auction,
          ),
        };
      }
      if (now.getTime() >= auction.endAt.getTime()) {
        return {
          kind: "fail",
          payload: failure("CLOSED", "This auction has ended.", auction),
        };
      }

      // -- Bidder eligibility ----------------------------------------------
      if (auction.highestBidderId === userId) {
        return {
          kind: "fail",
          payload: failure(
            "ALREADY_LEADING",
            "You already hold the leading bid on this lot.",
            auction,
          ),
        };
      }

      // -- Amount ------------------------------------------------------------
      const floor = minimumNextBid(auction);
      if (input.amount < floor) {
        return {
          kind: "fail",
          payload: failure(
            "BID_TOO_LOW",
            `Your bid must be at least ${floor / 100} in ${auction.currency}.`,
            auction,
          ),
        };
      }

      // -- Register the proxy ceiling before bidding, so the resolution pass
      //    below can act on it in the same transaction.
      if (
        auction.proxyBiddingEnabled &&
        input.maxAmount &&
        input.maxAmount > input.amount
      ) {
        await tx.proxyBid.upsert({
          where: { auctionId_userId: { auctionId, userId } },
          create: { auctionId, userId, maxAmount: input.maxAmount, active: true },
          update: { maxAmount: input.maxAmount, active: true },
        });
      }

      const previousLeader = auction.highestBidderId;

      // -- Apply the bid (compare-and-set) ----------------------------------
      let state = await applyBid(tx, auction, {
        userId,
        amount: input.amount,
        isAutoBid: false,
        now,
        ip: input.ip ?? null,
        allowExtension: true,
      });

      const extended = state.endAt.getTime() !== auction.endAt.getTime();

      // -- Proxy resolution --------------------------------------------------
      let outbidByProxy = false;
      if (auction.proxyBiddingEnabled) {
        const resolved = await resolveProxyBids(tx, state, userId, now);
        outbidByProxy = resolved.leaderChanged;
        state = resolved.auction;
      }

      const finalLeaderIsBidder = state.highestBidderId === userId;

      return {
        kind: "ok",
        auction: state,
        outbidUserId: previousLeader && previousLeader !== userId ? previousLeader : null,
        payload: {
          ok: true,
          bidId: state.lastBidId,
          amount: input.amount,
          currentBid: state.currentBid ?? input.amount,
          bidCount: state.bidCount,
          minimumNextBid: minimumNextBid(state),
          endAt: state.endAt,
          status: effectiveStatus(state, now),
          extended,
          outbidByProxy: outbidByProxy && !finalLeaderIsBidder,
        },
      };
    });
  } catch (error) {
    // Both the compare-and-set miss and the (auction_id, amount) unique
    // violation mean the same thing to the bidder: someone got there first.
    if (
      error instanceof ConcurrentUpdateError ||
      (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
    ) {
      const latest = await prisma.auction.findUnique({
        where: { id: auctionId },
        select: AUCTION_SELECT,
      });
      return failure(
        "CONCURRENT_UPDATE",
        "The current bid has changed. Please review the latest bid.",
        latest ? normalise(latest) : null,
      );
    }
    throw error;
  }

  if (outcome.kind === "fail") return outcome.payload;

  // -- Side effects, outside the transaction ---------------------------------
  // Broadcasting and notifying must not hold write locks, and a failure here
  // must never invalidate a bid that is already committed.
  const { auction, payload, outbidUserId } = outcome;

  const bidder = await prisma.user.findUnique({
    where: { id: outcome.auction.highestBidderId ?? input.userId },
    select: { id: true, name: true },
  });

  publish({
    type: "bid",
    auctionId: auction.id,
    currentBid: payload.currentBid,
    bidCount: payload.bidCount,
    minimumNextBid: payload.minimumNextBid,
    endAt: payload.endAt.toISOString(),
    status: payload.status,
    bidderLabel: bidder ? maskBidderName(bidder.name) : "Bidder ****",
    bidderId: auction.highestBidderId ?? "",
    isAutoBid: payload.outbidByProxy,
    at: new Date().toISOString(),
  });

  if (payload.extended) {
    publish({
      type: "extended",
      auctionId: auction.id,
      endAt: payload.endAt.toISOString(),
      status: payload.status,
      extensionCount: auction.extensionCount,
      at: new Date().toISOString(),
    });
  }

  await Promise.allSettled([
    notifyBidPlaced({
      userId: input.userId,
      auctionId: auction.id,
      slug: auction.slug,
      lotNumber: auction.lotNumber,
      title: auction.title,
      amount: payload.amount,
      currency: auction.currency,
    }),
    outbidUserId
      ? notifyOutbid({
          userId: outbidUserId,
          slug: auction.slug,
          lotNumber: auction.lotNumber,
          title: auction.title,
          newAmount: payload.currentBid,
          currency: auction.currency,
        })
      : Promise.resolve(),
    // The bidder was immediately overtaken by someone else's standing proxy.
    payload.outbidByProxy
      ? notifyOutbid({
          userId: input.userId,
          slug: auction.slug,
          lotNumber: auction.lotNumber,
          title: auction.title,
          newAmount: payload.currentBid,
          currency: auction.currency,
        })
      : Promise.resolve(),
  ]);

  return payload;
}

type AppliedState = AuctionRow & { lastBidId: string };

/**
 * Inserts one bid and moves the lot's price forward atomically.
 *
 * The UPDATE is guarded on `version` *and* `status`, so it only lands if the
 * row is exactly as it was read a few statements earlier. Zero matched rows
 * means another transaction won the race.
 */
async function applyBid(
  tx: Tx,
  auction: AuctionRow,
  args: {
    userId: string;
    amount: number;
    isAutoBid: boolean;
    now: Date;
    ip: string | null;
    allowExtension: boolean;
  },
): Promise<AppliedState> {
  // Anti-sniping: a bid inside the threshold pushes the close out, so a lot can
  // never be won by arriving one second before the hammer.
  let endAt = auction.endAt;
  let extensionCount = auction.extensionCount;
  let status = auction.status;

  if (args.allowExtension && auction.extensionEnabled) {
    const msToClose = auction.endAt.getTime() - args.now.getTime();
    if (msToClose <= auction.extensionThresholdSec * 1000) {
      endAt = new Date(auction.endAt.getTime() + auction.extensionDurationSec * 1000);
      extensionCount += 1;
      status = "EXTENDED";
    }
  }

  const updated = await tx.auction.updateMany({
    where: {
      id: auction.id,
      version: auction.version,
      status: { in: ["LIVE", "EXTENDED"] },
    },
    data: {
      currentBid: args.amount,
      highestBidderId: args.userId,
      bidCount: { increment: 1 },
      version: { increment: 1 },
      endAt,
      extensionCount,
      status,
    },
  });

  if (updated.count === 0) throw new ConcurrentUpdateError();

  // Demote the bid that was leading a moment ago.
  await tx.bid.updateMany({
    where: { auctionId: auction.id, status: "WINNING" },
    data: { status: "OUTBID" },
  });

  const bid = await tx.bid.create({
    data: {
      auctionId: auction.id,
      userId: args.userId,
      amount: args.amount,
      status: "WINNING",
      isAutoBid: args.isAutoBid,
      ip: args.ip,
    },
    select: { id: true },
  });

  return {
    ...auction,
    currentBid: args.amount,
    highestBidderId: args.userId,
    bidCount: auction.bidCount + 1,
    version: auction.version + 1,
    endAt,
    extensionCount,
    status,
    lastBidId: bid.id,
  };
}

/**
 * Settles standing proxy ceilings against the new price.
 *
 * Absentee bids execute the way a saleroom clerk works them: the bidder with
 * the higher ceiling ends up in front, and the price rises only to the
 * smallest step that beats the underbidder — not to the winner's ceiling.
 *
 * Each round moves the price to one of the two ceilings, so a pair of duelling
 * proxies settles in at most two rounds. The bound is a safety net, not the
 * mechanism.
 */
async function resolveProxyBids(
  tx: Tx,
  auction: AppliedState,
  manualBidderId: string,
  now: Date,
): Promise<{ auction: AppliedState; leaderChanged: boolean }> {
  const MAX_ROUNDS = 8;
  let state = auction;
  let leaderChanged = false;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const leaderId = state.highestBidderId;
    if (!leaderId) break;

    const target = minimumNextBid(state);

    const contenderRow = await tx.proxyBid.findFirst({
      where: {
        auctionId: state.id,
        active: true,
        userId: { not: leaderId },
        maxAmount: { gte: target },
      },
      orderBy: [{ maxAmount: "desc" }, { createdAt: "asc" }],
      select: { userId: true, maxAmount: true },
    });

    if (!contenderRow) break;

    const contender = {
      userId: contenderRow.userId,
      maxAmount: minor(contenderRow.maxAmount),
    };

    // How high the current leader is willing to go: their standing ceiling, or
    // just the bid they actually placed if they left no instruction.
    const leaderProxy = await tx.proxyBid.findUnique({
      where: { auctionId_userId: { auctionId: state.id, userId: leaderId } },
      select: { maxAmount: true, active: true },
    });
    const leaderMax = leaderProxy ? minor(leaderProxy.maxAmount) : 0;
    const leaderCeiling =
      leaderProxy?.active && leaderMax > (state.currentBid ?? 0)
        ? leaderMax
        : (state.currentBid ?? 0);

    // If the contender can clear the leader's ceiling they take the lead one
    // increment above it; otherwise they can only push the price up to their
    // own ceiling, and the leader reclaims it on the next round.
    const amount = Math.max(
      target,
      Math.min(contender.maxAmount, leaderCeiling + state.minimumIncrement),
    );

    state = await applyBid(tx, state, {
      userId: contender.userId,
      amount,
      isAutoBid: true,
      now,
      ip: null,
      // Proxy execution is a consequence of the manual bid, whose extension was
      // already considered; it must not stack further extensions.
      allowExtension: false,
    });

    leaderChanged = state.highestBidderId !== manualBidderId;
  }

  return { auction: state, leaderChanged };
}

// -- Reads -------------------------------------------------------------------

export async function getBidHistory(
  auctionId: string,
  limit = 20,
  cursor?: string,
) {
  const bids = await prisma.bid.findMany({
    where: { auctionId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      amount: true,
      createdAt: true,
      status: true,
      isAutoBid: true,
      userId: true,
      user: { select: { name: true } },
    },
  });

  const hasMore = bids.length > limit;
  const page = hasMore ? bids.slice(0, limit) : bids;

  return {
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]?.id : undefined,
    // Identities are masked here, at the query boundary, so no render path can
    // accidentally leak a bidder's name.
    bids: page.map((bid) => ({
      id: bid.id,
      amount: minor(bid.amount),
      createdAt: bid.createdAt,
      status: bid.status,
      isAutoBid: bid.isAutoBid,
      userId: bid.userId,
      label: maskBidderName(bid.user.name),
    })),
  };
}

export async function getProxyBid(auctionId: string, userId: string) {
  const row = await prisma.proxyBid.findUnique({
    where: { auctionId_userId: { auctionId, userId } },
    select: { maxAmount: true, active: true },
  });
  return row ? { maxAmount: minor(row.maxAmount), active: row.active } : null;
}

export async function cancelProxyBid(auctionId: string, userId: string) {
  await prisma.proxyBid.updateMany({
    where: { auctionId, userId },
    data: { active: false },
  });
}
