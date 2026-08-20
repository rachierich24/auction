import Image from "next/image";
import Link from "next/link";

import { Countdown } from "@/components/auction/countdown";
import { StatusBadge } from "@/components/auction/status-badge";
import { formatMoney } from "@/lib/money";
import { cn, formatDateTime, pluralize } from "@/lib/utils";
import type { AuctionCard as AuctionCardModel } from "@/lib/auction/queries";

export function AuctionCard({
  auction,
  priority = false,
  className,
}: {
  auction: AuctionCardModel;
  priority?: boolean;
  className?: string;
}) {
  const closed =
    auction.status === "ENDED" ||
    auction.status === "SOLD" ||
    auction.status === "UNSOLD";
  const upcoming = auction.status === "UPCOMING";

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-sm border border-line bg-surface",
        "transition-[box-shadow,border-color,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:border-line-strong hover:shadow-lift",
        className,
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
        {auction.image ? (
          <Image
            src={auction.image.url}
            alt={auction.image.alt}
            fill
            priority={priority}
            sizes="(min-width: 1280px) 22rem, (min-width: 768px) 33vw, 100vw"
            className={cn(
              "object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]",
              "group-hover:scale-[1.045]",
              closed && "opacity-85 saturate-[0.75]",
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="font-display text-sm text-faint">No image</span>
          </div>
        )}

        <div className="absolute left-3 top-3">
          <StatusBadge status={auction.status} />
        </div>

        <div className="absolute right-3 top-3 rounded-[2px] bg-ink/80 px-2 py-1 text-[0.625rem] font-medium uppercase tracking-[0.1em] text-white backdrop-blur-sm">
          Lot {auction.lotNumber}
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow">{auction.category.name}</p>

        <h3 className="mt-2 font-display text-xl leading-snug tracking-tight text-ink">
          {/* Stretched link keeps the whole card clickable without nesting
              interactive elements inside an anchor. */}
          <Link href={`/auction/${auction.slug}`} className="after:absolute after:inset-0">
            {auction.title}
          </Link>
        </h3>

        <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-relaxed text-muted">
          {auction.shortDescription}
        </p>

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
              {closed
                ? auction.status === "SOLD"
                  ? "Hammer price"
                  : "Final bid"
                : auction.currentBid !== null
                  ? "Current bid"
                  : "Starting bid"}
            </p>
            <p className="mt-1 font-display text-[1.375rem] leading-none tracking-tight text-ink tabular">
              {formatMoney(
                auction.currentBid ?? auction.startingPrice,
                auction.currency,
              )}
            </p>
            <p className="mt-1.5 text-[0.6875rem] text-faint tabular">
              {auction.bidCount > 0
                ? `${auction.bidCount} ${pluralize(auction.bidCount, "bid")}`
                : upcoming
                  ? `Opens ${formatDateTime(auction.startAt, { dateStyle: "medium", timeStyle: "short" })}`
                  : "No bids yet"}
            </p>
          </div>

          <div className="text-right">
            {closed ? (
              <p className="text-[0.8125rem] text-muted">
                {auction.status === "SOLD"
                  ? "Sold"
                  : auction.status === "UNSOLD"
                    ? "Reserve not met"
                    : "Closed"}
              </p>
            ) : upcoming ? (
              <>
                <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
                  Opens in
                </p>
                <Countdown endAt={auction.startAt} className="text-[0.9375rem]" />
              </>
            ) : (
              <>
                <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
                  Closes in
                </p>
                <Countdown endAt={auction.endAt} className="text-[0.9375rem]" />
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function AuctionCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-surface">
      <div className="skeleton aspect-[4/3]" />
      <div className="space-y-3 p-5">
        <div className="skeleton h-2.5 w-20 rounded-full" />
        <div className="skeleton h-5 w-4/5 rounded-sm" />
        <div className="skeleton h-3 w-full rounded-sm" />
        <div className="flex justify-between border-t border-line pt-4">
          <div className="space-y-2">
            <div className="skeleton h-2.5 w-16 rounded-full" />
            <div className="skeleton h-6 w-24 rounded-sm" />
          </div>
          <div className="skeleton h-6 w-16 self-end rounded-sm" />
        </div>
      </div>
    </div>
  );
}
