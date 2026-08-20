import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { RANGES, type RangeKey } from "@/lib/admin/analytics";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
  crumbs,
  rangeKey,
  rangeBasePath = "/admin",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  crumbs?: Crumb[];
  /** Renders the date-range control when provided. */
  rangeKey?: RangeKey;
  rangeBasePath?: string;
}) {
  return (
    <header>
      {crumbs && crumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-1.5 text-[0.75rem] text-muted"
        >
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
              {index > 0 ? (
                <ChevronRight className="size-3 text-line-strong" />
              ) : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-faint">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 className="mt-2 font-display text-[2rem] leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-[0.875rem] leading-relaxed text-muted text-pretty">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {rangeKey ? (
            <RangeControl current={rangeKey} basePath={rangeBasePath} />
          ) : null}
          {action}
        </div>
      </div>
    </header>
  );
}

/**
 * Date-range filter. A row of links rather than a select, so each range is a
 * shareable URL and the whole page re-renders on the server with fresh figures.
 */
function RangeControl({
  current,
  basePath,
}: {
  current: RangeKey;
  basePath: string;
}) {
  return (
    <div
      role="group"
      aria-label="Date range"
      className="flex items-center rounded-sm border border-line bg-surface p-0.5"
    >
      {(Object.entries(RANGES) as [RangeKey, { label: string }][]).map(
        ([key, value]) => (
          <Link
            key={key}
            href={`${basePath}?range=${key}`}
            scroll={false}
            aria-current={key === current ? "true" : undefined}
            className={cn(
              "rounded-[3px] px-2.5 py-1.5 text-[0.75rem] transition-colors",
              key === current
                ? "bg-ink text-white"
                : "text-muted hover:text-ink",
            )}
          >
            {value.label}
          </Link>
        ),
      )}
    </div>
  );
}
