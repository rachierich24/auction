import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { AuctionForm } from "@/components/admin/auction-form";
import { auctionValuesFrom } from "@/lib/admin/auction-form-values";
import { AuctionRowActions } from "@/components/admin/auction-row-actions";
import { StatusPill } from "@/components/admin/status-pill";
import { Alert, Badge, DescriptionList } from "@/components/ui/primitives";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { permissionsFor } from "@/lib/auth/rbac";
import { getAdminAuction } from "@/lib/admin/queries";
import { listCategoriesForForm } from "@/app/actions/admin/auctions";
import { listAdminBids } from "@/lib/admin/queries";
import { displayStatus } from "@/lib/auction/status";
import { formatBps, formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auction = await getAdminAuction(id);
  return { title: auction ? `Lot ${auction.lotNumber}` : "Auction" };
}

export default async function AdminAuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("auction.view");
  const permissions = [...permissionsFor(user.role)];

  const auction = await getAdminAuction(id);
  if (!auction) notFound();

  const [categories, recentBids] = await Promise.all([
    listCategoriesForForm(),
    listAdminBids({ auctionId: id, page: 1 }),
  ]);

  const status = displayStatus(auction);
  const readOnly = ["SOLD", "UNSOLD", "CANCELLED"].includes(auction.status);
  const hasBids = auction._count.bids > 0;

  return (
    <>
      <AdminPageHeader
        crumbs={[
          { label: "Auctions", href: "/admin/auctions" },
          { label: `Lot ${auction.lotNumber}` },
        ]}
        eyebrow={auction.category.name}
        title={auction.title}
        description={auction.shortDescription}
        action={
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            <Link
              href={`/auction/${auction.slug}`}
              target="_blank"
              className="inline-flex size-8 items-center justify-center rounded-sm border border-line text-muted transition-colors hover:border-ink hover:text-ink"
              aria-label="View on the public site"
            >
              <ExternalLink className="size-3.5" />
            </Link>
            <AuctionRowActions
              auction={{
                id: auction.id,
                slug: auction.slug,
                lotNumber: auction.lotNumber,
                title: auction.title,
                status: auction.status,
                bidCount: auction._count.bids,
                featured: auction.featured,
              }}
              permissions={permissions}
            />
          </div>
        }
      />

      {/* Live figures */}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        <Figure
          label="Current bid"
          value={formatMoney(auction.currentBid ?? auction.startingPrice, auction.currency)}
          hint={auction.currentBid === null ? "No bids yet" : undefined}
        />
        <Figure label="Bids" value={String(auction._count.bids)} />
        <Figure label="Watching" value={String(auction._count.watchers)} />
        <Figure label="Views" value={String(auction.viewCount)} />
        <Figure
          label="Reserve"
          value={
            auction.reservePrice === null
              ? "None"
              : formatMoney(auction.reservePrice, auction.currency)
          }
          hint={
            auction.reservePrice === null
              ? undefined
              : (auction.currentBid ?? 0) >= auction.reservePrice
                ? "Met"
                : "Not met"
          }
          tone={
            auction.reservePrice !== null &&
            (auction.currentBid ?? 0) < auction.reservePrice
              ? "caution"
              : "default"
          }
        />
      </dl>

      {auction.winner ? (
        <Alert tone="accent" title="Settled" className="mt-6">
          Won by {auction.winner.user.name} ({auction.winner.user.email}) at{" "}
          {formatMoney(auction.winner.winningAmount, auction.currency)} hammer.
          Premium {formatMoney(auction.winner.buyerPremium, auction.currency)} ·
          total due {formatMoney(auction.winner.totalDue, auction.currency)} ·
          status {auction.winner.status.replace(/_/g, " ").toLowerCase()}.
        </Alert>
      ) : null}

      {auction.extensionCount > 0 ? (
        <Alert tone="caution" className="mt-4">
          The anti-snipe extension has fired {auction.extensionCount}{" "}
          {auction.extensionCount === 1 ? "time" : "times"}. Scheduled close was{" "}
          {formatDateTime(auction.originalEndAt)}; it now closes{" "}
          {formatDateTime(auction.endAt)}.
        </Alert>
      ) : null}

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,1fr)]">
        {/* Editor */}
        <div className="min-w-0">
          {readOnly ? (
            <>
              <Alert tone="neutral" title="This lot is closed" className="mb-6">
                A {auction.status.toLowerCase()} lot is a settled record and can
                no longer be edited.
              </Alert>
              <DescriptionList
                items={[
                  { label: "Lot number", value: auction.lotNumber },
                  { label: "Department", value: auction.category.name },
                  {
                    label: "Starting price",
                    value: formatMoney(auction.startingPrice, auction.currency),
                  },
                  {
                    label: "Increment",
                    value: formatMoney(auction.minimumIncrement, auction.currency),
                  },
                  { label: "Buyer's premium", value: formatBps(auction.buyerPremiumBps) },
                  { label: "Opened", value: formatDateTime(auction.startAt) },
                  { label: "Closed", value: formatDateTime(auction.endAt) },
                  {
                    label: "Settled",
                    value: auction.settledAt
                      ? formatDateTime(auction.settledAt)
                      : "—",
                  },
                ]}
              />
            </>
          ) : (
            <AuctionForm
              mode="edit"
              categories={categories}
              pricingLocked={hasBids}
              initial={auctionValuesFrom({
                id: auction.id,
                title: auction.title,
                lotNumber: auction.lotNumber,
                slug: auction.slug,
                categoryId: auction.categoryId,
                shortDescription: auction.shortDescription,
                description: auction.description,
                startingPrice: auction.startingPrice,
                minimumIncrement: auction.minimumIncrement,
                reservePrice: auction.reservePrice,
                buyerPremiumBps: auction.buyerPremiumBps,
                currency: auction.currency,
                startAt: auction.startAt,
                endAt: auction.endAt,
                extensionEnabled: auction.extensionEnabled,
                extensionThresholdSec: auction.extensionThresholdSec,
                extensionDurationSec: auction.extensionDurationSec,
                proxyBiddingEnabled: auction.proxyBiddingEnabled,
                watchlistEnabled: auction.watchlistEnabled,
                featured: auction.featured,
                location: auction.location,
                shippingNote: auction.shippingNote,
                paymentNote: auction.paymentNote,
                attributes: auction.attributes,
                images: auction.images.map((image) => ({
                  id: image.id,
                  url: image.url,
                  altText: image.altText,
                  isPrimary: image.isPrimary,
                })),
              })}
            />
          )}
        </div>

        {/* Live bid monitor */}
        <aside className="min-w-0">
          <div className="sticky top-6">
            <div className="rounded-sm border border-line bg-surface">
              <header className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="text-[0.9375rem] font-semibold text-ink">
                  Bid activity
                </h2>
                <Link
                  href={`/admin/bids?auctionId=${auction.id}`}
                  className="text-[0.75rem] text-muted hover:text-ink"
                >
                  View all
                </Link>
              </header>

              {recentBids.bids.length === 0 ? (
                <p className="px-5 py-8 text-center text-[0.8125rem] text-faint">
                  No bids on this lot yet.
                </p>
              ) : (
                <ol className="divide-y divide-line">
                  {recentBids.bids.slice(0, 12).map((bid) => (
                    <li key={bid.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        {/* Admins see real identities; the public ledger masks them. */}
                        <p className="truncate text-[0.8125rem] text-ink">
                          {bid.user.name}
                        </p>
                        <p className="truncate text-[0.6875rem] text-faint">
                          {formatDateTime(bid.createdAt, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[0.875rem] text-ink tabular">
                          {formatMoney(bid.amount, auction.currency)}
                        </p>
                        {bid.status === "WINNING" || bid.status === "WON" ? (
                          <Badge
                            tone={bid.status === "WON" ? "accent" : "positive"}
                            className="mt-1"
                          >
                            {bid.status.toLowerCase()}
                          </Badge>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {auction.highestBidder ? (
              <div className="mt-4 rounded-sm border border-line bg-surface p-5">
                <p className="eyebrow mb-3">Leading bidder</p>
                <p className="text-[0.875rem] text-ink">
                  {auction.highestBidder.name}
                </p>
                <p className="mt-0.5 text-[0.75rem] text-faint">
                  {auction.highestBidder.email}
                </p>
                <Link
                  href={`/admin/users/${auction.highestBidder.id}`}
                  className="mt-3 inline-block text-[0.75rem] text-accent-deep underline underline-offset-4 hover:text-ink"
                >
                  View bidder
                </Link>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      {/* Full ledger */}
      {recentBids.bids.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-[0.9375rem] font-semibold text-ink">
            Bid ledger
          </h2>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Placed</TH>
                  <TH>Bidder</TH>
                  <TH align="right">Amount</TH>
                  <TH>Type</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recentBids.bids.map((bid) => (
                  <TR key={bid.id}>
                    <TD className="whitespace-nowrap text-[0.75rem] text-muted">
                      {formatDateTime(bid.createdAt, {
                        dateStyle: "medium",
                        timeStyle: "medium",
                      })}
                    </TD>
                    <TD>
                      <Link
                        href={`/admin/users/${bid.user.id}`}
                        className="text-ink hover:text-accent-deep"
                      >
                        {bid.user.name}
                      </Link>
                      <span className="ml-2 text-[0.6875rem] text-faint">
                        {bid.user.email}
                      </span>
                    </TD>
                    <TD align="right" className="tabular">
                      {formatMoney(bid.amount, auction.currency)}
                    </TD>
                    <TD className="text-[0.75rem] text-muted">
                      {bid.isAutoBid ? "Proxy" : "Manual"}
                    </TD>
                    <TD>
                      <Badge
                        tone={
                          bid.status === "WON"
                            ? "accent"
                            : bid.status === "WINNING"
                              ? "positive"
                              : "neutral"
                        }
                      >
                        {bid.status.toLowerCase()}
                      </Badge>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </section>
      ) : null}
    </>
  );
}

function Figure({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "caution";
}) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
        {label}
      </dt>
      <dd
        className={
          tone === "caution"
            ? "mt-2 text-[1.5rem] font-semibold leading-none text-caution"
            : "mt-2 text-[1.5rem] font-semibold leading-none text-ink"
        }
      >
        {value}
      </dd>
      {hint ? <p className="mt-1.5 text-[0.75rem] text-faint">{hint}</p> : null}
    </div>
  );
}
