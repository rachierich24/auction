"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { SORT_OPTIONS, STATUS_FILTERS } from "@/lib/auction/filters";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; slug: string; count: number };

/**
 * Filters are URL state, not component state: every view of the catalogue is
 * a shareable, server-rendered, indexable URL.
 */
export function AuctionFilters({
  categories,
  total,
}: {
  categories: Category[];
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  // Keep the input in step when the user navigates back/forward.
  React.useEffect(() => {
    setQuery(params.get("q") ?? "");
  }, [params]);

  const update = React.useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      // Any filter change returns to the first page of results.
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const status = params.get("status") ?? "all";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "ending-soon";
  const minPrice = params.get("min") ?? "";
  const maxPrice = params.get("max") ?? "";

  const activeCount = [
    params.get("q"),
    params.get("category"),
    params.get("min"),
    params.get("max"),
    status !== "all" ? status : null,
  ].filter(Boolean).length;

  return (
    <div className="border-y border-line bg-surface">
      <div className="gutter mx-auto max-w-[110rem]">
        {/* Status tabs */}
        <div className="hide-scrollbar flex items-center gap-1 overflow-x-auto py-3">
          {(
            Object.entries(STATUS_FILTERS) as [keyof typeof STATUS_FILTERS, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => update({ status: key === "all" ? null : key })}
              className={cn(
                "shrink-0 rounded-sm px-3.5 py-2 text-[0.8125rem] transition-colors",
                status === key
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <label htmlFor="sort" className="text-[0.75rem] text-faint">
              Sort
            </label>
            <NativeSelect
              id="sort"
              value={sort}
              onChange={(event) => update({ sort: event.target.value })}
              className="h-9 w-52 text-[0.8125rem]"
            >
              {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>

        {/* Search + filter toggle */}
        <div className="flex flex-wrap items-center gap-3 border-t border-line py-4">
          <form
            className="relative flex-1 sm:min-w-72"
            onSubmit={(event) => {
              event.preventDefault();
              update({ q: query.trim() || null });
            }}
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, lot number or description"
              aria-label="Search the catalogue"
              className="h-10 pl-10 pr-9"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  update({ q: null });
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </form>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            className="h-10"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeCount > 0 ? (
              <span className="ml-1 inline-flex size-4.5 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold leading-none text-white tabular">
                {activeCount}
              </span>
            ) : null}
          </Button>

          {activeCount > 0 ? (
            <Button
              variant="quiet"
              size="sm"
              className="h-10"
              onClick={() =>
                startTransition(() => router.push(pathname, { scroll: false }))
              }
            >
              Clear all
            </Button>
          ) : null}

          <p
            className={cn(
              "ml-auto text-[0.8125rem] text-muted tabular transition-opacity",
              pending && "opacity-50",
            )}
          >
            {total} {total === 1 ? "lot" : "lots"}
          </p>
        </div>

        {/* Expanded filters */}
        {panelOpen ? (
          <div className="grid gap-5 border-t border-line py-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-[0.75rem] text-faint"
              >
                Department
              </label>
              <NativeSelect
                id="category"
                value={category}
                onChange={(event) => update({ category: event.target.value || null })}
                className="h-10 text-[0.8125rem]"
              >
                <option value="">All departments</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name} ({item.count})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <PriceField
              id="min"
              label="Starting price from"
              value={minPrice}
              onCommit={(value) => update({ min: value })}
            />
            <PriceField
              id="max"
              label="Starting price up to"
              value={maxPrice}
              onCommit={(value) => update({ max: value })}
            />

            <div className="md:hidden lg:block">
              <label htmlFor="sort-mobile" className="mb-1.5 block text-[0.75rem] text-faint">
                Sort by
              </label>
              <NativeSelect
                id="sort-mobile"
                value={sort}
                onChange={(event) => update({ sort: event.target.value })}
                className="h-10 text-[0.8125rem]"
              >
                {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PriceField({
  id,
  label,
  value,
  onCommit,
}: {
  id: string;
  label: string;
  value: string;
  onCommit: (value: string | null) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[0.75rem] text-faint">
        {label}
      </label>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="₹"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ""))}
        onBlur={() => onCommit(draft || null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onCommit(draft || null);
          }
        }}
        className="h-10 text-[0.8125rem] tabular"
      />
    </div>
  );
}

export function CategoryChips({
  categories,
  active,
}: {
  categories: Category[];
  active?: string;
}) {
  const params = useSearchParams();

  function hrefFor(slug: string | null) {
    const next = new URLSearchParams(params.toString());
    if (slug) next.set("category", slug);
    else next.delete("category");
    next.delete("page");
    return `/auctions?${next.toString()}`;
  }

  return (
    <div className="hide-scrollbar flex gap-2 overflow-x-auto">
      <Link
        href={hrefFor(null)}
        className={cn(
          "shrink-0 rounded-sm border px-3 py-1.5 text-[0.8125rem] transition-colors",
          !active
            ? "border-ink bg-ink text-white"
            : "border-line-strong text-muted hover:border-ink hover:text-ink",
        )}
      >
        All
      </Link>
      {categories.map((category) => (
        <Link
          key={category.id}
          href={hrefFor(category.slug)}
          className={cn(
            "shrink-0 rounded-sm border px-3 py-1.5 text-[0.8125rem] transition-colors",
            active === category.slug
              ? "border-ink bg-ink text-white"
              : "border-line-strong text-muted hover:border-ink hover:text-ink",
          )}
        >
          {category.name}
        </Link>
      ))}
    </div>
  );
}
