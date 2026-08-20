"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { assertUser, AuthenticationError } from "@/lib/auth/guards";
import { placeBid, type BidErrorCode } from "@/lib/bidding/engine";
import { limit, rateKey, RATE_LIMITS } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { parseMoneyToMinor } from "@/lib/money";

/**
 * Thin transport layer over the bidding engine.
 *
 * Its only jobs are: authenticate, rate-limit, parse the amount, and hand a
 * pair of integers to the engine. All auction logic — pricing, timing, status,
 * concurrency — belongs to the engine and is re-derived from the database
 * there. Nothing about the auction's state is accepted from this boundary.
 */

const bidInput = z.object({
  auctionId: z.string().min(1).max(40),
  /** Major units as typed by the bidder, e.g. "53,000" or "53000". */
  amount: z.string().min(1).max(24),
  maxAmount: z.string().max(24).optional().nullable(),
});

export type PlaceBidResponse =
  | {
      ok: true;
      amount: number;
      currentBid: number;
      bidCount: number;
      minimumNextBid: number;
      endAt: string;
      status: string;
      extended: boolean;
      outbidByProxy: boolean;
      message: string;
    }
  | {
      ok: false;
      code: BidErrorCode | "RATE_LIMITED" | "UNAUTHENTICATED" | "INVALID_INPUT";
      message: string;
      currentBid: number | null;
      minimumNextBid: number | null;
      endAt: string | null;
      status: string | null;
    };

export async function placeBidAction(
  raw: z.input<typeof bidInput>,
): Promise<PlaceBidResponse> {
  const parsed = bidInput.safeParse(raw);
  if (!parsed.success) {
    return reject("INVALID_INPUT", "That bid could not be read. Please try again.");
  }

  let userId: string;
  try {
    const user = await assertUser();
    userId = user.id;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return reject("UNAUTHENTICATED", "Sign in to place a bid.");
    }
    throw error;
  }

  const ip = await clientIp();
  const gate = limit(rateKey("bid", ip, userId), RATE_LIMITS.bid);
  if (!gate.ok) {
    return reject(
      "RATE_LIMITED",
      `Too many bids in a short period. Try again in ${gate.retryAfterSeconds}s.`,
    );
  }

  const amount = parseMoneyToMinor(parsed.data.amount);
  if (amount === null || amount <= 0) {
    return reject("INVALID_INPUT", "Enter a valid bid amount.");
  }

  const maxAmount = parsed.data.maxAmount
    ? parseMoneyToMinor(parsed.data.maxAmount)
    : null;

  const result = await placeBid({
    auctionId: parsed.data.auctionId,
    userId,
    amount,
    maxAmount,
    ip,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.code,
      message: result.message,
      currentBid: result.currentBid,
      minimumNextBid: result.minimumNextBid,
      endAt: result.endAt?.toISOString() ?? null,
      status: result.status,
    };
  }

  // Refresh the server-rendered ledger and any cached listing of this lot.
  const auction = await prisma.auction.findUnique({
    where: { id: parsed.data.auctionId },
    select: { slug: true },
  });
  if (auction) revalidatePath(`/auction/${auction.slug}`);

  return {
    ok: true,
    amount: result.amount,
    currentBid: result.currentBid,
    bidCount: result.bidCount,
    minimumNextBid: result.minimumNextBid,
    endAt: result.endAt.toISOString(),
    status: result.status,
    extended: result.extended,
    outbidByProxy: result.outbidByProxy,
    message: result.outbidByProxy
      ? "Bid placed — but another bidder's standing maximum has already taken the lead."
      : result.extended
        ? "Bid placed successfully. The closing time was extended."
        : "Bid placed successfully.",
  };
}

type RejectionCode = Extract<PlaceBidResponse, { ok: false }>["code"];

function reject(code: RejectionCode, message: string): PlaceBidResponse {
  return {
    ok: false,
    code,
    message,
    currentBid: null,
    minimumNextBid: null,
    endAt: null,
    status: null,
  };
}

/* -------------------------------------------------------------------------- */
/* Watchlist                                                                   */
/* -------------------------------------------------------------------------- */

export async function toggleWatchlist(
  auctionId: string,
): Promise<{ ok: boolean; watching: boolean; message: string }> {
  let userId: string;
  try {
    const user = await assertUser();
    userId = user.id;
  } catch {
    return { ok: false, watching: false, message: "Sign in to use your watchlist." };
  }

  const auction = await prisma.auction.findUnique({
    where: { id: auctionId },
    select: { id: true, slug: true, watchlistEnabled: true },
  });
  if (!auction || !auction.watchlistEnabled) {
    return { ok: false, watching: false, message: "This lot cannot be watched." };
  }

  const existing = await prisma.watchlist.findUnique({
    where: { userId_auctionId: { userId, auctionId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    revalidatePath(`/auction/${auction.slug}`);
    return { ok: true, watching: false, message: "Removed from your watchlist." };
  }

  await prisma.watchlist.create({ data: { userId, auctionId } });
  revalidatePath(`/auction/${auction.slug}`);
  return {
    ok: true,
    watching: true,
    message: "Added to your watchlist. We'll notify you before it closes.",
  };
}

/* -------------------------------------------------------------------------- */
/* Bid history (incremental loading)                                           */
/* -------------------------------------------------------------------------- */

export async function loadBidHistory(auctionId: string, cursor?: string) {
  const { getBidHistory } = await import("@/lib/bidding/engine");
  const page = await getBidHistory(auctionId, 20, cursor);

  return {
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    bids: page.bids.map((bid) => ({
      id: bid.id,
      amount: bid.amount,
      createdAt: bid.createdAt.toISOString(),
      status: bid.status,
      isAutoBid: bid.isAutoBid,
      label: bid.label,
    })),
  };
}

export async function cancelMaximumBid(
  auctionId: string,
): Promise<{ ok: boolean; message: string }> {
  const user = await assertUser();
  const { cancelProxyBid } = await import("@/lib/bidding/engine");
  await cancelProxyBid(auctionId, user.id);
  return { ok: true, message: "Your standing maximum has been withdrawn." };
}
