import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchX } from "lucide-react";

import { AuctionCard } from "@/components/auction/auction-card";
import { AuctionFilters } from "@/components/auction/auction-filters";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import { Pagination } from "@/components/ui/table";
import {
  getCategories,
  listAuctions,
  SORT_OPTIONS,
  STATUS_FILTERS,
  type SortKey,
  type StatusFilter,
} from "@/lib/auction/queries";
import { safePage } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const status = first(params.status);
  const category = first(params.category);
  const query = first(params.q);

  const bits = [
    status && status in STATUS_FILTERS
      ? STATUS_FILTERS[status as StatusFilter]
      : null,
    category ? `${category.replace(/-/g, " ")} lots` : null,
    query ? `“${query}”` : null,
  ].filter(Boolean);

  const title = bits.length ? `Auctions — ${bits.join(" · ")}` : "Auctions";

  return {
    title,
    description:
      "Browse the full catalogue of live, upcoming and closed lots. Filter by department, status and price.",
    alternates: { canonical: "/auctions" },
    // Filtered permutations are not worth indexing; the base catalogue is.
    robots: bits.length ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const statusParam = first(params.status);
  const sortParam = first(params.sort);

  const filters = {
    q: first(params.q)?.slice(0, 120),
    category: first(params.category),
    status:
      statusParam && statusParam in STATUS_FILTERS
        ? (statusParam as StatusFilter)
        : undefined,
    sort:
      sortParam && sortParam in SORT_OPTIONS ? (sortParam as SortKey) : undefined,
    minPrice: toMinor(first(params.min)),
    maxPrice: toMinor(first(params.max)),
    page: safePage(first(params.page)),
  };

  const [result, categories] = await Promise.all([
    listAuctions(filters),
    getCategories(),
  ]);

  function buildHref(page: number): string {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const single = first(value);
      if (single) next.set(key, single);
    }
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
    const qs = next.toString();
    return qs ? `/auctions?${qs}` : "/auctions";
  }

  return (
    <>
      <section className="gutter mx-auto max-w-[110rem] py-12 md:py-16">
        <p className="eyebrow">Catalogue</p>
        <h1 className="mt-4 max-w-3xl font-display text-[2.75rem] leading-[1.02] tracking-tight text-ink sm:text-[3.5rem] text-balance">
          Every lot, in one room
        </h1>
        <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted text-pretty">
          Live, upcoming and settled lots across every department. Each entry
          carries its condition report, specifications and complete bid history.
        </p>
      </section>

      <Suspense fallback={<div className="h-32 border-y border-line bg-surface" />}>
        <AuctionFilters
          total={result.total}
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            count: category._count.auctions,
          }))}
        />
      </Suspense>

      <section className="gutter mx-auto max-w-[110rem] py-12">
        {result.auctions.length === 0 ? (
          <EmptyState
            icon={<SearchX className="size-8" strokeWidth={1.25} />}
            title="No auctions found."
            description="Nothing matches these filters right now. Try widening the price range, choosing another department, or clearing the search."
            action={
              <Button asChild variant="outline">
                <a href="/auctions">Clear all filters</a>
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {result.auctions.map((auction, index) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  priority={index < 4}
                />
              ))}
            </div>

            <Pagination
              className="mt-10 border-t border-line pt-6"
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              buildHref={buildHref}
            />
          </>
        )}
      </section>
    </>
  );
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Query strings carry major units; the domain works in minor units. */
function toMinor(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}
