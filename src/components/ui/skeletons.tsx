/**
 * Streaming placeholders.
 *
 * Each mirrors the geometry of the screen it stands in for, so content
 * arriving does not reflow the page — a skeleton that is the wrong shape is
 * worse than none.
 */

export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-surface">
      <div className="flex gap-4 border-b border-line bg-raised px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="skeleton h-2.5 flex-1 rounded-full" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 border-b border-line px-4 py-4 last:border-b-0">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-3.5 flex-1 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function HeaderSkeleton({ withRange = false }: { withRange?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="w-full max-w-xl">
        <div className="skeleton h-2.5 w-20 rounded-full" />
        <div className="skeleton mt-3 h-9 w-72 rounded-sm" />
        <div className="skeleton mt-3 h-3.5 w-full max-w-md rounded-sm" />
      </div>
      {withRange ? <div className="skeleton h-9 w-64 rounded-sm" /> : null}
    </div>
  );
}

export function TilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mt-8 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface p-5">
          <div className="skeleton h-2.5 w-24 rounded-full" />
          <div className="skeleton mt-3 h-7 w-20 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="rounded-sm border border-line bg-surface p-6">
      <div className="skeleton h-3.5 w-40 rounded-sm" />
      <div className="skeleton mt-2 h-2.5 w-56 rounded-full" />
      <div className="skeleton mt-6 w-full rounded-sm" style={{ height }} />
    </div>
  );
}
