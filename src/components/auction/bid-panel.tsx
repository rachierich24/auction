"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Lock, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, Input } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { Countdown } from "@/components/auction/countdown";
import { StatusBadge } from "@/components/auction/status-badge";
import { useAuctionStream } from "@/hooks/use-auction-stream";
import {
  cancelMaximumBid,
  placeBidAction,
  toggleWatchlist,
} from "@/app/actions/bidding";
import { currencySymbol, formatMoney, formatMoneyPlain } from "@/lib/money";
import type { DisplayStatus } from "@/lib/auction/status";
import { cn, pluralize } from "@/lib/utils";

type Props = {
  auctionId: string;
  slug: string;
  currency: string;
  status: DisplayStatus;
  startAt: string;
  endAt: string;
  startingPrice: number;
  currentBid: number | null;
  minimumIncrement: number;
  minimumNextBid: number;
  bidCount: number;
  hasReserve: boolean;
  reserveMet: boolean | null;
  proxyBiddingEnabled: boolean;
  watchlistEnabled: boolean;
  isWatching: boolean;
  isSignedIn: boolean;
  /** True when the viewer currently holds the leading bid. */
  isLeading: boolean;
  existingMaximum: number | null;
};

export function BidPanel(props: Props) {
  const router = useRouter();
  const toast = useToast();

  const [amount, setAmount] = React.useState("");
  const [maximum, setMaximum] = React.useState("");
  const [useMaximum, setUseMaximum] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [leading, setLeading] = React.useState(props.isLeading);
  const [watching, setWatching] = React.useState(props.isWatching);
  const [maximumSet, setMaximumSet] = React.useState(props.existingMaximum);
  const [watchPending, startWatchTransition] = React.useTransition();

  const isOpen =
    props.status === "LIVE" ||
    props.status === "ENDING_SOON" ||
    props.status === "EXTENDED";

  const { state, applyLocal } = useAuctionStream({
    auctionId: props.auctionId,
    enabled: isOpen,
    initial: {
      currentBid: props.currentBid,
      bidCount: props.bidCount,
      minimumNextBid: props.minimumNextBid,
      endAt: props.endAt,
      status: props.status,
    },
    onBid: React.useCallback(
      (event: { bidderId: string; bidderLabel: string; amount: number }) => {
        // Someone else moved the price: drop the stale draft so the bidder
        // cannot submit a number that is no longer valid.
        setLeading(false);
        setAmount("");
        setNotice(
          `${event.bidderLabel} bid ${formatMoney(event.amount, props.currency)}.`,
        );
      },
      [props.currency],
    ),
    onExtended: React.useCallback(() => {
      setNotice("A late bid extended the closing time.");
    }, []),
    onStatus: React.useCallback(() => {
      router.refresh();
    }, [router]),
  });

  const symbol = currencySymbol(props.currency);
  const nextBid = state.minimumNextBid;
  const priceRef = React.useRef<HTMLParagraphElement>(null);

  // Flash the price when it changes from someone else's bid.
  React.useEffect(() => {
    if (!state.lastEventAt || !priceRef.current) return;
    const node = priceRef.current;
    node.style.animation = "none";
    void node.offsetWidth;
    node.style.animation = "";
  }, [state.lastEventAt]);

  const quickBids = React.useMemo(() => {
    const increments = [0, 1, 2, 4];
    return increments.map((step) => nextBid + step * props.minimumIncrement);
  }, [nextBid, props.minimumIncrement]);

  function openConfirm() {
    setError(null);

    const parsed = Number(amount.replace(/[^\d.]/g, ""));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a bid amount.");
      return;
    }
    if (Math.round(parsed * 100) < nextBid) {
      setError(`Your bid must be at least ${formatMoney(nextBid, props.currency)}.`);
      return;
    }
    if (useMaximum) {
      const max = Number(maximum.replace(/[^\d.]/g, ""));
      if (!Number.isFinite(max) || Math.round(max * 100) <= Math.round(parsed * 100)) {
        setError("Your maximum must be higher than the bid you are placing.");
        return;
      }
    }
    setConfirming(true);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);

    const response = await placeBidAction({
      auctionId: props.auctionId,
      amount,
      maxAmount: useMaximum ? maximum : null,
    });

    setSubmitting(false);
    setConfirming(false);

    if (!response.ok) {
      // The engine returns the live figures with every rejection, so the panel
      // re-syncs to the truth even when the bid failed.
      if (response.currentBid !== null && response.minimumNextBid !== null) {
        applyLocal({
          currentBid: response.currentBid,
          minimumNextBid: response.minimumNextBid,
          endAt: response.endAt ?? state.endAt,
          status: response.status ?? state.status,
        });
      }
      setError(response.message);

      if (response.code === "UNAUTHENTICATED") {
        router.push(`/login?next=/auction/${props.slug}`);
        return;
      }
      if (response.code === "CONCURRENT_UPDATE" || response.code === "BID_TOO_LOW") {
        setAmount("");
      }
      if (response.code === "CLOSED" || response.code === "NOT_LIVE") {
        router.refresh();
      }
      toast.error("Bid not placed", response.message);
      return;
    }

    applyLocal({
      currentBid: response.currentBid,
      bidCount: response.bidCount,
      minimumNextBid: response.minimumNextBid,
      endAt: response.endAt,
      status: response.status,
    });
    setLeading(!response.outbidByProxy);
    setAmount("");
    if (useMaximum) {
      setMaximumSet(Math.round(Number(maximum.replace(/[^\d.]/g, "")) * 100));
      setMaximum("");
      setUseMaximum(false);
    }
    setNotice(null);

    if (response.outbidByProxy) {
      toast.info("Bid placed", response.message);
    } else {
      toast.success("Bid placed successfully.", response.message);
    }
    router.refresh();
  }

  function onToggleWatch() {
    startWatchTransition(async () => {
      const result = await toggleWatchlist(props.auctionId);
      if (!result.ok) {
        toast.error("Not saved", result.message);
        return;
      }
      setWatching(result.watching);
      toast.success(result.message);
    });
  }

  async function withdrawMaximum() {
    const result = await cancelMaximumBid(props.auctionId);
    if (result.ok) {
      setMaximumSet(null);
      toast.success(result.message);
    }
  }

  /* ---------------------------------------------------------------------- */

  return (
    <div className="lg:sticky lg:top-28">
      <div className="rounded-sm border border-line bg-surface shadow-card">
        {/* Header: status + countdown */}
        <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
          <StatusBadge status={state.status as DisplayStatus} />
          <div className="flex items-center gap-2 text-[0.75rem] text-faint">
            {isOpen ? (
              <>
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    state.connected ? "bg-positive" : "bg-line-strong",
                  )}
                  aria-hidden
                />
                {state.connected ? "Live" : "Reconnecting…"}
              </>
            ) : null}
          </div>
        </div>

        {/* Price block */}
        <div className="px-6 py-6">
          <p className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
            {state.currentBid !== null ? "Current bid" : "Starting bid"}
          </p>
          <p
            ref={priceRef}
            key={state.currentBid ?? "none"}
            className="mt-1.5 font-display text-[2.75rem] leading-none tracking-tight text-ink tabular animate-[bid-flash_1.1s_cubic-bezier(0.22,1,0.36,1)]"
          >
            {formatMoney(state.currentBid ?? props.startingPrice, props.currency)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.8125rem] text-muted tabular">
            <span>
              {state.bidCount} {pluralize(state.bidCount, "bid")}
            </span>
            <span className="text-line-strong">·</span>
            <span>Starting {formatMoney(props.startingPrice, props.currency)}</span>
            {props.hasReserve ? (
              <>
                <span className="text-line-strong">·</span>
                <span
                  className={cn(
                    state.currentBid !== null && props.reserveMet
                      ? "text-positive"
                      : "text-caution",
                  )}
                >
                  {props.reserveMet ? "Reserve met" : "Reserve not met"}
                </span>
              </>
            ) : (
              <>
                <span className="text-line-strong">·</span>
                <span>No reserve</span>
              </>
            )}
          </div>

          {leading && isOpen ? (
            <Alert tone="positive" className="mt-5">
              You hold the leading bid on this lot.
            </Alert>
          ) : null}

          {maximumSet ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-sm border border-accent/30 bg-accent-wash px-4 py-3">
              <p className="text-[0.8125rem] text-accent-deep">
                Standing maximum {formatMoney(maximumSet, props.currency)}
              </p>
              <button
                type="button"
                onClick={withdrawMaximum}
                className="text-[0.75rem] text-accent-deep underline underline-offset-4 hover:text-ink"
              >
                Withdraw
              </button>
            </div>
          ) : null}
        </div>

        {/* Countdown */}
        <div className="border-y border-line bg-raised px-6 py-5">
          <p className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
            {props.status === "UPCOMING" ? "Bidding opens in" : "Bidding closes in"}
          </p>
          <Countdown
            endAt={props.status === "UPCOMING" ? props.startAt : state.endAt}
            variant="large"
            className="mt-3"
            onExpire={() => router.refresh()}
          />
        </div>

        {/* Bid form */}
        <div className="px-6 py-6">
          {props.status === "UPCOMING" ? (
            <Alert tone="neutral" title="Opening soon">
              This lot is catalogued and scheduled. Add it to your watchlist and
              we will notify you the moment bidding opens.
            </Alert>
          ) : !isOpen ? (
            <Alert tone="neutral" title="This auction has ended.">
              {props.status === "SOLD"
                ? "The lot was sold to the highest bidder."
                : props.status === "UNSOLD"
                  ? "Reserve price not met — the lot did not sell."
                  : "Bidding is closed for this lot."}
            </Alert>
          ) : !props.isSignedIn ? (
            <div>
              <Alert tone="neutral" className="mb-4">
                <span className="flex items-center gap-2">
                  <Lock className="size-3.5 shrink-0" />
                  Sign in to place a bid.
                </span>
              </Alert>
              <div className="flex flex-col gap-2">
                <Button asChild variant="accent" size="lg" className="w-full">
                  <Link href={`/login?next=/auction/${props.slug}`}>Sign in to bid</Link>
                </Button>
                <Button asChild variant="outline" size="md" className="w-full">
                  <Link href="/register">Create an account</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <label
                  htmlFor="bid-amount"
                  className="text-[0.8125rem] font-medium text-ink-soft"
                >
                  Your bid
                </label>
                <p className="text-[0.75rem] text-muted tabular">
                  {formatMoney(nextBid, props.currency)} or more
                </p>
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-display text-lg text-muted">
                  {symbol}
                </span>
                <Input
                  id="bid-amount"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value.replace(/[^\d.,]/g, ""));
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      openConfirm();
                    }
                  }}
                  placeholder={formatMoneyPlain(nextBid, props.currency)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "bid-error" : undefined}
                  className="h-14 pl-10 text-lg tabular"
                />
              </div>

              {/* Quick increments */}
              <div className="mt-3 grid grid-cols-4 gap-2">
                {quickBids.map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setAmount(formatMoneyPlain(value, props.currency).replace(/,/g, ""));
                      setError(null);
                    }}
                    className="rounded-sm border border-line-strong bg-surface py-2 text-[0.75rem] text-ink-soft tabular transition-colors hover:border-ink hover:bg-raised"
                  >
                    {index === 0 ? "Min" : `+${index === 1 ? 1 : index === 2 ? 2 : 4}×`}
                  </button>
                ))}
              </div>

              {/* Proxy bidding */}
              {props.proxyBiddingEnabled ? (
                <div className="mt-4">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={useMaximum}
                      onChange={(event) => setUseMaximum(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[var(--color-accent)]"
                    />
                    <span className="text-[0.8125rem] leading-snug text-muted">
                      Set a maximum and let the saleroom bid for me
                      <span className="mt-0.5 block text-xs text-faint">
                        We bid the minimum needed to keep you in front, never
                        above your ceiling.
                      </span>
                    </span>
                  </label>

                  {useMaximum ? (
                    <div className="relative mt-3">
                      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">
                        {symbol}
                      </span>
                      <Input
                        inputMode="decimal"
                        value={maximum}
                        onChange={(event) =>
                          setMaximum(event.target.value.replace(/[^\d.,]/g, ""))
                        }
                        placeholder="Your maximum"
                        aria-label="Maximum bid"
                        className="pl-9 tabular"
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {error ? (
                <p
                  id="bid-error"
                  role="alert"
                  className="mt-4 rounded-sm border border-live/25 bg-live-wash px-3.5 py-2.5 text-[0.8125rem] text-live"
                >
                  {error}
                </p>
              ) : notice ? (
                <p className="mt-4 flex items-start gap-2 rounded-sm border border-accent/25 bg-accent-wash px-3.5 py-2.5 text-[0.8125rem] text-accent-deep">
                  <TrendingUp className="mt-0.5 size-3.5 shrink-0" />
                  {notice}
                </p>
              ) : null}

              <Button
                variant="accent"
                size="lg"
                className="mt-4 w-full"
                onClick={openConfirm}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Placing bid…
                  </>
                ) : (
                  "Place Bid"
                )}
              </Button>
            </>
          )}

          {props.watchlistEnabled ? (
            <Button
              variant="outline"
              size="md"
              className="mt-2.5 w-full"
              onClick={onToggleWatch}
              disabled={watchPending}
            >
              <Heart
                className={cn("size-4", watching && "fill-live text-live")}
              />
              {watching ? "On your watchlist" : "Add to watchlist"}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Confirmation */}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Confirm your bid</DialogTitle>
            <DialogDescription>
              You are about to place a bid of{" "}
              <strong className="font-medium text-ink tabular">
                {formatMoney(
                  Math.round(Number(amount.replace(/[^\d.]/g, "")) * 100) || 0,
                  props.currency,
                )}
              </strong>
              .
              {useMaximum && maximum ? (
                <>
                  {" "}
                  We will continue bidding on your behalf up to{" "}
                  <strong className="font-medium text-ink tabular">
                    {formatMoney(
                      Math.round(Number(maximum.replace(/[^\d.]/g, "")) * 100) || 0,
                      props.currency,
                    )}
                  </strong>
                  .
                </>
              ) : null}{" "}
              Bids are binding and cannot be retracted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button variant="accent" onClick={submit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Placing…
                </>
              ) : (
                "Confirm bid"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mobile sticky bar */}
      {isOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[0.625rem] uppercase tracking-[0.11em] text-faint">
                Current bid
              </p>
              <p className="truncate font-display text-xl leading-tight text-ink tabular">
                {formatMoney(state.currentBid ?? props.startingPrice, props.currency)}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[0.625rem] uppercase tracking-[0.11em] text-faint">
                Closes
              </p>
              <Countdown endAt={state.endAt} className="text-[0.8125rem]" />
            </div>
            <Button
              variant="accent"
              size="md"
              className="shrink-0"
              onClick={() => {
                if (!props.isSignedIn) {
                  router.push(`/login?next=/auction/${props.slug}`);
                  return;
                }
                document
                  .getElementById("bid-amount")
                  ?.scrollIntoView({ behavior: "smooth", block: "center" });
                document.getElementById("bid-amount")?.focus();
              }}
            >
              Place Bid
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
