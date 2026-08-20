import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { displayStatus, type DisplayStatus } from "@/lib/auction/status";
import { minor } from "@/lib/money";
import { AuctionStatus } from "@/lib/validation/enums";

/**
 * Operator-facing reads.
 *
 * Distinct from the public query layer: it can see drafts, cancelled lots and
 * real bidder identities. Nothing in here is reachable without an
 * `admin.access` capability check on the calling route.
 */

const PER_PAGE = 20;

export type AdminSort =
  | "endAt:asc"
  | "endAt:desc"
  | "startAt:asc"
  | "startAt:desc"
  | "currentBid:asc"
  | "currentBid:desc"
  | "bidCount:asc"
  | "bidCount:desc"
  | "createdAt:asc"
  | "createdAt:desc"
  | "lotNumber:asc"
  | "lotNumber:desc"
  | "title:asc"
  | "title:desc";

function auctionOrderBy(sort: string | undefined): Prisma.AuctionOrderByWithRelationInput {
  const [field, direction] = (sort ?? "endAt:asc").split(":");
  const dir: Prisma.SortOrder = direction === "desc" ? "desc" : "asc";

  switch (field) {
    case "startAt":
      return { startAt: dir };
    case "currentBid":
      return { currentBid: dir };
    case "bidCount":
      return { bidCount: dir };
    case "createdAt":
      return { createdAt: dir };
    case "lotNumber":
      return { lotNumber: dir };
    case "title":
      return { title: dir };
    case "endAt":
    default:
      return { endAt: dir };
  }
}

export type AdminAuctionRow = {
  id: string;
  lotNumber: string;
  title: string;
  slug: string;
  status: string;
  displayStatus: DisplayStatus;
  category: { id: string; name: string };
  startingPrice: number;
  currentBid: number | null;
  reservePrice: number | null;
  reserveMet: boolean | null;
  currency: string;
  bidCount: number;
  startAt: Date;
  endAt: Date;
  featured: boolean;
  publishedAt: Date | null;
  image: string | null;
  watchers: number;
};

export async function listAdminAuctions(filters: {
  q?: string;
  status?: string;
  category?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}) {
  const now = new Date();
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(filters.perPage ?? PER_PAGE, 100);

  const statusFilter = AuctionStatus.safeParse(filters.status);

  const where: Prisma.AuctionWhereInput = {
    ...(statusFilter.success ? { status: statusFilter.data } : {}),
    ...(filters.category ? { categoryId: filters.category } : {}),
    ...(filters.q
      ? {
          OR: [
            { title: { contains: filters.q } },
            { lotNumber: { contains: filters.q } },
            { slug: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auction.count({ where }),
    prisma.auction.findMany({
      where,
      orderBy: auctionOrderBy(filters.sort),
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        lotNumber: true,
        title: true,
        slug: true,
        status: true,
        startAt: true,
        endAt: true,
        startingPrice: true,
        currentBid: true,
        reservePrice: true,
        currency: true,
        bidCount: true,
        featured: true,
        publishedAt: true,
        category: { select: { id: true, name: true } },
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        _count: { select: { watchers: true } },
      },
    }),
  ]);

  const auctions: AdminAuctionRow[] = rows.map((row) => {
    const currentBid = minor(row.currentBid);
    const reservePrice = minor(row.reservePrice);
    return {
      id: row.id,
      lotNumber: row.lotNumber,
      title: row.title,
      slug: row.slug,
      status: row.status,
      displayStatus: displayStatus(row, now),
      category: row.category,
      startingPrice: minor(row.startingPrice),
      currentBid,
      reservePrice,
      reserveMet: reservePrice === null ? null : (currentBid ?? 0) >= reservePrice,
      currency: row.currency,
      bidCount: row.bidCount,
      startAt: row.startAt,
      endAt: row.endAt,
      featured: row.featured,
      publishedAt: row.publishedAt,
      image: row.images[0]?.url ?? null,
      watchers: row._count.watchers,
    };
  });

  return {
    auctions,
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
  };
}

/** Full record for the edit form, including the reserve (admins may see it). */
export async function getAdminAuction(id: string) {
  const auction = await prisma.auction.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true, fieldSchema: true } },
      images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }] },
      highestBidder: { select: { id: true, name: true, email: true } },
      winner: {
        select: {
          id: true,
          userId: true,
          winningAmount: true,
          buyerPremium: true,
          totalDue: true,
          status: true,
          user: { select: { name: true, email: true } },
        },
      },
      _count: { select: { bids: true, watchers: true } },
    },
  });

  if (!auction) return null;

  return {
    ...auction,
    startingPrice: minor(auction.startingPrice),
    currentBid: minor(auction.currentBid),
    minimumIncrement: minor(auction.minimumIncrement),
    reservePrice: minor(auction.reservePrice),
    winner: auction.winner
      ? {
          ...auction.winner,
          winningAmount: minor(auction.winner.winningAmount),
          buyerPremium: minor(auction.winner.buyerPremium),
          totalDue: minor(auction.winner.totalDue),
        }
      : null,
  };
}

export type AdminAuction = NonNullable<Awaited<ReturnType<typeof getAdminAuction>>>;

/* -------------------------------------------------------------------------- */
/* Bids                                                                        */
/* -------------------------------------------------------------------------- */

export async function listAdminBids(filters: {
  auctionId?: string;
  userId?: string;
  q?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = 30;

  const where: Prisma.BidWhereInput = {
    ...(filters.auctionId ? { auctionId: filters.auctionId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.minAmount !== undefined || filters.maxAmount !== undefined
      ? {
          amount: {
            ...(filters.minAmount !== undefined ? { gte: filters.minAmount } : {}),
            ...(filters.maxAmount !== undefined ? { lte: filters.maxAmount } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { auction: { title: { contains: filters.q } } },
            { auction: { lotNumber: { contains: filters.q } } },
            { user: { name: { contains: filters.q } } },
            { user: { email: { contains: filters.q } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.bid.count({ where }),
    prisma.bid.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        amount: true,
        status: true,
        isAutoBid: true,
        createdAt: true,
        ip: true,
        auction: {
          select: { id: true, slug: true, lotNumber: true, title: true, currency: true },
        },
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    bids: rows.map((row) => ({ ...row, amount: minor(row.amount) })),
  };
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

export async function listAdminUsers(filters: {
  q?: string;
  role?: string;
  status?: string;
  page?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = 25;

  const where: Prisma.UserWhereInput = {
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.q
      ? {
          OR: [
            { name: { contains: filters.q } },
            { email: { contains: filters.q } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        phone: true,
        createdAt: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        _count: { select: { bids: true, wins: true, watchlist: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    users: rows,
  };
}

export async function getAdminUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      emailVerifiedAt: true,
      _count: { select: { bids: true, wins: true, watchlist: true } },
    },
  });

  if (!user) return null;

  const [recentBids, wins] = await Promise.all([
    prisma.bid.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        amount: true,
        status: true,
        createdAt: true,
        auction: { select: { slug: true, lotNumber: true, title: true, currency: true } },
      },
    }),
    prisma.winner.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        totalDue: true,
        status: true,
        createdAt: true,
        auction: { select: { id: true, slug: true, lotNumber: true, title: true, currency: true } },
      },
    }),
  ]);

  return {
    ...user,
    recentBids: recentBids.map((bid) => ({ ...bid, amount: minor(bid.amount) })),
    wins: wins.map((win) => ({ ...win, totalDue: minor(win.totalDue) })),
  };
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                       */
/* -------------------------------------------------------------------------- */

export async function listAuditLog(page = 1, perPage = 30) {
  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        ip: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true, role: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    entries,
  };
}

/** Powers the admin global search. */
export async function adminSearch(query: string) {
  if (query.trim().length < 2) {
    return { auctions: [], users: [] };
  }

  const [auctions, users] = await Promise.all([
    prisma.auction.findMany({
      where: {
        OR: [
          { title: { contains: query } },
          { lotNumber: { contains: query } },
        ],
      },
      take: 6,
      select: { id: true, lotNumber: true, title: true, status: true },
    }),
    prisma.user.findMany({
      where: {
        OR: [{ name: { contains: query } }, { email: { contains: query } }],
      },
      take: 6,
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  return { auctions, users };
}
