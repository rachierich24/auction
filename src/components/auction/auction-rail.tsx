import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { AuctionCard } from "@/components/auction/auction-card";
import { SectionHeading } from "@/components/ui/primitives";
import type { AuctionCard as AuctionCardModel } from "@/lib/auction/queries";
import { cn } from "@/lib/utils";

/**
 * A titled row of lots. Renders nothing when empty rather than showing an
 * apologetic placeholder — an empty rail is simply not part of the sale.
 */
export function AuctionRail({
  eyebrow,
  title,
  description,
  auctions,
  href,
  linkLabel = "View all",
  columns = 4,
  priority = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  auctions: AuctionCardModel[];
  href?: string;
  linkLabel?: string;
  columns?: 3 | 4;
  priority?: boolean;
  className?: string;
}) {
  if (auctions.length === 0) return null;

  return (
    <section className={cn("gutter mx-auto max-w-[110rem] py-16 md:py-20", className)}>
      <SectionHeading
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          href ? (
            <Link
              href={href}
              className="group inline-flex items-center gap-1.5 border-b border-line-strong pb-1 text-[0.8125rem] text-ink transition-colors hover:border-ink"
            >
              {linkLabel}
              <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          ) : null
        }
      />

      <div
        className={cn(
          "mt-10 grid gap-6 sm:grid-cols-2",
          columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {auctions.map((auction, index) => (
          <AuctionCard
            key={auction.id}
            auction={auction}
            priority={priority && index < 2}
          />
        ))}
      </div>
    </section>
  );
}
