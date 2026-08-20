"use client";

import * as React from "react";
import { Bot, Gavel } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { loadBidHistory } from "@/app/actions/bidding";
import { useAuctionStream } from "@/hooks/use-auction-stream";
import { formatMoney } from "@/lib/money";
import { cn, formatDateTime, relativeTime } from "@/lib/utils";

export type BidRow = {
  id: string;
  amount: number;
  createdAt: string;
  status: string;
  isAutoBid: boolean;
  label: string;
};

/**
 * The public ledger for a lot. Server-rendered for the first page, then kept
 * current from the live feed. Bidder identities arrive already masked from the
 * query layer — this component never sees a real name.
 */
export function BidHistory({
  auctionId,
  initialBids,
  initialCursor,
  initialHasMore,
  currency,
  live,
}: {
  auctionId: string;
  initialBids: BidRow[];
  initialCursor?: string;
  initialHasMore: boolean;
  currency: string;
  live: boolean;
}) {
  const [bids, setBids] = React.useState(initialBids);
  const [cursor, setCursor] = React.useState(initialCursor);
  const [hasMore, setHasMore] = React.useState(initialHasMore);
  const [loading, setLoading] = React.useState(false);
  const [flashId, setFlashId] = React.useState<string | null>(null);

  // A new bid arriving over the feed is prepended optimistically; the exact
  // row (with its id) lands on the next server refresh.
  useAuctionStream({
    auctionId,
    enabled: live,
    initial: {
      currentBid: initialBids[0]?.amount ?? null,
      bidCount: initialBids.length,
      minimumNextBid: 0,
      endAt: new Date().toISOString(),
      status: "LIVE",
    },
    onBid: React.useCallback(
      (event: { bidderId: string; bidderLabel: string; amount: number }) => {
        const optimisticId = `live-${event.amount}`;
        setBids((current) => {
          if (current[0]?.amount === event.amount) return current;
          return [
            {
              id: optimisticId,
              amount: event.amount,
              createdAt: new Date().toISOString(),
              status: "WINNING",
              isAutoBid: false,
              label: event.bidderLabel,
            },
            ...current.map((bid) =>
              bid.status === "WINNING" ? { ...bid, status: "OUTBID" } : bid,
            ),
          ];
        });
        setFlashId(optimisticId);
        setTimeout(() => setFlashId(null), 1200);
      },
      [],
    ),
  });

  React.useEffect(() => {
    setBids(initialBids);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
  }, [initialBids, initialCursor, initialHasMore]);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    const page = await loadBidHistory(auctionId, cursor);
    setBids((current) => [...current, ...page.bids]);
    setCursor(page.nextCursor);
    setHasMore(page.hasMore);
    setLoading(false);
  }

  if (bids.length === 0) {
    return (
      <EmptyState
        icon={<Gavel className="size-7" strokeWidth={1.25} />}
        title="No bids yet"
        description="Be the first to bid on this lot. Every bid placed is recorded here with its timestamp."
      />
    );
  }

  return (
    <div>
      <ol className="overflow-hidden rounded-sm border border-line bg-surface">
        {bids.map((bid, index) => (
          <li
            key={bid.id}
            className={cn(
              "flex items-center gap-4 px-4 py-3.5 sm:px-5",
              index > 0 && "border-t border-line",
              flashId === bid.id && "animate-[bid-flash_1.2s_ease-out]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                bid.status === "WINNING"
                  ? "bg-positive"
                  : bid.status === "WON"
                    ? "bg-accent"
                    : "bg-line-strong",
              )}
            />

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[0.875rem] text-ink">
                {bid.label}
                {bid.isAutoBid ? (
                  <span
                    title="Placed automatically from a standing maximum"
                    className="inline-flex items-center gap-1 rounded-[2px] bg-sunken px-1.5 py-0.5 text-[0.625rem] uppercase tracking-[0.08em] text-faint"
                  >
                    <Bot className="size-2.5" />
                    Auto
                  </span>
                ) : null}
              </p>
              <p
                className="text-[0.75rem] text-faint"
                title={formatDateTime(bid.createdAt)}
              >
                {relativeTime(bid.createdAt)}
              </p>
            </div>

            <div className="shrink-0 text-right">
              <p className="font-display text-lg leading-none text-ink tabular">
                {formatMoney(bid.amount, currency)}
              </p>
              {bid.status === "WINNING" || bid.status === "WON" ? (
                <p
                  className={cn(
                    "mt-1 text-[0.625rem] uppercase tracking-[0.1em]",
                    bid.status === "WON" ? "text-accent" : "text-positive",
                  )}
                >
                  {bid.status === "WON" ? "Winning bid" : "Leading"}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {hasMore ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 w-full"
          onClick={loadMore}
          disabled={loading}
        >
          {loading ? "Loading…" : "Show earlier bids"}
        </Button>
      ) : null}
    </div>
  );
}
