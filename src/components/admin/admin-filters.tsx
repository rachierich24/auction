"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export type FilterSpec = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
};

/**
 * Search + dropdown filters for admin tables.
 *
 * State lives in the URL, so a filtered view is bookmarkable, survives a
 * refresh, and re-queries on the server rather than filtering a page of rows
 * in the browser.
 */
export function AdminFilters({
  basePath,
  searchPlaceholder = "Search…",
  filters = [],
  total,
  unit = "result",
  extra,
}: {
  basePath: string;
  searchPlaceholder?: string;
  filters?: FilterSpec[];
  total: number;
  unit?: string;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [query, setQuery] = React.useState(params.get("q") ?? "");
  const [pending, startTransition] = React.useTransition();

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
      next.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      });
    },
    [params, pathname, router],
  );

  const activeCount = [
    params.get("q"),
    ...filters.map((filter) => params.get(filter.key)),
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-sm border border-line bg-surface p-4">
      <form
        className="relative min-w-56 flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          update({ q: query.trim() || null });
        }}
      >
        <label htmlFor="admin-search" className="sr-only">
          Search
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input
          id="admin-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
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

      {filters.map((filter) => (
        <div key={filter.key} className="min-w-40">
          <label
            htmlFor={`filter-${filter.key}`}
            className="mb-1.5 block text-[0.6875rem] uppercase tracking-[0.08em] text-faint"
          >
            {filter.label}
          </label>
          <NativeSelect
            id={`filter-${filter.key}`}
            value={params.get(filter.key) ?? ""}
            onChange={(event) => update({ [filter.key]: event.target.value || null })}
            className="h-10 text-[0.8125rem]"
          >
            <option value="">All</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ))}

      {extra}

      {activeCount > 0 ? (
        <Button
          variant="quiet"
          size="sm"
          className="h-10"
          onClick={() =>
            startTransition(() => router.push(basePath, { scroll: false }))
          }
        >
          Clear
        </Button>
      ) : null}

      <p
        className={cn(
          "ml-auto self-center text-[0.8125rem] text-muted tabular transition-opacity",
          pending && "opacity-50",
        )}
      >
        {total.toLocaleString("en-IN")} {total === 1 ? unit : `${unit}s`}
      </p>
    </div>
  );
}
