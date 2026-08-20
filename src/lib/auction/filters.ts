/**
 * Catalogue filter vocabulary.
 *
 * Deliberately free of any server-only import: both the server query layer and
 * the client filter bar need these labels, and duplicating them is how the two
 * drift apart.
 */

export const SORT_OPTIONS = {
  "ending-soon": "Ending soonest",
  newest: "Newly listed",
  "highest-bid": "Highest current bid",
  "lowest-price": "Lowest starting price",
  "most-bids": "Most bids",
} as const;

export type SortKey = keyof typeof SORT_OPTIONS;

export const STATUS_FILTERS = {
  all: "All lots",
  live: "Live now",
  "ending-soon": "Ending soon",
  upcoming: "Upcoming",
  ended: "Closed",
} as const;

export type StatusFilter = keyof typeof STATUS_FILTERS;

export type AuctionFilters = {
  q?: string;
  category?: string;
  status?: StatusFilter;
  /** Minor units. */
  minPrice?: number;
  maxPrice?: number;
  sort?: SortKey;
  page?: number;
  perPage?: number;
};

export function isSortKey(value: string | undefined): value is SortKey {
  return Boolean(value && value in SORT_OPTIONS);
}

export function isStatusFilter(value: string | undefined): value is StatusFilter {
  return Boolean(value && value in STATUS_FILTERS);
}
