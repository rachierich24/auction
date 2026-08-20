import Link from "next/link";
import { ScrollText } from "lucide-react";

import { AdminFilters } from "@/components/admin/admin-filters";
import { DateRangeFilter } from "@/components/admin/date-range-filter";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Alert, Badge, EmptyState } from "@/components/ui/primitives";
import {
  Pagination,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { listAdminBids } from "@/lib/admin/queries";
import { prisma } from "@/lib/db/prisma";
import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { formatDateTime, safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bids" };

export default async function AdminBidsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  await requirePermission("bid.view");

  const page = safePage(params.page);

  const [result, auctions] = await Promise.all([
    listAdminBids({
      auctionId: params.auctionId,
      q: params.q,
      from: params.from ? new Date(params.from) : undefined,
      to: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
      minAmount: params.min ? (parseMoneyToMinor(params.min) ?? undefined) : undefined,
      maxAmount: params.max ? (parseMoneyToMinor(params.max) ?? undefined) : undefined,
      page,
    }),
    prisma.auction.findMany({
      orderBy: { endAt: "desc" },
      take: 120,
      select: { id: true, lotNumber: true, title: true },
    }),
  ]);

  function href(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...patch })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/bids?${qs}` : "/admin/bids";
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Saleroom"
        title="Bids"
        description="The complete bid ledger across every lot."
      />

      <Alert tone="neutral" className="mt-6">
        Bids are an immutable financial record. They can be inspected and
        filtered here but never edited — a lot that must be undone is withdrawn
        from sale, which preserves its history.
      </Alert>

      <div className="mt-6">
        <AdminFilters
          basePath="/admin/bids"
          searchPlaceholder="Search by lot, bidder name or email"
          total={result.total}
          unit="bid"
          filters={[
            {
              key: "auctionId",
              label: "Lot",
              options: auctions.map((auction) => ({
                value: auction.id,
                label: `${auction.lotNumber} · ${auction.title.slice(0, 40)}`,
              })),
            },
          ]}
          extra={<DateRangeFilter />}
        />
      </div>

      <div className="mt-5">
        {result.bids.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="size-7" strokeWidth={1.25} />}
            title="No bids match these filters"
            description="Try widening the date range or clearing the search."
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>Bid</TH>
                    <TH>Lot</TH>
                    <TH>Bidder</TH>
                    <TH align="right">Amount</TH>
                    <TH>Type</TH>
                    <TH>Status</TH>
                    <TH align="right">Placed</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.bids.map((bid) => (
                    <TR key={bid.id}>
                      <TD className="font-mono text-[0.6875rem] text-faint">
                        {bid.id.slice(-8)}
                      </TD>
                      <TD className="max-w-64">
                        <Link
                          href={`/admin/auctions/${bid.auction.id}`}
                          className="line-clamp-1 text-ink hover:text-accent-deep"
                        >
                          {bid.auction.title}
                        </Link>
                        <span className="text-[0.6875rem] text-faint tabular">
                          Lot {bid.auction.lotNumber}
                        </span>
                      </TD>
                      <TD>
                        <Link
                          href={`/admin/users/${bid.user.id}`}
                          className="text-ink hover:text-accent-deep"
                        >
                          {bid.user.name}
                        </Link>
                        <span className="block text-[0.6875rem] text-faint">
                          {bid.user.email}
                          {bid.user.status !== "ACTIVE" ? (
                            <span className="ml-1.5 text-live">suspended</span>
                          ) : null}
                        </span>
                      </TD>
                      <TD align="right" className="whitespace-nowrap tabular">
                        {formatMoney(bid.amount, bid.auction.currency)}
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
                      <TD
                        align="right"
                        className="whitespace-nowrap text-[0.75rem] text-muted"
                      >
                        {formatDateTime(bid.createdAt, {
                          dateStyle: "medium",
                          timeStyle: "medium",
                        })}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              className="mt-4"
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              buildHref={(next) =>
                href({ page: next > 1 ? String(next) : undefined })
              }
            />
          </>
        )}
      </div>
    </>
  );
}
