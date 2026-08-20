import "server-only";

import { prisma } from "@/lib/db/prisma";
import { minor } from "@/lib/money";

/**
 * Saleroom analytics.
 *
 * Deliberately built from a handful of aggregate queries rather than pulling
 * rows into memory: these figures must stay cheap as the catalogue grows.
 */

export const RANGES = {
  "7d": { label: "7 days", days: 7 },
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  all: { label: "All time", days: 3650 },
} as const;

export type RangeKey = keyof typeof RANGES;

export function rangeStart(range: RangeKey, now = new Date()): Date {
  return new Date(now.getTime() - RANGES[range].days * 24 * 60 * 60 * 1000);
}

export type Overview = {
  totalAuctions: number;
  liveAuctions: number;
  upcomingAuctions: number;
  completedAuctions: number;
  draftAuctions: number;
  totalBids: number;
  registeredUsers: number;
  activeBidders: number;
  totalSales: number;
  outstanding: number;
};

export async function getOverview(from: Date): Promise<Overview> {
  const [
    totalAuctions,
    liveAuctions,
    upcomingAuctions,
    completedAuctions,
    draftAuctions,
    totalBids,
    registeredUsers,
    activeBidderRows,
    soldWinners,
    pendingWinners,
  ] = await Promise.all([
    prisma.auction.count(),
    prisma.auction.count({ where: { status: { in: ["LIVE", "EXTENDED"] } } }),
    prisma.auction.count({ where: { status: "UPCOMING" } }),
    prisma.auction.count({ where: { status: { in: ["SOLD", "UNSOLD", "ENDED"] } } }),
    prisma.auction.count({ where: { status: "DRAFT" } }),
    prisma.bid.count({ where: { createdAt: { gte: from } } }),
    prisma.user.count({ where: { role: "BIDDER" } }),
    prisma.bid.findMany({
      where: { createdAt: { gte: from } },
      distinct: ["userId"],
      select: { userId: true },
    }),
    prisma.winner.findMany({
      where: { createdAt: { gte: from } },
      select: { winningAmount: true, buyerPremium: true },
    }),
    prisma.winner.findMany({
      where: { status: "PAYMENT_PENDING" },
      select: { totalDue: true },
    }),
  ]);

  return {
    totalAuctions,
    liveAuctions,
    upcomingAuctions,
    completedAuctions,
    draftAuctions,
    totalBids,
    registeredUsers,
    activeBidders: activeBidderRows.length,
    // "Sales" is hammer plus premium — what the saleroom actually invoices.
    totalSales: soldWinners.reduce(
      (sum, win) => sum + minor(win.winningAmount) + minor(win.buyerPremium),
      0,
    ),
    outstanding: pendingWinners.reduce((sum, win) => sum + minor(win.totalDue), 0),
  };
}

export type SeriesPoint = { date: string; value: number; label: string };

/** Daily bid counts across the range, with empty days filled in as zero. */
export async function getBidsOverTime(
  from: Date,
  now = new Date(),
): Promise<SeriesPoint[]> {
  const bids = await prisma.bid.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, number>();
  const days = Math.max(
    1,
    Math.ceil((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );

  // Seed every day so the chart has no gaps where nothing happened.
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(dayKey(day), 0);
  }

  for (const bid of bids) {
    const key = dayKey(bid.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, value]) => ({
    date,
    value,
    label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
  }));
}

/** Daily invoiced value (hammer + premium) for settled lots. */
export async function getRevenueOverTime(
  from: Date,
  now = new Date(),
): Promise<SeriesPoint[]> {
  const wins = await prisma.winner.findMany({
    where: { createdAt: { gte: from } },
    select: { createdAt: true, winningAmount: true, buyerPremium: true },
    orderBy: { createdAt: "asc" },
  });

  const buckets = new Map<string, number>();
  const days = Math.max(
    1,
    Math.ceil((now.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)),
  );
  for (let i = 0; i < days; i++) {
    const day = new Date(from.getTime() + i * 24 * 60 * 60 * 1000);
    buckets.set(dayKey(day), 0);
  }

  for (const win of wins) {
    const key = dayKey(win.createdAt);
    if (buckets.has(key)) {
      buckets.set(
        key,
        (buckets.get(key) ?? 0) + minor(win.winningAmount) + minor(win.buyerPremium),
      );
    }
  }

  return [...buckets.entries()].map(([date, value]) => ({
    date,
    value,
    label: new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
  }));
}

export type CategoryStat = {
  id: string;
  name: string;
  auctions: number;
  bids: number;
  sold: number;
  value: number;
};

export async function getCategoryPerformance(from: Date): Promise<CategoryStat[]> {
  const categories = await prisma.category.findMany({
    select: {
      id: true,
      name: true,
      auctions: {
        select: {
          id: true,
          status: true,
          bidCount: true,
          winner: { select: { winningAmount: true, buyerPremium: true } },
        },
      },
    },
  });

  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      auctions: category.auctions.length,
      bids: category.auctions.reduce((sum, a) => sum + a.bidCount, 0),
      sold: category.auctions.filter((a) => a.status === "SOLD").length,
      value: category.auctions.reduce(
        (sum, a) =>
          sum +
          (a.winner
            ? minor(a.winner.winningAmount) + minor(a.winner.buyerPremium)
            : 0),
        0,
      ),
    }))
    .sort((a, b) => b.bids - a.bids);
}

export type PerformanceStats = {
  averageBidsPerAuction: number;
  averageWinningPrice: number;
  sellThroughRate: number;
  totalAuctionValue: number;
  mostWatched: { id: string; lotNumber: string; title: string; watchers: number }[];
  topLots: {
    id: string;
    slug: string;
    lotNumber: string;
    title: string;
    currentBid: number;
    bidCount: number;
    currency: string;
  }[];
};

export async function getPerformance(from: Date): Promise<PerformanceStats> {
  const [closed, winners, watched, topLots, allWithBids] = await Promise.all([
    prisma.auction.count({
      where: { status: { in: ["SOLD", "UNSOLD"] }, settledAt: { gte: from } },
    }),
    prisma.winner.findMany({
      where: { createdAt: { gte: from } },
      select: { winningAmount: true },
    }),
    prisma.auction.findMany({
      orderBy: { watchers: { _count: "desc" } },
      take: 5,
      select: {
        id: true,
        lotNumber: true,
        title: true,
        _count: { select: { watchers: true } },
      },
    }),
    prisma.auction.findMany({
      where: { currentBid: { not: null } },
      orderBy: { currentBid: "desc" },
      take: 5,
      select: {
        id: true,
        slug: true,
        lotNumber: true,
        title: true,
        currentBid: true,
        bidCount: true,
        currency: true,
      },
    }),
    prisma.auction.aggregate({
      _avg: { bidCount: true },
      _sum: { currentBid: true },
      where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
    }),
  ]);

  const winningTotal = winners.reduce(
    (sum, win) => sum + minor(win.winningAmount),
    0,
  );

  return {
    averageBidsPerAuction: Number(allWithBids._avg.bidCount?.toFixed(1) ?? 0),
    averageWinningPrice: winners.length
      ? Math.round(winningTotal / winners.length)
      : 0,
    // Of the lots that reached a conclusion in this window, how many sold.
    sellThroughRate: closed > 0 ? Math.round((winners.length / closed) * 100) : 0,
    totalAuctionValue: minor(allWithBids._sum.currentBid ?? 0),
    mostWatched: watched.map((lot) => ({
      id: lot.id,
      lotNumber: lot.lotNumber,
      title: lot.title,
      watchers: lot._count.watchers,
    })),
    topLots: topLots.map((lot) => ({
      ...lot,
      currentBid: minor(lot.currentBid) ?? 0,
    })),
  };
}

export async function getStatusBreakdown() {
  const rows = await prisma.auction.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return rows.map((row) => ({ status: row.status, count: row._count._all }));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
