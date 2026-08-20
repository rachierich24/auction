import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { parseJson } from "@/lib/db/json";
import { reconcileAuctions } from "@/lib/auction/settlement";
import {
  displayStatus,
  effectiveStatus,
  ENDING_SOON_MS,
  type DisplayStatus,
} from "@/lib/auction/status";
import { minimumNextBid } from "@/lib/bidding/engine";
import { minor } from "@/lib/money";
import { PUBLIC_AUCTION_STATUSES } from "@/lib/validation/enums";
import type {
  AuctionFilters,
  SortKey,
  StatusFilter,
} from "@/lib/auction/filters";

export {
  SORT_OPTIONS,
  STATUS_FILTERS,
  isSortKey,
  isStatusFilter,
} from "@/lib/auction/filters";
export type { AuctionFilters, SortKey, StatusFilter } from "@/lib/auction/filters";

/**
 * Read model for the public site.
 *
 * Every list query is paginated and selects only the columns the card needs —
 * bid history and full descriptions are never loaded for a grid.
 */

export const CARD_SELECT = {
  id: true,
  slug: true,
  lotNumber: true,
  title: true,
  shortDescription: true,
  status: true,
  startAt: true,
  endAt: true,
  startingPrice: true,
  currentBid: true,
  minimumIncrement: true,
  reservePrice: true,
  currency: true,
  bidCount: true,
  featured: true,
  category: { select: { id: true, name: true, slug: true } },
  images: {
    where: { isPrimary: true },
    take: 1,
    select: { url: true, altText: true },
  },
} satisfies Prisma.AuctionSelect;

export type AuctionCard = {
  id: string;
  slug: string;
  lotNumber: string;
  title: string;
  shortDescription: string;
  status: DisplayStatus;
  startAt: Date;
  endAt: Date;
  startingPrice: number;
  currentBid: number | null;
  minimumNextBid: number;
  reserveMet: boolean | null;
  currency: string;
  bidCount: number;
  featured: boolean;
  category: { id: string; name: string; slug: string };
  image: { url: string; alt: string } | null;
};

type CardRow = Prisma.AuctionGetPayload<{ select: typeof CARD_SELECT }>;

export function toCard(row: CardRow, now = new Date()): AuctionCard {
  // Money columns are 64-bit; normalise to `number` here so nothing downstream
  // has to think about bigint.
  const startingPrice = minor(row.startingPrice);
  const currentBid = minor(row.currentBid);
  const reservePrice = minor(row.reservePrice);

  return {
    id: row.id,
    slug: row.slug,
    lotNumber: row.lotNumber,
    title: row.title,
    shortDescription: row.shortDescription,
    status: displayStatus(row, now),
    startAt: row.startAt,
    endAt: row.endAt,
    startingPrice,
    currentBid,
    minimumNextBid: minimumNextBid({
      currentBid,
      startingPrice,
      minimumIncrement: minor(row.minimumIncrement),
    }),
    // Whether a reserve exists is public; the reserve figure itself is not.
    reserveMet: reservePrice === null ? null : (currentBid ?? 0) >= reservePrice,
    currency: row.currency,
    bidCount: row.bidCount,
    featured: row.featured,
    category: row.category,
    image: row.images[0]
      ? { url: row.images[0].url, alt: row.images[0].altText ?? row.title }
      : null,
  };
}

// -- Filtering ---------------------------------------------------------------

const PER_PAGE = 12;

function statusWhere(
  status: StatusFilter | undefined,
  now: Date,
): Prisma.AuctionWhereInput {
  switch (status) {
    case "live":
      return { status: { in: ["LIVE", "EXTENDED"] }, endAt: { gt: now } };
    case "ending-soon":
      return {
        status: { in: ["LIVE", "EXTENDED"] },
        endAt: { gt: now, lte: new Date(now.getTime() + ENDING_SOON_MS) },
      };
    case "upcoming":
      return { status: "UPCOMING" };
    case "ended":
      return { status: { in: ["ENDED", "SOLD", "UNSOLD"] } };
    default:
      return {};
  }
}

function orderBy(sort: SortKey | undefined): Prisma.AuctionOrderByWithRelationInput[] {
  switch (sort) {
    case "newest":
      return [{ publishedAt: "desc" }, { createdAt: "desc" }];
    case "highest-bid":
      return [{ currentBid: "desc" }, { startingPrice: "desc" }];
    case "lowest-price":
      return [{ startingPrice: "asc" }];
    case "most-bids":
      return [{ bidCount: "desc" }, { endAt: "asc" }];
    case "ending-soon":
    default:
      return [{ endAt: "asc" }];
  }
}

export type AuctionListResult = {
  auctions: AuctionCard[];
  total: number;
  page: number;
  pageCount: number;
  perPage: number;
};

export async function listAuctions(
  filters: AuctionFilters = {},
): Promise<AuctionListResult> {
  const now = new Date();
  const perPage = Math.min(filters.perPage ?? PER_PAGE, 48);
  const page = Math.max(1, filters.page ?? 1);

  const where: Prisma.AuctionWhereInput = {
    // A lot is only browsable once published; DRAFT and CANCELLED never appear.
    status: { in: PUBLIC_AUCTION_STATUSES },
    ...statusWhere(filters.status, now),
    ...(filters.category ? { category: { slug: filters.category } } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { shortDescription: { contains: filters.q } },
            { lotNumber: { contains: filters.q } },
            { description: { contains: filters.q } },
          ],
        }
      : {}),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? {
          startingPrice: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      orderBy: orderBy(filters.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      select: CARD_SELECT,
    }),
  ]);

  // Bring any lot whose boundary has passed up to date before rendering it.
  await reconcileAuctions(
    rows
      .filter((row) => effectiveStatus(row, now) !== row.status)
      .map((row) => row.id),
    now,
  );

  return {
    auctions: rows.map((row) => toCard(row, now)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    perPage,
  };
}

/** Homepage rails. Each is a small, indexed, bounded query. */
export async function getHomeRails() {
  const now = new Date();

  const [live, endingSoon, upcoming, featured, recentlySold] = await Promise.all([
    prisma.auction.findMany({
      where: { status: { in: ["LIVE", "EXTENDED"] }, endAt: { gt: now } },
      orderBy: [{ bidCount: "desc" }, { endAt: "asc" }],
      take: 8,
      select: CARD_SELECT,
    }),
    prisma.auction.findMany({
      where: {
        status: { in: ["LIVE", "EXTENDED"] },
        endAt: { gt: now, lte: new Date(now.getTime() + ENDING_SOON_MS * 6) },
      },
      orderBy: { endAt: "asc" },
      take: 4,
      select: CARD_SELECT,
    }),
    prisma.auction.findMany({
      where: { status: "UPCOMING" },
      orderBy: { startAt: "asc" },
      take: 4,
      select: CARD_SELECT,
    }),
    prisma.auction.findMany({
      where: {
        featured: true,
        status: { in: ["LIVE", "EXTENDED", "UPCOMING"] },
      },
      orderBy: { endAt: "asc" },
      take: 3,
      select: CARD_SELECT,
    }),
    prisma.auction.findMany({
      where: { status: "SOLD" },
      orderBy: { settledAt: "desc" },
      take: 4,
      select: CARD_SELECT,
    }),
  ]);

  return {
    live: live.map((row) => toCard(row, now)),
    endingSoon: endingSoon.map((row) => toCard(row, now)),
    upcoming: upcoming.map((row) => toCard(row, now)),
    featured: featured.map((row) => toCard(row, now)),
    recentlySold: recentlySold.map((row) => toCard(row, now)),
  };
}

/** Hero lot: the featured live lot with the most heat, else anything live. */
export async function getHeroAuction(): Promise<AuctionCard | null> {
  const now = new Date();
  const row =
    (await prisma.auction.findFirst({
      where: {
        featured: true,
        status: { in: ["LIVE", "EXTENDED"] },
        endAt: { gt: now },
      },
      orderBy: [{ bidCount: "desc" }],
      select: CARD_SELECT,
    })) ??
    (await prisma.auction.findFirst({
      where: { status: { in: ["LIVE", "EXTENDED"] }, endAt: { gt: now } },
      orderBy: [{ bidCount: "desc" }],
      select: CARD_SELECT,
    })) ??
    (await prisma.auction.findFirst({
      where: { status: { in: PUBLIC_AUCTION_STATUSES } },
      orderBy: { startAt: "asc" },
      select: CARD_SELECT,
    }));

  return row ? toCard(row, now) : null;
}

// -- Detail ------------------------------------------------------------------

export type SpecField = { key: string; label: string; value: string };

export async function getAuctionBySlug(slug: string) {
  const now = new Date();

  const auction = await prisma.auction.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true, fieldSchema: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      winner: { select: { userId: true, winningAmount: true, status: true } },
    },
  });

  if (!auction) return null;

  // Never render a DRAFT or CANCELLED lot on the public site.
  if (!PUBLIC_AUCTION_STATUSES.includes(auction.status as never)) return null;

  if (effectiveStatus(auction, now) !== auction.status) {
    await reconcileAuctions([auction.id], now);
    return getAuctionBySlug(slug);
  }

  const schema = parseJson<
    { key: string; label: string; type?: string }[]
  >(auction.category.fieldSchema, []);
  const values = parseJson<Record<string, string>>(auction.attributes, {});

  // Specifications follow the category's declared order, then any extra
  // attributes an admin added ad hoc.
  const specs: SpecField[] = [];
  const seen = new Set<string>();
  for (const field of schema) {
    const value = values[field.key];
    if (value) {
      specs.push({ key: field.key, label: field.label, value });
      seen.add(field.key);
    }
  }
  for (const [key, value] of Object.entries(values)) {
    if (!seen.has(key) && value) {
      specs.push({ key, label: humanize(key), value });
    }
  }

  const startingPrice = minor(auction.startingPrice);
  const currentBid = minor(auction.currentBid);
  const reservePrice = minor(auction.reservePrice);
  const minimumIncrement = minor(auction.minimumIncrement);

  return {
    ...auction,
    // Overwrite the raw bigint columns with normalised numbers. The reserve
    // *figure* is deliberately not returned — only whether one exists and
    // whether it has been met, which is all a bidder is entitled to see.
    startingPrice,
    currentBid,
    minimumIncrement,
    reservePrice: undefined,
    winner: auction.winner
      ? {
          ...auction.winner,
          winningAmount: minor(auction.winner.winningAmount),
        }
      : null,
    displayStatus: displayStatus(auction, now),
    effectiveStatus: effectiveStatus(auction, now),
    minimumNextBid: minimumNextBid({
      currentBid,
      startingPrice,
      minimumIncrement,
    }),
    hasReserve: reservePrice !== null,
    reserveMet: reservePrice === null ? null : (currentBid ?? 0) >= reservePrice,
    specs,
  };
}

export type AuctionDetail = NonNullable<
  Awaited<ReturnType<typeof getAuctionBySlug>>
>;

function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getRelatedAuctions(
  auctionId: string,
  categoryId: string,
  take = 4,
): Promise<AuctionCard[]> {
  const now = new Date();
  const rows = await prisma.auction.findMany({
    where: {
      id: { not: auctionId },
      categoryId,
      status: { in: ["LIVE", "EXTENDED", "UPCOMING"] },
    },
    orderBy: { endAt: "asc" },
    take,
    select: CARD_SELECT,
  });
  return rows.map((row) => toCard(row, now));
}

export async function getCategories(includeHidden = false) {
  return prisma.category.findMany({
    where: includeHidden ? {} : { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      image: true,
      status: true,
      sortOrder: true,
      fieldSchema: true,
      _count: { select: { auctions: true } },
    },
  });
}

export async function isWatching(
  userId: string | undefined,
  auctionId: string,
): Promise<boolean> {
  if (!userId) return false;
  const row = await prisma.watchlist.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
    select: { id: true },
  });
  return row !== null;
}

/** Non-blocking, best-effort view counter. */
export async function recordView(auctionId: string): Promise<void> {
  await prisma.auction
    .update({ where: { id: auctionId }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);
}
