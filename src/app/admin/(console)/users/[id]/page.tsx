import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/page-header";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Badge, DescriptionList, EmptyState } from "@/components/ui/primitives";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { requirePermission } from "@/lib/auth/guards";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/auth/rbac";
import { getAdminUser } from "@/lib/admin/queries";
import { formatMoney } from "@/lib/money";
import type { UserRole } from "@/lib/validation/enums";
import { formatDateTime, initials } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getAdminUser(id);
  return { title: user?.name ?? "User" };
}

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await requirePermission("user.view");

  const user = await getAdminUser(id);
  if (!user) notFound();

  const role = user.role as UserRole;

  return (
    <>
      <AdminPageHeader
        crumbs={[{ label: "Users", href: "/admin/users" }, { label: user.name }]}
        eyebrow={ROLE_LABELS[role] ?? user.role}
        title={user.name}
        description={user.email}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={user.status === "ACTIVE" ? "positive" : "live"}>
              {user.status.toLowerCase()}
            </Badge>
            <UserRowActions
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
              }}
              actorId={actor.id}
              actorRole={actor.role}
            />
          </div>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside>
          <div className="rounded-sm border border-line bg-surface p-6">
            <div className="flex items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-ink text-[0.875rem] font-semibold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-lg text-ink">{user.name}</p>
                <p className="truncate text-[0.75rem] text-faint">{user.email}</p>
              </div>
            </div>

            <p className="mt-5 rounded-sm bg-raised p-3 text-[0.75rem] leading-relaxed text-muted">
              {ROLE_DESCRIPTIONS[role]}
            </p>

            <DescriptionList
              className="mt-5"
              items={[
                { label: "Registered", value: formatDateTime(user.createdAt, { dateStyle: "long" }) },
                {
                  label: "Last sign-in",
                  value: user.lastLoginAt
                    ? formatDateTime(user.lastLoginAt, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Never",
                },
                {
                  label: "Email confirmed",
                  value: user.emailVerifiedAt ? "Yes" : "Not yet",
                },
                // Phone is shown because the saleroom calls winning bidders;
                // nothing else about the account is exposed here.
                { label: "Phone", value: user.phone ?? "—" },
                { label: "Total bids", value: String(user._count.bids) },
                { label: "Lots won", value: String(user._count.wins) },
                { label: "Watching", value: String(user._count.watchlist) },
              ]}
            />
          </div>
        </aside>

        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="mb-4 text-[0.9375rem] font-semibold text-ink">
              Lots won
            </h2>
            {user.wins.length === 0 ? (
              <EmptyState title="No lots won" description="This bidder has not won a lot yet." />
            ) : (
              <TableWrap>
                <Table className="min-w-[40rem]">
                  <THead>
                    <TR>
                      <TH>Lot</TH>
                      <TH align="right">Total due</TH>
                      <TH>Settlement</TH>
                      <TH align="right">Won</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {user.wins.map((win) => (
                      <TR key={win.id}>
                        <TD>
                          <Link
                            href={`/admin/auctions/${win.auction.id}`}
                            className="text-ink hover:text-accent-deep"
                          >
                            {win.auction.title}
                          </Link>
                          <span className="ml-2 text-[0.6875rem] text-faint">
                            Lot {win.auction.lotNumber}
                          </span>
                        </TD>
                        <TD align="right" className="tabular">
                          {formatMoney(win.totalDue, win.auction.currency)}
                        </TD>
                        <TD>
                          <Badge
                            tone={win.status === "PAYMENT_PENDING" ? "caution" : "positive"}
                          >
                            {win.status.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </TD>
                        <TD align="right" className="text-[0.75rem] text-muted">
                          {formatDateTime(win.createdAt, { dateStyle: "medium" })}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-[0.9375rem] font-semibold text-ink">
                Recent bids
              </h2>
              <Link
                href={`/admin/bids?q=${encodeURIComponent(user.email)}`}
                className="text-[0.75rem] text-muted hover:text-ink"
              >
                View all bids
              </Link>
            </div>

            {user.recentBids.length === 0 ? (
              <EmptyState title="No bids" description="This account has not bid yet." />
            ) : (
              <TableWrap>
                <Table className="min-w-[40rem]">
                  <THead>
                    <TR>
                      <TH>Lot</TH>
                      <TH align="right">Amount</TH>
                      <TH>Status</TH>
                      <TH align="right">Placed</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {user.recentBids.map((bid) => (
                      <TR key={bid.id}>
                        <TD>
                          <Link
                            href={`/auction/${bid.auction.slug}`}
                            className="text-ink hover:text-accent-deep"
                          >
                            {bid.auction.title}
                          </Link>
                          <span className="ml-2 text-[0.6875rem] text-faint">
                            Lot {bid.auction.lotNumber}
                          </span>
                        </TD>
                        <TD align="right" className="tabular">
                          {formatMoney(bid.amount, bid.auction.currency)}
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
                        <TD align="right" className="text-[0.75rem] text-muted">
                          {formatDateTime(bid.createdAt, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
