import Link from "next/link";
import { Receipt } from "lucide-react";

import { AdminFilters } from "@/components/admin/admin-filters";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SettlementStageControl } from "@/components/admin/settlement-stage-control";
import { StatTile } from "@/components/admin/charts";
import { Badge, EmptyState } from "@/components/ui/primitives";
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
import {
  listSettlements,
  SETTLEMENT_STAGES,
  STAGE_LABELS,
} from "@/lib/admin/settlements";
import { formatMoney } from "@/lib/money";
import { formatDateTime, safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settlements" };

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  await requirePermission("settlement.manage");

  const page = safePage(params.page);
  const result = await listSettlements({
    status: params.status,
    q: params.q,
    page,
  });

  function href(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...patch })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/settlements?${qs}` : "/admin/settlements";
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Post-sale"
        title="Settlements"
        description="Every sold lot from the hammer through to delivery. Advancing a stage is recorded in the audit log."
      />

      <dl className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Awaiting payment"
          value={formatMoney(result.outstanding, "INR", { compact: true })}
          tone={result.outstanding > 0 ? "caution" : "default"}
          hint={`${result.counts.PAYMENT_PENDING ?? 0} lots`}
        />
        <StatTile
          label="Overdue"
          value={String(result.overdueCount)}
          tone={result.overdueCount > 0 ? "caution" : "default"}
          hint="Past the 5-day term"
        />
        <StatTile
          label="In processing"
          value={String(result.counts.ORDER_PROCESSING ?? 0)}
        />
        <StatTile
          label="Completed"
          value={String(result.counts.COMPLETED ?? 0)}
          tone="accent"
        />
      </dl>

      <div className="mt-6">
        <AdminFilters
          basePath="/admin/settlements"
          searchPlaceholder="Search by lot, buyer name or email"
          total={result.total}
          unit="settlement"
          filters={[
            {
              key: "status",
              label: "Stage",
              options: SETTLEMENT_STAGES.map((stage) => ({
                value: stage,
                label: STAGE_LABELS[stage],
              })),
            },
          ]}
        />
      </div>

      <div className="mt-5">
        {result.settlements.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-7" strokeWidth={1.25} />}
            title="No settlements match these filters"
            description="Lots that sell will appear here with their invoice and fulfilment stage."
          />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[64rem]">
                <THead>
                  <TR>
                    <TH>Lot</TH>
                    <TH>Buyer</TH>
                    <TH align="right">Hammer</TH>
                    <TH align="right">Premium</TH>
                    <TH align="right">Total due</TH>
                    <TH align="right">Won</TH>
                    <TH>Stage</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.settlements.map((settlement) => (
                    <TR key={settlement.id}>
                      <TD className="max-w-64">
                        <Link
                          href={`/admin/auctions/${settlement.auction.id}`}
                          className="line-clamp-1 font-medium text-ink hover:text-accent-deep"
                        >
                          {settlement.auction.title}
                        </Link>
                        <span className="text-[0.6875rem] text-faint tabular">
                          Lot {settlement.auction.lotNumber}
                          {settlement.auction.location
                            ? ` · ${settlement.auction.location}`
                            : ""}
                        </span>
                      </TD>

                      <TD>
                        <Link
                          href={`/admin/users/${settlement.user.id}`}
                          className="text-ink hover:text-accent-deep"
                        >
                          {settlement.user.name}
                        </Link>
                        <span className="block text-[0.6875rem] text-faint">
                          {settlement.user.email}
                        </span>
                      </TD>

                      <TD align="right" className="whitespace-nowrap tabular">
                        {formatMoney(
                          settlement.winningAmount,
                          settlement.auction.currency,
                        )}
                      </TD>
                      <TD align="right" className="whitespace-nowrap tabular text-muted">
                        {formatMoney(
                          settlement.buyerPremium,
                          settlement.auction.currency,
                        )}
                      </TD>
                      <TD align="right" className="whitespace-nowrap font-medium tabular">
                        {formatMoney(
                          settlement.totalDue,
                          settlement.auction.currency,
                        )}
                      </TD>

                      <TD align="right" className="whitespace-nowrap text-[0.75rem]">
                        <span className="text-muted">
                          {formatDateTime(settlement.createdAt, {
                            dateStyle: "medium",
                          })}
                        </span>
                        {settlement.overdue ? (
                          <Badge tone="live" className="ml-2">
                            overdue
                          </Badge>
                        ) : null}
                      </TD>

                      <TD>
                        <SettlementStageControl
                          winnerId={settlement.id}
                          status={settlement.status}
                          lotNumber={settlement.auction.lotNumber}
                        />
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
