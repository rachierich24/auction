import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { AreaTrend, BarSeries, ChartFrame, StatTile } from "@/components/admin/charts";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { can } from "@/lib/auth/rbac";
import {
  getBidsOverTime,
  getCategoryPerformance,
  getOverview,
  getPerformance,
  getStatusBreakdown,
  rangeStart,
  RANGES,
  type RangeKey,
} from "@/lib/admin/analytics";
import { listAdminAuctions } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const user = await requirePermission("admin.access");

  const range: RangeKey =
    params.range && params.range in RANGES ? (params.range as RangeKey) : "30d";
  const from = rangeStart(range);

  const [overview, bidsSeries, categories, performance, statuses, closingSoon] =
    await Promise.all([
      getOverview(from),
      getBidsOverTime(from),
      getCategoryPerformance(from),
      getPerformance(from),
      getStatusBreakdown(),
      listAdminAuctions({ status: "LIVE", sort: "endAt:asc", perPage: 6 }),
    ]);

  return (
    <>
      <AdminPageHeader
        eyebrow="Overview"
        title={`Good day, ${user.name.split(" ")[0]}`}
        description="Everything currently in the room, and how the sale is performing."
        action={
          can(user.role, "auction.create") ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/admin/auctions/new">
                <Plus className="size-4" />
                New auction
              </Link>
            </Button>
          ) : null
        }
        rangeKey={range}
      />

      {/* Headline figures */}
      <dl className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total auctions" value={String(overview.totalAuctions)} />
        <StatTile
          label="Live now"
          value={String(overview.liveAuctions)}
          tone="accent"
          hint={`${overview.upcomingAuctions} upcoming`}
        />
        <StatTile
          label="Completed"
          value={String(overview.completedAuctions)}
          hint={`${overview.draftAuctions} in draft`}
        />
        <StatTile
          label="Registered bidders"
          value={String(overview.registeredUsers)}
          hint={`${overview.activeBidders} active in period`}
        />
        <StatTile
          label={`Bids · ${RANGES[range].label.toLowerCase()}`}
          value={String(overview.totalBids)}
        />
        <StatTile
          label="Total sales"
          value={formatMoney(overview.totalSales, "INR", { compact: true })}
          hint="Hammer plus premium"
        />
        <StatTile
          label="Awaiting payment"
          value={formatMoney(overview.outstanding, "INR", { compact: true })}
          tone={overview.outstanding > 0 ? "caution" : "default"}
        />
        <StatTile
          label="Sell-through"
          value={`${performance.sellThroughRate}%`}
          hint={`Avg ${performance.averageBidsPerAuction} bids per lot`}
        />
      </dl>

      {/* Charts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <ChartFrame
          title="Bids over time"
          subtitle={`Daily bid count across the last ${RANGES[range].label.toLowerCase()}`}
        >
          <AreaTrend
            data={bidsSeries}
            format="count"
            emptyMessage="No bids were placed in this period."
          />
        </ChartFrame>

        <ChartFrame
          title="Bids by department"
          subtitle="Where bidding activity is concentrated"
        >
          <BarSeries
            data={categories
              .slice(0, 7)
              .map((category) => ({ label: category.name, value: category.bids }))}
            format="count"
            emptyMessage="No bidding activity yet."
          />
        </ChartFrame>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <ChartFrame title="Catalogue by status" subtitle="Every lot on the books">
          <BarSeries
            data={statuses
              .sort((a, b) => b.count - a.count)
              .map((entry) => ({
                label: entry.status.charAt(0) + entry.status.slice(1).toLowerCase(),
                value: entry.count,
              }))}
            format="count"
          />
        </ChartFrame>

        <ChartFrame
          title="Most watched lots"
          subtitle="Interest ahead of the hammer"
        >
          <BarSeries
            data={performance.mostWatched.map((lot) => ({
              label: `${lot.lotNumber} · ${lot.title}`,
              value: lot.watchers,
            }))}
            format="count"
            emptyMessage="No lots are being watched yet."
          />
        </ChartFrame>
      </div>

      {/* Closing soon */}
      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[0.9375rem] font-semibold text-ink">
              Closing next
            </h2>
            <p className="mt-1 text-[0.75rem] text-muted">
              Live lots in the order they will settle.
            </p>
          </div>
          <Link
            href="/admin/auctions?status=LIVE"
            className="group inline-flex items-center gap-1.5 text-[0.8125rem] text-ink"
          >
            All live lots
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {closingSoon.auctions.length === 0 ? (
          <EmptyState
            title="Nothing live"
            description="No lots are currently open for bidding."
            action={
              can(user.role, "auction.create") ? (
                <Button asChild variant="primary" size="sm">
                  <Link href="/admin/auctions/new">Create an auction</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>Lot</TH>
                  <TH>Department</TH>
                  <TH align="right">Current bid</TH>
                  <TH align="right">Bids</TH>
                  <TH align="right">Closes</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {closingSoon.auctions.map((auction) => (
                  <TR key={auction.id}>
                    <TD>
                      <Link
                        href={`/admin/auctions/${auction.id}`}
                        className="font-medium text-ink hover:text-accent-deep"
                      >
                        {auction.title}
                      </Link>
                      <span className="ml-2 text-[0.75rem] text-faint">
                        Lot {auction.lotNumber}
                      </span>
                    </TD>
                    <TD className="text-[0.8125rem]">{auction.category.name}</TD>
                    <TD align="right" className="tabular">
                      {formatMoney(
                        auction.currentBid ?? auction.startingPrice,
                        auction.currency,
                      )}
                    </TD>
                    <TD align="right" className="tabular">
                      {auction.bidCount}
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-[0.75rem] text-muted">
                      {formatDateTime(auction.endAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </TD>
                    <TD>
                      <StatusPill status={auction.displayStatus} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </section>
    </>
  );
}
