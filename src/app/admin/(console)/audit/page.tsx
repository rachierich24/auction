import { ShieldCheck } from "lucide-react";

import { AdminPageHeader } from "@/components/admin/page-header";
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
import { listAuditLog } from "@/lib/admin/queries";
import { parseJson } from "@/lib/db/json";
import { formatDateTime, safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit log" };

const DESTRUCTIVE = new Set([
  "auction.delete",
  "auction.cancel",
  "user.suspend",
  "category.delete",
  "media.delete",
]);

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  await requirePermission("audit.view");

  const page = safePage(params.page);
  const result = await listAuditLog(page);

  return (
    <>
      <AdminPageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Append-only record of every privileged action. Entries are never edited or removed."
      />

      <div className="mt-8">
        {result.entries.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-7" strokeWidth={1.25} />}
            title="No entries yet"
            description="Administrative actions will be recorded here as they happen."
          />
        ) : (
          <>
            <TableWrap>
              <Table>
                <THead>
                  <TR>
                    <TH align="right">When</TH>
                    <TH>Actor</TH>
                    <TH>Action</TH>
                    <TH>Entity</TH>
                    <TH>Detail</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.entries.map((entry) => {
                    const metadata = parseJson<Record<string, unknown>>(
                      entry.metadata,
                      {},
                    );
                    return (
                      <TR key={entry.id}>
                        <TD
                          align="right"
                          className="whitespace-nowrap text-[0.75rem] text-muted"
                        >
                          {formatDateTime(entry.createdAt, {
                            dateStyle: "medium",
                            timeStyle: "medium",
                          })}
                        </TD>

                        <TD className="whitespace-nowrap">
                          {entry.actor ? (
                            <>
                              <span className="text-ink">{entry.actor.name}</span>
                              <span className="ml-2 text-[0.6875rem] text-faint">
                                {entry.actor.role.replace(/_/g, " ").toLowerCase()}
                              </span>
                            </>
                          ) : (
                            <span className="text-faint">System</span>
                          )}
                        </TD>

                        <TD>
                          <Badge tone={DESTRUCTIVE.has(entry.action) ? "live" : "neutral"}>
                            {entry.action}
                          </Badge>
                        </TD>

                        <TD className="whitespace-nowrap text-[0.75rem] text-muted">
                          {entry.entityType}
                          {entry.entityId ? (
                            <span className="ml-1.5 font-mono text-faint">
                              {entry.entityId.slice(-8)}
                            </span>
                          ) : null}
                        </TD>

                        <TD className="max-w-80">
                          <p className="line-clamp-2 text-[0.75rem] text-muted">
                            {summarise(metadata)}
                          </p>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>

            <Pagination
              className="mt-4"
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              buildHref={(next) => `/admin/audit?page=${next}`}
            />
          </>
        )}
      </div>
    </>
  );
}

/** Renders audit metadata as a short human sentence rather than raw JSON. */
function summarise(metadata: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (value === null || value === undefined) continue;

    if (key === "changes" && typeof value === "object") {
      const changes = Object.entries(value as Record<string, { from: unknown; to: unknown }>);
      for (const [field, change] of changes.slice(0, 3)) {
        parts.push(`${field}: ${String(change.from)} → ${String(change.to)}`);
      }
      continue;
    }

    if (typeof value === "object") continue;
    parts.push(`${key}: ${String(value)}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "—";
}
