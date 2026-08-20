import "server-only";

import { prisma } from "@/lib/db/prisma";
import { assertTransition, effectiveStatus } from "@/lib/auction/status";
import { publish } from "@/lib/realtime/bus";
import { buyerPremiumFor, minor } from "@/lib/money";
import {
  notifyEndingSoon,
  notifyLost,
  notifyStartingSoon,
  notifyWon,
} from "@/lib/notifications/service";

/**
 * Auction settlement.
 *
 * The server clock is the only thing that opens or closes a lot. This module is
 * driven from three places, all of which converge on the same transaction:
 *
 *   1. the scheduled sweep (/api/cron/close-auctions, or `npm run close:auctions`)
 *   2. opportunistically, whenever a read notices a lot has passed a boundary
 *   3. an explicit admin action to end a lot early
 *
 * Every entry point is idempotent. Settlement is guarded by a status check
 * inside the transaction, so two sweeps racing each other cannot produce two
 * winners or two notifications for the same lot.
 */

export type SettlementOutcome = {
  auctionId: string;
  lotNumber: string;
  status: "SOLD" | "UNSOLD" | "SKIPPED";
  winnerId?: string;
  winningAmount?: number;
  reason?: string;
};

/**
 * Closes one lot and decides its fate.
 *
 * The highest valid bid wins. If the lot carries a reserve and the top bid is
 * below it, nothing is sold — the lot closes UNSOLD and no winner record is
 * created. Bids are never modified beyond their WON/LOST outcome.
 */
/** What the settlement transaction hands back to the side-effect stage. */
type SettlementTxResult =
  | {
      auctionId: string;
      lotNumber: string;
      status: "SKIPPED";
      reason: string;
    }
  | {
      auctionId: string;
      lotNumber: string;
      slug: string;
      title: string;
      currency: string;
      status: "SOLD" | "UNSOLD";
      winnerId?: string;
      winningAmount?: number;
      underbidders: string[];
    };

export async function settleAuction(
  auctionId: string,
  options: { force?: boolean; now?: Date } = {},
): Promise<SettlementOutcome> {
  const now = options.now ?? new Date();

  const result = await prisma.$transaction(
    async (tx): Promise<SettlementTxResult> => {
    const auction = await tx.auction.findUnique({
      where: { id: auctionId },
      select: {
        id: true,
        slug: true,
        title: true,
        lotNumber: true,
        currency: true,
        status: true,
        startAt: true,
        endAt: true,
        reservePrice: true,
        buyerPremiumBps: true,
      },
    });

    if (!auction) {
      return { auctionId, lotNumber: "?", status: "SKIPPED" as const, reason: "not found" };
    }

    // Only an open lot can be settled, and only once its time is up.
    if (auction.status !== "LIVE" && auction.status !== "EXTENDED") {
      return {
        auctionId,
        lotNumber: auction.lotNumber,
        status: "SKIPPED" as const,
        reason: `status is ${auction.status}`,
      };
    }
    if (!options.force && auction.endAt.getTime() > now.getTime()) {
      return {
        auctionId,
        lotNumber: auction.lotNumber,
        status: "SKIPPED" as const,
        reason: "not yet due",
      };
    }

    const topBid = await tx.bid.findFirst({
      where: { auctionId, status: { notIn: ["RETRACTED"] } },
      orderBy: [{ amount: "desc" }, { createdAt: "asc" }],
      select: { id: true, userId: true, amount: true },
    });

    const reservePrice = minor(auction.reservePrice);
    const winningAmount = topBid ? minor(topBid.amount) : null;

    const reserveMet =
      topBid !== null &&
      (reservePrice === null || (winningAmount ?? 0) >= reservePrice);

    // Walk the state machine properly rather than jumping straight to the
    // terminal state, so an invalid transition would throw rather than persist.
    assertTransition(auction.status as never, "ENDED");
    const finalStatus: "SOLD" | "UNSOLD" = reserveMet ? "SOLD" : "UNSOLD";
    assertTransition("ENDED", finalStatus);

    // Claim the lot. If a concurrent sweep already settled it, this matches
    // zero rows and we abandon quietly.
    const claimed = await tx.auction.updateMany({
      where: { id: auctionId, status: { in: ["LIVE", "EXTENDED"] } },
      data: {
        status: finalStatus,
        settledAt: now,
        ...(options.force ? { endAt: now } : {}),
      },
    });

    if (claimed.count === 0) {
      return {
        auctionId,
        lotNumber: auction.lotNumber,
        status: "SKIPPED" as const,
        reason: "already settled",
      };
    }

    // Mark every bid's final outcome.
    await tx.bid.updateMany({
      where: { auctionId },
      data: { status: "LOST" },
    });

    if (topBid && reserveMet) {
      await tx.bid.update({ where: { id: topBid.id }, data: { status: "WON" } });

      const premium = buyerPremiumFor(winningAmount!, auction.buyerPremiumBps);

      await tx.winner.create({
        data: {
          auctionId,
          userId: topBid.userId,
          winningBidId: topBid.id,
          winningAmount: winningAmount!,
          buyerPremium: premium,
          totalDue: winningAmount! + premium,
          status: "PAYMENT_PENDING",
        },
      });
    }

    // Standing proxy instructions are spent once the lot closes.
    await tx.proxyBid.updateMany({
      where: { auctionId, active: true },
      data: { active: false },
    });

    const underbidders = await tx.bid.findMany({
      where: { auctionId, ...(topBid ? { userId: { not: topBid.userId } } : {}) },
      distinct: ["userId"],
      select: { userId: true },
    });

    return {
      auctionId,
      lotNumber: auction.lotNumber,
      slug: auction.slug,
      title: auction.title,
      currency: auction.currency,
      status: finalStatus,
      winnerId: reserveMet && topBid ? topBid.userId : undefined,
      winningAmount: reserveMet && winningAmount !== null ? winningAmount : undefined,
      underbidders: underbidders.map((bid) => bid.userId),
    };
    },
  );

  if (result.status === "SKIPPED") return result;

  // -- Side effects, after the transaction has committed ---------------------
  const settled = result;

  publish({
    type: "status",
    auctionId: settled.auctionId,
    status: settled.status,
    endAt: now.toISOString(),
    at: now.toISOString(),
  });

  await Promise.allSettled([
    settled.winnerId && settled.winningAmount !== undefined
      ? notifyWon({
          userId: settled.winnerId,
          auctionId: settled.auctionId,
          slug: settled.slug,
          lotNumber: settled.lotNumber,
          title: settled.title,
          amount: settled.winningAmount,
          currency: settled.currency,
        })
      : Promise.resolve(),
    ...settled.underbidders.map((userId) =>
      notifyLost({
        userId,
        slug: settled.slug,
        lotNumber: settled.lotNumber,
        title: settled.title,
      }),
    ),
  ]);

  return {
    auctionId: settled.auctionId,
    lotNumber: settled.lotNumber,
    status: settled.status,
    winnerId: settled.winnerId,
    winningAmount: settled.winningAmount,
  };
}

/**
 * Moves scheduled lots into bidding.
 *
 * Separate from closing because opening is cheap and safe to run often, while
 * closing writes winner records.
 */
export async function openDueAuctions(now = new Date()): Promise<number> {
  const due = await prisma.auction.findMany({
    where: { status: "UPCOMING", startAt: { lte: now }, endAt: { gt: now } },
    select: { id: true, slug: true, title: true, lotNumber: true, endAt: true },
  });

  let opened = 0;

  for (const auction of due) {
    const claimed = await prisma.auction.updateMany({
      where: { id: auction.id, status: "UPCOMING" },
      data: { status: "LIVE" },
    });
    if (claimed.count === 0) continue;
    opened++;

    publish({
      type: "status",
      auctionId: auction.id,
      status: "LIVE",
      endAt: auction.endAt.toISOString(),
      at: now.toISOString(),
    });

    // Everyone watching the lot hears that it has opened.
    const watchers = await prisma.watchlist.findMany({
      where: { auctionId: auction.id },
      select: { userId: true },
    });

    await Promise.allSettled(
      watchers.map((watcher) =>
        notifyStartingSoon({
          userId: watcher.userId,
          slug: auction.slug,
          lotNumber: auction.lotNumber,
          title: auction.title,
        }),
      ),
    );
  }

  return opened;
}

/** Closes every lot whose time is up. */
export async function closeDueAuctions(
  now = new Date(),
): Promise<SettlementOutcome[]> {
  const due = await prisma.auction.findMany({
    where: { status: { in: ["LIVE", "EXTENDED"] }, endAt: { lte: now } },
    select: { id: true },
    // Bounded so one sweep cannot run unboundedly long; the next tick picks up
    // the remainder.
    take: 200,
  });

  const outcomes: SettlementOutcome[] = [];
  for (const auction of due) {
    outcomes.push(await settleAuction(auction.id, { now }));
  }
  return outcomes;
}

/**
 * Warns watchers and active bidders that a lot is about to close.
 * Deduplicated by checking for a notification already sent for this window.
 */
export async function notifyClosingSoon(
  now = new Date(),
  windowMinutes = 15,
): Promise<number> {
  const horizon = new Date(now.getTime() + windowMinutes * 60_000);

  const closing = await prisma.auction.findMany({
    where: {
      status: { in: ["LIVE", "EXTENDED"] },
      endAt: { gt: now, lte: horizon },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      lotNumber: true,
      endAt: true,
      watchers: { select: { userId: true } },
      bids: { distinct: ["userId"], select: { userId: true } },
    },
  });

  let sent = 0;

  for (const auction of closing) {
    const recipients = new Set([
      ...auction.watchers.map((w) => w.userId),
      ...auction.bids.map((b) => b.userId),
    ]);

    for (const userId of recipients) {
      // One warning per person per lot.
      const already = await prisma.notification.findFirst({
        where: {
          userId,
          type: "ENDING_SOON",
          href: `/auction/${auction.slug}`,
          createdAt: { gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (already) continue;

      await notifyEndingSoon({
        userId,
        slug: auction.slug,
        lotNumber: auction.lotNumber,
        title: auction.title,
        minutes: Math.max(
          1,
          Math.round((auction.endAt.getTime() - now.getTime()) / 60_000),
        ),
      });
      sent++;
    }
  }

  return sent;
}

/**
 * Opportunistic catch-up used by read paths.
 *
 * A lot can sit for a few seconds between its scheduled boundary and the next
 * sweep. Rather than show a stale status, reads pass the ids they noticed are
 * out of date and this brings them into line before rendering.
 */
export async function reconcileAuctions(
  auctionIds: string[],
  now = new Date(),
): Promise<void> {
  if (auctionIds.length === 0) return;

  const auctions = await prisma.auction.findMany({
    where: { id: { in: auctionIds.slice(0, 24) } },
    select: { id: true, status: true, startAt: true, endAt: true },
  });

  for (const auction of auctions) {
    const target = effectiveStatus(auction, now);

    if (auction.status === "UPCOMING" && target !== "UPCOMING") {
      await prisma.auction
        .updateMany({
          where: { id: auction.id, status: "UPCOMING" },
          data: { status: "LIVE" },
        })
        .catch(() => undefined);
    }

    if (
      (auction.status === "LIVE" || auction.status === "EXTENDED") &&
      target === "ENDED"
    ) {
      await settleAuction(auction.id, { now }).catch((error) => {
        console.error("[settlement] reconcile failed", auction.id, error);
      });
    }
  }
}

/** One pass of every scheduled job. Used by the cron route and the CLI. */
export async function runScheduledTasks(now = new Date()) {
  const opened = await openDueAuctions(now);
  const closed = await closeDueAuctions(now);
  const warned = await notifyClosingSoon(now);

  return {
    at: now.toISOString(),
    opened,
    closed: closed.filter((outcome) => outcome.status !== "SKIPPED"),
    warned,
  };
}
