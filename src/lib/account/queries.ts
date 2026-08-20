import "server-only";

import { prisma } from "@/lib/db/prisma";
import { displayStatus, effectiveStatus } from "@/lib/auction/status";
import { minor } from "@/lib/money";
import type { DisplayStatus } from "@/lib/auction/status";

/**
 * Read model for a bidder's own account.
 *
 * Every query here is scoped by `userId` at the database level — there is no
 * code path that reads one bidder's activity while authenticated as another.
 */

const LOT_SELECT = {
  id: true,
  slug: true,
  lotNumber: true,
  title: true,
  currency: true,
  status: true,
  startAt: true,
  endAt: true,
  startingPrice: true,
  currentBid: true,
  minimumIncrement: true,
  highestBidderId: true,
  bidCount: true,
  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
} as const;

export type AccountLot = {
  id: string;
  slug: string;
  lotNumber: string;
  title: string;
  currency: string;
  status: DisplayStatus;
  endAt: Date;
  startAt: Date;
  currentBid: number | null;
  image: string | null;
};

function toLot(
  row: {
    id: string;
    slug: string;
    lotNumber: string;
    title: string;
    currency: string;
    status: string;
    startAt: Date;
    endAt: Date;
    currentBid: bigint | null;
    images: { url: string }[];
  },
  now: Date,
): AccountLot {
  return {
    id: row.id,
    slug: row.slug,
    lotNumber: row.lotNumber,
    title: row.title,
    currency: row.currency,
    status: displayStatus(row, now),
    startAt: row.startAt,
    endAt: row.endAt,
    currentBid: minor(row.currentBid),
    image: row.images[0]?.url ?? null,
  };
}

export type ActiveBid = AccountLot & {
  myBid: number;
  leading: boolean;
  maximum: number | null;
};

/**
 * Lots the bidder is still in play on, with whether they are currently in
 * front. `leading` is read from the auction's own `highestBidderId`, never
 * inferred from bid rows, so it always matches what the lot page shows.
 */
export async function getActiveBids(userId: string): Promise<ActiveBid[]> {
  const now = new Date();

  const bids = await prisma.bid.findMany({
    where: {
      userId,
      auction: { status: { in: ["LIVE", "EXTENDED"] } },
    },
    orderBy: { amount: "desc" },
    distinct: ["auctionId"],
    select: { amount: true, auction: { select: LOT_SELECT } },
  });

  const proxies = await prisma.proxyBid.findMany({
    where: { userId, active: true, auctionId: { in: bids.map((b) => b.auction.id) } },
    select: { auctionId: true, maxAmount: true },
  });
  const proxyByAuction = new Map(
    proxies.map((proxy) => [proxy.auctionId, minor(proxy.maxAmount)]),
  );

  return bids.map((bid) => ({
    ...toLot(bid.auction, now),
    myBid: minor(bid.amount),
    leading: bid.auction.highestBidderId === userId,
    maximum: proxyByAuction.get(bid.auction.id) ?? null,
  }));
}

export type WonLot = AccountLot & {
  winningAmount: number;
  buyerPremium: number;
  totalDue: number;
  settlementStatus: string;
  paid: boolean;
};

export async function getWonLots(userId: string): Promise<WonLot[]> {
  const now = new Date();

  const wins = await prisma.winner.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      winningAmount: true,
      buyerPremium: true,
      totalDue: true,
      status: true,
      auction: { select: LOT_SELECT },
    },
  });

  return wins.map((win) => ({
    ...toLot(win.auction, now),
    winningAmount: minor(win.winningAmount),
    buyerPremium: minor(win.buyerPremium),
    totalDue: minor(win.totalDue),
    settlementStatus: win.status,
    paid: win.status !== "PAYMENT_PENDING" && win.status !== "CANCELLED",
  }));
}

export type LostLot = AccountLot & { myBid: number; hammer: number | null };

/** Closed lots the bidder took part in but did not win. */
export async function getLostLots(userId: string): Promise<LostLot[]> {
  const now = new Date();

  const bids = await prisma.bid.findMany({
    where: {
      userId,
      auction: {
        status: { in: ["ENDED", "SOLD", "UNSOLD"] },
        // Exclude anything they actually won.
        winner: { is: null },
      },
    },
    orderBy: { amount: "desc" },
    distinct: ["auctionId"],
    select: { amount: true, auction: { select: LOT_SELECT } },
    take: 50,
  });

  const alsoWon = await prisma.winner.findMany({
    where: { userId },
    select: { auctionId: true },
  });
  const wonIds = new Set(alsoWon.map((win) => win.auctionId));

  // A lot the bidder led but which failed its reserve appears here too — they
  // did not win it, and saying so plainly is better than hiding it.
  const soldElsewhere = await prisma.bid.findMany({
    where: {
      userId,
      auction: { status: { in: ["SOLD"] }, NOT: { winner: { userId } } },
    },
    orderBy: { amount: "desc" },
    distinct: ["auctionId"],
    select: { amount: true, auction: { select: LOT_SELECT } },
    take: 50,
  });

  const merged = [...bids, ...soldElsewhere].filter(
    (bid) => !wonIds.has(bid.auction.id),
  );

  const seen = new Set<string>();
  return merged
    .filter((bid) => {
      if (seen.has(bid.auction.id)) return false;
      seen.add(bid.auction.id);
      return true;
    })
    .map((bid) => ({
      ...toLot(bid.auction, now),
      myBid: minor(bid.amount),
      hammer: minor(bid.auction.currentBid),
    }));
}

export async function getWatchlist(userId: string): Promise<AccountLot[]> {
  const now = new Date();
  const rows = await prisma.watchlist.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { auction: { select: LOT_SELECT } },
  });
  return rows.map((row) => toLot(row.auction, now));
}

export type BidLedgerEntry = {
  id: string;
  amount: number;
  createdAt: Date;
  status: string;
  isAutoBid: boolean;
  currency: string;
  lot: { slug: string; lotNumber: string; title: string };
};

export async function getBidLedger(
  userId: string,
  page = 1,
  perPage = 20,
): Promise<{ entries: BidLedgerEntry[]; total: number; pageCount: number }> {
  const [total, rows] = await Promise.all([
    prisma.bid.count({ where: { userId } }),
    prisma.bid.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        amount: true,
        createdAt: true,
        status: true,
        isAutoBid: true,
        auction: {
          select: { slug: true, lotNumber: true, title: true, currency: true },
        },
      },
    }),
  ]);

  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    entries: rows.map((row) => ({
      id: row.id,
      amount: minor(row.amount),
      createdAt: row.createdAt,
      status: row.status,
      isAutoBid: row.isAutoBid,
      currency: row.auction.currency,
      lot: {
        slug: row.auction.slug,
        lotNumber: row.auction.lotNumber,
        title: row.auction.title,
      },
    })),
  };
}

export async function getAccountSummary(userId: string) {
  const [bidCount, wonCount, watchCount, activeCount, unread, outstanding] =
    await Promise.all([
      prisma.bid.count({ where: { userId } }),
      prisma.winner.count({ where: { userId } }),
      prisma.watchlist.count({ where: { userId } }),
      prisma.bid.findMany({
        where: { userId, auction: { status: { in: ["LIVE", "EXTENDED"] } } },
        distinct: ["auctionId"],
        select: { id: true },
      }),
      prisma.notification.count({ where: { userId, readAt: null } }),
      prisma.winner.findMany({
        where: { userId, status: "PAYMENT_PENDING" },
        select: { totalDue: true },
      }),
    ]);

  return {
    bidCount,
    wonCount,
    watchCount,
    activeCount: activeCount.length,
    unread,
    outstanding: outstanding.reduce((sum, win) => sum + minor(win.totalDue), 0),
  };
}

/** Winner record for the payment page, scoped so only the winner can load it. */
export async function getSettlement(auctionId: string, userId: string) {
  const winner = await prisma.winner.findUnique({
    where: { auctionId },
    select: {
      id: true,
      userId: true,
      winningAmount: true,
      buyerPremium: true,
      totalDue: true,
      status: true,
      createdAt: true,
      auction: {
        select: {
          id: true,
          slug: true,
          lotNumber: true,
          title: true,
          currency: true,
          buyerPremiumBps: true,
          shippingNote: true,
          paymentNote: true,
          location: true,
          status: true,
          startAt: true,
          endAt: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        },
      },
    },
  });

  if (!winner || winner.userId !== userId) return null;

  const payments = await prisma.payment.findMany({
    where: { auctionId, userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      amount: true,
      status: true,
      provider: true,
      providerPaymentId: true,
      createdAt: true,
    },
  });

  return {
    id: winner.id,
    status: winner.status,
    createdAt: winner.createdAt,
    winningAmount: minor(winner.winningAmount),
    buyerPremium: minor(winner.buyerPremium),
    totalDue: minor(winner.totalDue),
    auction: {
      ...winner.auction,
      image: winner.auction.images[0]?.url ?? null,
      effectiveStatus: effectiveStatus(winner.auction),
    },
    payments: payments.map((payment) => ({
      ...payment,
      amount: minor(payment.amount),
    })),
  };
}

export async function getNotifications(
  userId: string,
  page = 1,
  perPage = 25,
) {
  const [total, rows, unread] = await Promise.all([
    prisma.notification.count({ where: { userId } }),
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return {
    total,
    unread,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    notifications: rows,
  };
}
