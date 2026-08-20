import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Data tables scroll horizontally inside their own container so a wide admin
 * table never forces the page body to scroll sideways.
 */
export function TableWrap({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-full overflow-x-auto rounded-sm border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function Table({
  className,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full min-w-[52rem] border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function THead({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-line bg-raised", className)}
      {...props}
    />
  );
}

export function TH({
  className,
  align = "left",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-4 py-3 text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-faint",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function TR({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("transition-colors hover:bg-raised", className)}
      {...props}
    />
  );
}

export function TD({
  className,
  align = "left",
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right" | "center";
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle text-ink-soft",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Sortable column header                                                      */
/* -------------------------------------------------------------------------- */

export function SortHeader({
  label,
  column,
  currentSort,
  buildHref,
  align = "left",
}: {
  label: string;
  column: string;
  currentSort: string | undefined;
  buildHref: (sort: string) => string;
  align?: "left" | "right" | "center";
}) {
  const isAsc = currentSort === `${column}:asc`;
  const isDesc = currentSort === `${column}:desc`;
  const next = isDesc ? `${column}:asc` : `${column}:desc`;

  return (
    <TH align={align}>
      <Link
        href={buildHref(next)}
        scroll={false}
        className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        aria-sort={isAsc ? "ascending" : isDesc ? "descending" : "none"}
      >
        {label}
        <span
          aria-hidden
          className={cn(
            "text-[0.6rem] leading-none",
            isAsc || isDesc ? "text-accent" : "text-line-strong",
          )}
        >
          {isAsc ? "▲" : "▼"}
        </span>
      </Link>
    </TH>
  );
}

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
  className,
}: {
  page: number;
  pageCount: number;
  total: number;
  buildHref: (page: number) => string;
  className?: string;
}) {
  if (pageCount <= 1) {
    return (
      <p className={cn("px-1 py-3 text-xs text-faint tabular", className)}>
        {total} {total === 1 ? "result" : "results"}
      </p>
    );
  }

  // Compact window around the current page, always showing first and last.
  const pages: (number | "gap")[] = [];
  const window = 1;
  for (let i = 1; i <= pageCount; i++) {
    if (i === 1 || i === pageCount || Math.abs(i - page) <= window) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-4 px-1 py-3",
        className,
      )}
    >
      <p className="text-xs text-faint tabular">
        Page {page} of {pageCount} · {total} {total === 1 ? "result" : "results"}
      </p>

      <div className="flex items-center gap-1">
        <PageLink
          href={buildHref(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </PageLink>

        {pages.map((entry, index) =>
          entry === "gap" ? (
            <span key={`gap-${index}`} className="px-1.5 text-xs text-faint">
              …
            </span>
          ) : (
            <PageLink
              key={entry}
              href={buildHref(entry)}
              active={entry === page}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? "page" : undefined}
            >
              {entry}
            </PageLink>
          ),
        )}

        <PageLink
          href={buildHref(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
  ...props
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const classes = cn(
    "inline-flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 text-xs tabular transition-colors",
    active
      ? "border-ink bg-ink text-white"
      : "border-line-strong bg-surface text-ink-soft hover:border-ink",
    disabled && "pointer-events-none opacity-40",
  );

  if (disabled) {
    return (
      <span aria-disabled className={classes} {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} scroll={false} className={classes} {...props}>
      {children}
    </Link>
  );
}
