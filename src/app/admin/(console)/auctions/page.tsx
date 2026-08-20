import Image from "next/image";
import Link from "next/link";
import { Gavel, Plus } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminFilters } from "@/components/admin/admin-filters";
import { AuctionRowActions } from "@/components/admin/auction-row-actions";
import { StatusPill } from "@/components/admin/status-pill";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import {
  Pagination,
  SortHeader,
  Table,
  TableWrap,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { can, permissionsFor } from "@/lib/auth/rbac";
import { listAdminAuctions } from "@/lib/admin/queries";
import { getCategories } from "@/lib/auction/queries";
import { formatMoney } from "@/lib/money";
import { AuctionStatus } from "@/lib/validation/enums";
import { formatDateTime, safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Auctions" };

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await requirePermission("auction.view");
  const permissions = [...permissionsFor(user.role)];

  const page = safePage(params.page);
  const sort = params.sort ?? "endAt:asc";

  const [result, categories] = await Promise.all([
    listAdminAuctions({
      q: params.q,
      status: params.status,
      category: params.category,
      sort,
      page,
    }),
    getCategories(true),
  ]);

  function href(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...patch })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/auctions?${qs}` : "/admin/auctions";
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Saleroom"
        title="Auctions"
        description="Every lot on the books, including drafts and withdrawn lots."
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
      />

      <div className="mt-8">
        <AdminFilters
          basePath="/admin/auctions"
          searchPlaceholder="Search by title, lot number or slug"
          filters={[
            {
              key: "status",
              label: "Status",
              options: AuctionStatus.options.map((value) => ({
                value,
                label: value.charAt(0) + value.slice(1).toLowerCase(),
              })),
            },
            {
              key: "category",
              label: "Department",
              options: categories.map((category) => ({
                value: category.id,
                label: category.name,
              })),
            },
          ]}
          total={result.total}
          unit="lot"
        />
      </div>

      <div className="mt-5">
        {result.auctions.length === 0 ? (
          <EmptyState
            icon={<Gavel className="size-7" strokeWidth={1.25} />}
            title="No lots match these filters"
            description="Adjust the filters, or create a new auction to get started."
            action={
              can(user.role, "auction.create") ? (
                <Button asChild variant="primary" size="sm">
                  <Link href="/admin/auctions/new">Create an auction</Link>
                </Button>
              ) : null
            }
          />
        ) : (
          <>
            <TableWrap>
              <Table className="min-w-[72rem]">
                <THead>
                  <TR>
                    <TH className="w-14">Image</TH>
                    <SortHeader
                      label="Lot"
                      column="lotNumber"
                      currentSort={sort}
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <SortHeader
                      label="Item"
                      column="title"
                      currentSort={sort}
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <TH>Department</TH>
                    <TH align="right">Starting</TH>
                    <SortHeader
                      label="Current bid"
                      column="currentBid"
                      currentSort={sort}
                      align="right"
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <SortHeader
                      label="Bids"
                      column="bidCount"
                      currentSort={sort}
                      align="right"
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <SortHeader
                      label="Opens"
                      column="startAt"
                      currentSort={sort}
                      align="right"
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <SortHeader
                      label="Closes"
                      column="endAt"
                      currentSort={sort}
                      align="right"
                      buildHref={(next) => href({ sort: next, page: undefined })}
                    />
                    <TH>Status</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>

                <TBody>
                  {result.auctions.map((auction) => (
                    <TR key={auction.id}>
                      <TD>
                        <div className="relative size-10 overflow-hidden rounded-[3px] bg-sunken">
                          {auction.image ? (
                            <Image
                              src={auction.image}
                              alt=""
                              fill
                              sizes="2.5rem"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                      </TD>

                      <TD className="whitespace-nowrap tabular">
                        {auction.lotNumber}
                      </TD>

                      <TD className="max-w-72">
                        <Link
                          href={`/admin/auctions/${auction.id}`}
                          className="line-clamp-1 font-medium text-ink hover:text-accent-deep"
                        >
                          {auction.title}
                        </Link>
                        <p className="mt-0.5 flex items-center gap-2 text-[0.6875rem] text-faint">
                          {auction.featured ? (
                            <span className="text-accent">Featured</span>
                          ) : null}
                          {auction.watchers > 0 ? (
                            <span>{auction.watchers} watching</span>
                          ) : null}
                        </p>
                      </TD>

                      <TD className="whitespace-nowrap text-[0.8125rem]">
                        {auction.category.name}
                      </TD>

                      <TD align="right" className="whitespace-nowrap tabular">
                        {formatMoney(auction.startingPrice, auction.currency, {
                          compact: true,
                        })}
                      </TD>

                      <TD align="right" className="whitespace-nowrap tabular">
                        {auction.currentBid === null ? (
                          <span className="text-faint">—</span>
                        ) : (
                          <span
                            className={
                              auction.reserveMet === false ? "text-caution" : "text-ink"
                            }
                            title={
                              auction.reserveMet === false
                                ? "Below the reserve"
                                : undefined
                            }
                          >
                            {formatMoney(auction.currentBid, auction.currency, {
                              compact: true,
                            })}
                          </span>
                        )}
                      </TD>

                      <TD align="right" className="tabular">
                        {auction.bidCount}
                      </TD>

                      <TD align="right" className="whitespace-nowrap text-[0.75rem] text-muted">
                        {formatDateTime(auction.startAt, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
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

                      <TD align="right">
                        <AuctionRowActions
                          auction={{
                            id: auction.id,
                            slug: auction.slug,
                            lotNumber: auction.lotNumber,
                            title: auction.title,
                            status: auction.status,
                            bidCount: auction.bidCount,
                            featured: auction.featured,
                          }}
                          permissions={permissions}
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
