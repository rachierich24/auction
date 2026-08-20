import Link from "next/link";

import {
  AreaTrend,
  BarSeries,
  ChartFrame,
  StatTile,
} from "@/components/admin/charts";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import {
  getBidsOverTime,
  getCategoryPerformance,
  getOverview,
  getPerformance,
  getRevenueOverTime,
  rangeStart,
  RANGES,
  type RangeKey,
} from "@/lib/admin/analytics";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  await requirePermission("analytics.view");

  const range: RangeKey =
    params.range && params.range in RANGES ? (params.range as RangeKey) : "30d";
  const from = rangeStart(range);
  const label = RANGES[range].label.toLowerCase();

  const [overview, bids, revenue, categories, performance] = await Promise.all([
    getOverview(from),
    getBidsOverTime(from),
    getRevenueOverTime(from),
    getCategoryPerformance(from),
    getPerformance(from),
  ]);

  const money = (value: number) =>
    formatMoney(value, "INR", { compact: true });

  return (
    <>
      <AdminPageHeader
        eyebrow="Reporting"
        title="Analytics"
        description={`Saleroom performance across the last ${label}.`}
        rangeKey={range}
        rangeBasePath="/admin/analytics"
      />

      <dl className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total auction value"
          value={money(performance.totalAuctionValue)}
          hint="Standing bids across the catalogue"
        />
        <StatTile
          label="Total sales"
          value={money(overview.totalSales)}
          tone="accent"
          hint="Hammer plus buyer's premium"
        />
        <StatTile
          label="Average winning price"
          value={money(performance.averageWinningPrice)}
          hint="Hammer only"
        />
        <StatTile
          label="Sell-through rate"
          value={`${performance.sellThroughRate}%`}
          hint="Of lots that closed in period"
        />
        <StatTile label="Total bids" value={overview.totalBids.toLocaleString("en-IN")} />
        <StatTile
          label="Average bids per lot"
          value={String(performance.averageBidsPerAuction)}
        />
        <StatTile
          label="Active bidders"
          value={String(overview.activeBidders)}
          hint={`of ${overview.registeredUsers} registered`}
        />
        <StatTile
          label="Awaiting payment"
          value={money(overview.outstanding)}
          tone={overview.outstanding > 0 ? "caution" : "default"}
        />
      </dl>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartFrame
          title="Bids over time"
          subtitle={`Daily bid count · last ${label}`}
        >
          <AreaTrend
            data={bids}
            format="count"
            emptyMessage="No bids were placed in this period."
          />
        </ChartFrame>

        <ChartFrame
          title="Revenue over time"
          subtitle={`Invoiced value of lots settled · last ${label}`}
        >
          <AreaTrend
            data={revenue}
            format="money-compact"
            currency="INR"
            emptyMessage="No lots were settled in this period."
          />
        </ChartFrame>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartFrame
          title="Most bid-on departments"
          subtitle="Total bids received"
        >
          <BarSeries
            data={categories
              .slice(0, 8)
              .map((category) => ({ label: category.name, value: category.bids }))}
            format="count"
          />
        </ChartFrame>

        <ChartFrame title="Most watched lots" subtitle="Watchlist additions">
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

      {/* Department table — the numbers behind the charts */}
      <section className="mt-10">
        <h2 className="mb-4 text-[0.9375rem] font-semibold text-ink">
          Department performance
        </h2>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Department</TH>
                <TH align="right">Lots</TH>
                <TH align="right">Bids</TH>
                <TH align="right">Sold</TH>
                <TH align="right">Sell-through</TH>
                <TH align="right">Invoiced value</TH>
              </TR>
            </THead>
            <TBody>
              {categories.map((category) => (
                <TR key={category.id}>
                  <TD className="font-medium text-ink">{category.name}</TD>
                  <TD align="right" className="tabular">
                    {category.auctions}
                  </TD>
                  <TD align="right" className="tabular">
                    {category.bids}
                  </TD>
                  <TD align="right" className="tabular">
                    {category.sold}
                  </TD>
                  <TD align="right" className="tabular">
                    {category.auctions > 0
                      ? `${Math.round((category.sold / category.auctions) * 100)}%`
                      : "—"}
                  </TD>
                  <TD align="right" className="tabular">
                    {formatMoney(category.value, "INR")}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </section>

      {/* Top lots */}
      <section className="mt-10">
        <h2 className="mb-4 text-[0.9375rem] font-semibold text-ink">
          Highest bids on the books
        </h2>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Lot</TH>
                <TH align="right">Current bid</TH>
                <TH align="right">Bids</TH>
              </TR>
            </THead>
            <TBody>
              {performance.topLots.map((lot) => (
                <TR key={lot.id}>
                  <TD>
                    <Link
                      href={`/admin/auctions/${lot.id}`}
                      className="text-ink hover:text-accent-deep"
                    >
                      {lot.title}
                    </Link>
                    <span className="ml-2 text-[0.6875rem] text-faint tabular">
                      Lot {lot.lotNumber}
                    </span>
                  </TD>
                  <TD align="right" className="tabular">
                    {formatMoney(lot.currentBid, lot.currency)}
                  </TD>
                  <TD align="right" className="tabular">
                    {lot.bidCount}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </section>
    </>
  );
}
