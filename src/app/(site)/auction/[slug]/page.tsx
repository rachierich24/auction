import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";

import { AuctionRail } from "@/components/auction/auction-rail";
import { BidHistory } from "@/components/auction/bid-history";
import { BidPanel } from "@/components/auction/bid-panel";
import { ImageGallery } from "@/components/auction/image-gallery";
import { DescriptionList } from "@/components/ui/primitives";
import { getSessionUser } from "@/lib/auth/session";
import {
  getAuctionBySlug,
  getRelatedAuctions,
  isWatching,
  recordView,
} from "@/lib/auction/queries";
import { getBidHistory, getProxyBid } from "@/lib/bidding/engine";
import { buyerPremiumFor, formatBps, formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const auction = await getAuctionBySlug(slug);
  if (!auction) return { title: "Lot not found" };

  const image = auction.images[0]?.url;
  const price = formatMoney(
    auction.currentBid ?? auction.startingPrice,
    auction.currency,
  );

  return {
    title: `${auction.title} — Lot ${auction.lotNumber}`,
    description: auction.shortDescription,
    alternates: { canonical: `/auction/${auction.slug}` },
    openGraph: {
      type: "article",
      title: `${auction.title} — Lot ${auction.lotNumber}`,
      description: `${auction.shortDescription} Current bid ${price}.`,
      url: `/auction/${auction.slug}`,
      ...(image ? { images: [{ url: image, alt: auction.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: `${auction.title} — Lot ${auction.lotNumber}`,
      description: auction.shortDescription,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function AuctionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;

  const auction = await getAuctionBySlug(slug);
  if (!auction) notFound();

  const user = await getSessionUser();

  const [history, watching, proxy, related] = await Promise.all([
    getBidHistory(auction.id, 8),
    isWatching(user?.id, auction.id),
    user ? getProxyBid(auction.id, user.id) : Promise.resolve(null),
    getRelatedAuctions(auction.id, auction.categoryId),
  ]);

  // Fire-and-forget; a failed counter must never block the page.
  void recordView(auction.id);

  const isOpen =
    auction.displayStatus === "LIVE" ||
    auction.displayStatus === "ENDING_SOON" ||
    auction.displayStatus === "EXTENDED";

  const premium = buyerPremiumFor(
    auction.currentBid ?? auction.startingPrice,
    auction.buyerPremiumBps,
  );

  // Structured data helps the lot surface correctly in search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: auction.title,
    description: auction.shortDescription,
    sku: auction.lotNumber,
    category: auction.category.name,
    image: auction.images.map((image) => image.url),
    offers: {
      "@type": "Offer",
      priceCurrency: auction.currency,
      price: ((auction.currentBid ?? auction.startingPrice) / 100).toFixed(2),
      availability: isOpen
        ? "https://schema.org/InStock"
        : "https://schema.org/SoldOut",
      priceValidUntil: auction.endAt.toISOString(),
      url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/auction/${auction.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Values come from our own database and are serialised, not interpolated.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="gutter mx-auto flex max-w-[110rem] items-center gap-2 py-5 text-[0.75rem] text-muted"
      >
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        <ChevronRight className="size-3 text-line-strong" />
        <Link href="/auctions" className="hover:text-ink">
          Auctions
        </Link>
        <ChevronRight className="size-3 text-line-strong" />
        <Link
          href={`/auctions?category=${auction.category.slug}`}
          className="hover:text-ink"
        >
          {auction.category.name}
        </Link>
        <ChevronRight className="size-3 text-line-strong" />
        <span className="truncate text-faint">Lot {auction.lotNumber}</span>
      </nav>

      <div className="gutter mx-auto max-w-[110rem] pb-24 lg:pb-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:gap-14">
          {/* ------------------------------------------------------------ */}
          {/* Left: gallery + editorial                                     */}
          {/* ------------------------------------------------------------ */}
          <div className="min-w-0">
            <ImageGallery
              images={auction.images.map((image) => ({
                id: image.id,
                url: image.url,
                altText: image.altText,
              }))}
              title={auction.title}
            />

            <section className="mt-14">
              <h2 className="font-display text-2xl tracking-tight text-ink">
                Description
              </h2>
              <div className="mt-5 space-y-4 text-[0.9375rem] leading-[1.75] text-ink-soft text-pretty">
                {auction.description.split(/\n{2,}/).map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </section>

            {auction.specs.length > 0 ? (
              <section className="mt-14">
                <h2 className="font-display text-2xl tracking-tight text-ink">
                  Specifications
                </h2>
                <DescriptionList
                  className="mt-5"
                  items={auction.specs.map((spec) => ({
                    label: spec.label,
                    value: spec.value,
                  }))}
                />
              </section>
            ) : null}

            <section className="mt-14">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="font-display text-2xl tracking-tight text-ink">
                  Bid history
                </h2>
                <p className="text-[0.75rem] text-faint">
                  Bidder identities are masked
                </p>
              </div>
              <div className="mt-5">
                <BidHistory
                  auctionId={auction.id}
                  currency={auction.currency}
                  live={isOpen}
                  initialBids={history.bids.map((bid) => ({
                    id: bid.id,
                    amount: bid.amount,
                    createdAt: bid.createdAt.toISOString(),
                    status: bid.status,
                    isAutoBid: bid.isAutoBid,
                    label: bid.label,
                  }))}
                  initialCursor={history.nextCursor}
                  initialHasMore={history.hasMore}
                />
              </div>
            </section>

            <section className="mt-14">
              <h2 className="font-display text-2xl tracking-tight text-ink">
                Auction information
              </h2>
              <DescriptionList
                className="mt-5"
                items={[
                  { label: "Auction starts", value: formatDateTime(auction.startAt) },
                  { label: "Auction ends", value: formatDateTime(auction.endAt) },
                  {
                    label: "Bid increment",
                    value: formatMoney(auction.minimumIncrement, auction.currency),
                  },
                  {
                    label: "Buyer's premium",
                    value: `${formatBps(auction.buyerPremiumBps)} (${formatMoney(premium, auction.currency)} at current bid)`,
                  },
                  {
                    label: "Reserve",
                    value: auction.hasReserve
                      ? auction.reserveMet
                        ? "Reserve met"
                        : "Reserve not yet met"
                      : "No reserve",
                  },
                  {
                    label: "Anti-snipe extension",
                    value: auction.extensionEnabled
                      ? `Bids in the final ${Math.round(auction.extensionThresholdSec / 60)} min extend by ${Math.round(auction.extensionDurationSec / 60)} min`
                      : "Not enabled",
                  },
                  ...(auction.extensionCount > 0
                    ? [
                        {
                          label: "Extensions triggered",
                          value: String(auction.extensionCount),
                        },
                      ]
                    : []),
                  ...(auction.location
                    ? [{ label: "Location", value: auction.location }]
                    : []),
                ]}
              />

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <InfoBlock
                  title="Shipping"
                  body={
                    auction.shippingNote ??
                    "Shipping is arranged after settlement. Collection in person can be scheduled with the saleroom at no charge."
                  }
                />
                <InfoBlock
                  title="Payment"
                  body={
                    auction.paymentNote ??
                    "Payment is due within 5 business days of the sale closing. The invoice itemises the hammer price and the buyer's premium separately."
                  }
                />
              </div>
            </section>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Right: identity + bidding                                     */}
          {/* ------------------------------------------------------------ */}
          <div className="min-w-0">
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <span className="text-[0.6875rem] uppercase tracking-[0.12em] text-accent">
                  Lot {auction.lotNumber}
                </span>
                <span className="h-px flex-1 bg-line" />
                <Link
                  href={`/auctions?category=${auction.category.slug}`}
                  className="text-[0.6875rem] uppercase tracking-[0.12em] text-faint hover:text-ink"
                >
                  {auction.category.name}
                </Link>
              </div>

              <h1 className="mt-4 font-display text-[2.25rem] leading-[1.05] tracking-tight text-ink sm:text-[2.75rem] text-balance">
                {auction.title}
              </h1>

              <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted text-pretty">
                {auction.shortDescription}
              </p>
            </div>

            <BidPanel
              auctionId={auction.id}
              slug={auction.slug}
              currency={auction.currency}
              status={auction.displayStatus}
              startAt={auction.startAt.toISOString()}
              endAt={auction.endAt.toISOString()}
              startingPrice={auction.startingPrice}
              currentBid={auction.currentBid}
              minimumIncrement={auction.minimumIncrement}
              minimumNextBid={auction.minimumNextBid}
              bidCount={auction.bidCount}
              hasReserve={auction.hasReserve}
              reserveMet={auction.reserveMet}
              proxyBiddingEnabled={auction.proxyBiddingEnabled}
              watchlistEnabled={auction.watchlistEnabled}
              isWatching={watching}
              isSignedIn={Boolean(user)}
              isLeading={Boolean(user && auction.highestBidderId === user.id)}
              existingMaximum={proxy?.active ? proxy.maxAmount : null}
            />
          </div>
        </div>
      </div>

      <AuctionRail
        eyebrow="Also in this department"
        title={`More from ${auction.category.name}`}
        auctions={related}
        href={`/auctions?category=${auction.category.slug}`}
        className="border-t border-line"
      />
    </>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-5">
      <p className="eyebrow">{title}</p>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted text-pretty">
        {body}
      </p>
    </div>
  );
}
