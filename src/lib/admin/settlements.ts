import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { minor } from "@/lib/money";
import {
  SETTLEMENT_STAGES,
  type SettlementStage,
} from "@/lib/admin/settlement-stages";

export {
  SETTLEMENT_STAGES,
  STAGE_LABELS,
} from "@/lib/admin/settlement-stages";
export type { SettlementStage } from "@/lib/admin/settlement-stages";

/**
 * Post-sale operations: who owes what, and where each lot is in the
 * fulfilment pipeline.
 */

export async function listSettlements(filters: {
  status?: string;
  q?: string;
  page?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = 25;

  const where: Prisma.WinnerWhereInput = {
    ...(filters.status && SETTLEMENT_STAGES.includes(filters.status as SettlementStage)
      ? { status: filters.status }
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

  const [total, rows, totals] = await Promise.all([
    prisma.winner.count({ where }),
    prisma.winner.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        status: true,
        winningAmount: true,
        buyerPremium: true,
        totalDue: true,
        createdAt: true,
        auction: {
          select: {
            id: true,
            slug: true,
            lotNumber: true,
            title: true,
            currency: true,
            location: true,
          },
        },
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
    prisma.winner.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Outstanding is the figure the saleroom chases; it is worth its own query
  // rather than being derived from the current page of results.
  const pending = await prisma.winner.findMany({
    where: { status: "PAYMENT_PENDING" },
    select: { totalDue: true, createdAt: true },
  });

  const now = Date.now();
  const overdueMs = 5 * 24 * 60 * 60 * 1000;

  return {
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    settlements: rows.map((row) => {
      return {
        id: row.id,
        status: row.status as SettlementStage,
        winningAmount: minor(row.winningAmount),
        buyerPremium: minor(row.buyerPremium),
        totalDue: minor(row.totalDue),
        createdAt: row.createdAt,
        overdue:
          row.status === "PAYMENT_PENDING" &&
          now - row.createdAt.getTime() > overdueMs,
        auction: row.auction,
        user: row.user,
      };
    }),
    counts: Object.fromEntries(
      totals.map((entry) => [entry.status, entry._count._all]),
    ) as Partial<Record<SettlementStage, number>>,
    outstanding: pending.reduce((sum, win) => sum + minor(win.totalDue), 0),
    overdueCount: pending.filter(
      (win) => now - win.createdAt.getTime() > overdueMs,
    ).length,
  };
}
