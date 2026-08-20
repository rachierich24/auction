import Link from "next/link";
import { Users } from "lucide-react";

import { AdminFilters } from "@/components/admin/admin-filters";
import { AdminPageHeader } from "@/components/admin/page-header";
import { UserRowActions } from "@/components/admin/user-row-actions";
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
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { listAdminUsers } from "@/lib/admin/queries";
import { UserRole, type UserRole as Role } from "@/lib/validation/enums";
import { formatDateTime, initials, safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const actor = await requirePermission("user.view");

  const page = safePage(params.page);
  const result = await listAdminUsers({
    q: params.q,
    role: params.role,
    status: params.status,
    page,
  });

  function href(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...patch })) {
      if (value) next.set(key, value);
    }
    const qs = next.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="People"
        title="Users"
        description="Registered bidders and console staff. Only the details needed to run the saleroom are shown."
      />

      <div className="mt-8">
        <AdminFilters
          basePath="/admin/users"
          searchPlaceholder="Search by name or email"
          total={result.total}
          unit="account"
          filters={[
            {
              key: "role",
              label: "Role",
              options: UserRole.options.map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              })),
            },
            {
              key: "status",
              label: "Status",
              options: [
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
              ],
            },
          ]}
        />
      </div>

      <div className="mt-5">
        {result.users.length === 0 ? (
          <EmptyState
            icon={<Users className="size-7" strokeWidth={1.25} />}
            title="No accounts match these filters"
            description="Try a different search term or clear the filters."
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH>User</TH>
                    <TH>Role</TH>
                    <TH align="right">Bids</TH>
                    <TH align="right">Won</TH>
                    <TH align="right">Watching</TH>
                    <TH align="right">Registered</TH>
                    <TH>Status</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.users.map((user) => (
                    <TR key={user.id}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-[0.625rem] font-semibold text-muted">
                            {initials(user.name)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="block truncate font-medium text-ink hover:text-accent-deep"
                            >
                              {user.name}
                            </Link>
                            <span className="block truncate text-[0.6875rem] text-faint">
                              {user.email}
                              {!user.emailVerifiedAt ? (
                                <span className="ml-1.5 text-caution">unverified</span>
                              ) : null}
                            </span>
                          </div>
                        </div>
                      </TD>

                      <TD className="whitespace-nowrap text-[0.8125rem]">
                        {ROLE_LABELS[user.role as Role] ?? user.role}
                      </TD>

                      <TD align="right" className="tabular">
                        {user._count.bids}
                      </TD>
                      <TD align="right" className="tabular">
                        {user._count.wins}
                      </TD>
                      <TD align="right" className="tabular">
                        {user._count.watchlist}
                      </TD>

                      <TD
                        align="right"
                        className="whitespace-nowrap text-[0.75rem] text-muted"
                      >
                        {formatDateTime(user.createdAt, { dateStyle: "medium" })}
                      </TD>

                      <TD>
                        <Badge tone={user.status === "ACTIVE" ? "positive" : "live"}>
                          {user.status.toLowerCase()}
                        </Badge>
                      </TD>

                      <TD align="right">
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
