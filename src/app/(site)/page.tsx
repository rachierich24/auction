import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Gavel, ScrollText, ShieldCheck, Timer } from "lucide-react";

import { AuctionRail } from "@/components/auction/auction-rail";
import { Countdown } from "@/components/auction/countdown";
import { StatusBadge } from "@/components/auction/status-badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/primitives";
import { getContent } from "@/lib/content/site-content";
import { getHeroAuction, getHomeRails, getCategories } from "@/lib/auction/queries";
import { formatMoney } from "@/lib/money";
import { pluralize } from "@/lib/utils";

// The homepage reflects live bidding, so it is rendered per request rather than
// cached. Individual queries are small and indexed.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [hero, trust, howItWorks, heroLot, rails, categories] = await Promise.all([
    getContent("hero"),
    getContent("trust"),
    getContent("howItWorks"),
    getHeroAuction(),
    getHomeRails(),
    getCategories(),
  ]);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Hero                                                              */}
      {/* ---------------------------------------------------------------- */}
      <section className="gutter mx-auto max-w-[110rem] pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div className="animate-[fade-up_0.6s_cubic-bezier(0.22,1,0.36,1)_both]">
            <p className="eyebrow">{hero.eyebrow}</p>

            <h1 className="mt-6 font-display text-[3.25rem] leading-[0.95] tracking-[-0.025em] text-ink sm:text-[4.5rem] lg:text-[5.25rem] text-balance">
              {hero.headline}
            </h1>

            <p className="mt-7 max-w-xl text-[1.0625rem] leading-relaxed text-muted text-pretty">
              {hero.body}
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="primary">
                <Link href={hero.primaryCta.href}>
                  {hero.primaryCta.label}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={hero.secondaryCta.href}>{hero.secondaryCta.label}</Link>
              </Button>
            </div>

            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-8">
              <Stat label="Lots live now" value={String(rails.live.length)} />
              <Stat label="Opening shortly" value={String(rails.upcoming.length)} />
              <Stat label="Departments" value={String(categories.length)} />
            </dl>
          </div>

          {heroLot ? <HeroLot lot={heroLot} /> : <HeroPlaceholder />}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Departments                                                       */}
      {/* ---------------------------------------------------------------- */}
      {categories.length > 0 ? (
        <section className="border-y border-line bg-surface">
          <div className="gutter mx-auto max-w-[110rem] py-6">
            <div className="hide-scrollbar flex items-center gap-8 overflow-x-auto">
              <span className="eyebrow shrink-0">Departments</span>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/auctions?category=${category.slug}`}
                  className="group flex shrink-0 items-baseline gap-2 whitespace-nowrap text-[0.875rem] text-muted transition-colors hover:text-ink"
                >
                  {category.name}
                  <span className="text-[0.6875rem] text-faint tabular group-hover:text-accent">
                    {category._count.auctions}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {/* Rails                                                             */}
      {/* ---------------------------------------------------------------- */}
      <AuctionRail
        eyebrow="Bidding open"
        title="Live auctions"
        description="Lots currently accepting bids. Every bid is timestamped by the server and visible in the lot's public ledger."
        auctions={rails.live}
        href="/auctions?status=live"
        linkLabel="All live lots"
        priority
      />

      <AuctionRail
        eyebrow="Closing shortly"
        title="Ending soon"
        description="Final calls. A bid placed inside the closing window extends the lot, so the highest bidder wins — not the fastest connection."
        auctions={rails.endingSoon}
        href="/auctions?status=ending-soon"
        className="border-t border-line"
      />

      <AuctionRail
        eyebrow="Catalogue"
        title="Featured lots"
        description="Selected highlights from the current and forthcoming sales."
        auctions={rails.featured}
        columns={3}
        href="/auctions"
      />

      <AuctionRail
        eyebrow="Opening shortly"
        title="Upcoming auctions"
        description="Catalogued and scheduled. Add a lot to your watchlist and you will be notified the moment bidding opens."
        auctions={rails.upcoming}
        href="/auctions?status=upcoming"
        className="border-t border-line"
      />

      {/* ---------------------------------------------------------------- */}
      {/* How it works                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="border-y border-line bg-surface">
        <div className="gutter mx-auto max-w-[110rem] py-20">
          <SectionHeading
            eyebrow="Process"
            title={howItWorks.heading}
            description={howItWorks.body}
          />

          <ol className="mt-12 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.steps.map((step, index) => (
              <li key={step.title} className="bg-surface p-7">
                <span className="font-display text-3xl leading-none text-accent tabular">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 font-display text-xl tracking-tight text-ink">
                  {step.title}
                </h3>
                <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Trust                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="gutter mx-auto max-w-[110rem] py-20">
        <SectionHeading
          eyebrow="Trust & security"
          title={trust.heading}
          description={trust.body}
        />

        <div className="mt-12 grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {trust.points.map((point, index) => (
            <div key={point.title}>
              <span className="inline-flex size-10 items-center justify-center rounded-sm border border-line bg-surface text-accent">
                {[
                  <Timer key="t" className="size-4" />,
                  <ScrollText key="s" className="size-4" />,
                  <Gavel key="g" className="size-4" />,
                  <ShieldCheck key="sh" className="size-4" />,
                ][index % 4]}
              </span>
              <h3 className="mt-5 font-display text-xl tracking-tight text-ink">
                {point.title}
              </h3>
              <p className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted text-pretty">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <AuctionRail
        eyebrow="Results"
        title="Recently sold"
        description="Hammer prices from lots settled in recent sales."
        auctions={rails.recentlySold}
        href="/auctions?status=ended"
        linkLabel="All results"
        className="border-t border-line"
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
        {label}
      </dt>
      <dd className="mt-1.5 font-display text-3xl leading-none tracking-tight text-ink tabular">
        {value}
      </dd>
    </div>
  );
}

function HeroLot({
  lot,
}: {
  lot: NonNullable<Awaited<ReturnType<typeof getHeroAuction>>>;
}) {
  const upcoming = lot.status === "UPCOMING";

  return (
    <div className="relative animate-[fade-up_0.7s_cubic-bezier(0.22,1,0.36,1)_0.1s_both]">
      <Link href={`/auction/${lot.slug}`} className="group block">
        <div className="relative aspect-[5/4] overflow-hidden rounded-sm bg-sunken shadow-lift">
          {lot.image ? (
            <Image
              src={lot.image.url}
              alt={lot.image.alt}
              fill
              priority
              sizes="(min-width: 1024px) 52vw, 100vw"
              className="kenburns object-cover"
            />
          ) : null}

          {/* Legibility scrim for the caption panel below the image. */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-ink/55 to-transparent" />

          <div className="absolute left-5 top-5">
            <StatusBadge status={lot.status} />
          </div>

          <div className="absolute inset-x-5 bottom-5 text-white">
            <p className="text-[0.625rem] uppercase tracking-[0.16em] text-white/70">
              Lot {lot.lotNumber} · {lot.category.name}
            </p>
            <h2 className="mt-2 font-display text-2xl leading-tight tracking-tight sm:text-3xl">
              {lot.title}
            </h2>
          </div>
        </div>
      </Link>

      <div className="mt-px flex flex-wrap items-center justify-between gap-6 rounded-b-sm border border-t-0 border-line bg-surface px-6 py-5">
        <div>
          <p className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
            {lot.currentBid !== null ? "Current bid" : "Starting bid"}
          </p>
          <p className="mt-1 font-display text-2xl leading-none tracking-tight text-ink tabular">
            {formatMoney(lot.currentBid ?? lot.startingPrice, lot.currency)}
          </p>
          <p className="mt-1.5 text-[0.6875rem] text-faint tabular">
            {lot.bidCount} {pluralize(lot.bidCount, "bid")}
          </p>
        </div>

        <div>
          <p className="text-[0.6875rem] uppercase tracking-[0.11em] text-faint">
            {upcoming ? "Opens in" : "Closes in"}
          </p>
          <Countdown
            endAt={upcoming ? lot.startAt : lot.endAt}
            variant="large"
            className="mt-1.5"
          />
        </div>

        <Button asChild variant="accent" size="md" className="ml-auto">
          <Link href={`/auction/${lot.slug}`}>
            View lot
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HeroPlaceholder() {
  return (
    <div className="flex aspect-[5/4] items-center justify-center rounded-sm border border-dashed border-line-strong bg-raised">
      <div className="text-center">
        <p className="font-display text-2xl text-ink">The catalogue is being prepared</p>
        <p className="mt-2 text-sm text-muted">
          Lots for the next sale will appear here shortly.
        </p>
      </div>
    </div>
  );
}
