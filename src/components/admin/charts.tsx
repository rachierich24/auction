"use client";

import * as React from "react";

import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Analytics charts, hand-drawn as SVG.
 *
 * Every chart here plots exactly one measure, so a categorical palette would
 * be wrong: one hue does the work and identity is carried by the axis label.
 * That also means no legend box — the chart title names the series.
 *
 * Shared specs: 2px lines, area washes at ~10%, bars capped at 24px with a
 * 4px rounded data-end and a square baseline, hairline solid gridlines one
 * step off the surface, and end-markers ringed in the surface colour so they
 * stay legible where they cross the line.
 */

const SERIES = "var(--color-chart-series)";
const GRID = "var(--color-chart-grid)";
const SURFACE = "var(--color-surface)";

export type Point = { label: string; value: number; date?: string };

/* -------------------------------------------------------------------------- */
/* Shared chrome                                                               */
/* -------------------------------------------------------------------------- */

export function ChartFrame({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-sm border border-line bg-surface p-6", className)}
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
          {subtitle ? (
            <p className="mt-1 text-[0.75rem] text-muted">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    magnitude * 10;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) {
    ticks.push(Math.round(value * 1000) / 1000);
  }
  return ticks;
}

/**
 * Charts are client components; their parents are server components. A
 * formatter therefore cannot be passed as a function prop — functions do not
 * cross the RSC boundary. The parent names a format instead, and the mapping
 * lives here.
 */
export type ValueFormat = "count" | "money" | "money-compact";

function formatValue(
  value: number,
  format: ValueFormat,
  currency = "INR",
): string {
  switch (format) {
    case "money":
      return formatMoney(value, currency);
    case "money-compact":
      return formatMoney(value, currency, { compact: true });
    case "count":
    default:
      return new Intl.NumberFormat("en-IN", {
        notation: value >= 10_000 ? "compact" : "standard",
        maximumFractionDigits: 1,
      }).format(value);
  }
}

/* -------------------------------------------------------------------------- */
/* Area trend — change over time                                               */
/* -------------------------------------------------------------------------- */

export function AreaTrend({
  data,
  format = "count",
  currency,
  height = 220,
  emptyMessage = "No activity in this period.",
}: {
  data: Point[];
  format?: ValueFormat;
  currency?: string;
  height?: number;
  emptyMessage?: string;
}) {
  const fmt = (value: number) => formatValue(value, format, currency);
  const [hover, setHover] = React.useState<number | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  if (data.length === 0 || data.every((point) => point.value === 0)) {
    return <EmptyPlot height={height} message={emptyMessage} />;
  }

  const padding = { top: 12, right: 16, bottom: 26, left: 44 };
  const width = 720;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const max = Math.max(...data.map((point) => point.value));
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1] || 1;

  const x = (index: number) =>
    padding.left +
    (data.length === 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const y = (value: number) =>
    padding.top + plotH - (value / scaleMax) * plotH;

  const line = data
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`)
    .join(" ");

  const area = `${line} L${x(data.length - 1)},${padding.top + plotH} L${x(0)},${padding.top + plotH} Z`;

  // The last point is the one worth labelling — it is "where things stand now".
  const lastIndex = data.length - 1;
  const active = hover ?? lastIndex;
  const activePoint = data[active];

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const ratio = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(
      ((ratio - padding.left) / plotW) * (data.length - 1),
    );
    setHover(Math.min(data.length - 1, Math.max(0, index)));
  }

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none"
        style={{ height }}
        role="img"
        aria-label={`Trend from ${data[0].label} to ${data[lastIndex].label}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {/* Gridlines — hairline, solid, recessive */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={GRID}
              strokeWidth={1}
            />
            <text
              x={padding.left - 10}
              y={y(tick) + 3.5}
              textAnchor="end"
              className="fill-[var(--color-faint)] text-[10px] tabular"
            >
              {fmt(tick)}
            </text>
          </g>
        ))}

        <path d={area} fill="var(--color-chart-wash)" />
        <path
          d={line}
          fill="none"
          stroke={SERIES}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair */}
        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padding.top}
            y2={padding.top + plotH}
            stroke={GRID}
            strokeWidth={1}
          />
        ) : null}

        {/* End / hovered marker, ringed in the surface colour */}
        <circle
          cx={x(active)}
          cy={y(activePoint.value)}
          r={5}
          fill={SERIES}
          stroke={SURFACE}
          strokeWidth={2}
        />

        {/* X labels — first, middle and last only, so they never collide */}
        {[0, Math.floor(lastIndex / 2), lastIndex]
          .filter((index, position, all) => all.indexOf(index) === position)
          .map((index) => (
            <text
              key={index}
              x={x(index)}
              y={height - 8}
              textAnchor={index === 0 ? "start" : index === lastIndex ? "end" : "middle"}
              className="fill-[var(--color-faint)] text-[10px]"
            >
              {data[index].label}
            </text>
          ))}
      </svg>

      {/* Tooltip */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm border border-line bg-surface px-2.5 py-1.5 shadow-card transition-opacity",
          hover === null ? "opacity-0" : "opacity-100",
        )}
        style={{ left: `${(x(active) / width) * 100}%` }}
      >
        <p className="text-[0.6875rem] text-faint">{activePoint.label}</p>
        <p className="text-[0.8125rem] font-semibold text-ink tabular">
          {fmt(activePoint.value)}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Horizontal bars — magnitude across nominal categories                       */
/* -------------------------------------------------------------------------- */

export function BarSeries({
  data,
  format = "count",
  currency,
  emptyMessage = "Nothing to show yet.",
  max: providedMax,
}: {
  data: Point[];
  format?: ValueFormat;
  currency?: string;
  emptyMessage?: string;
  max?: number;
}) {
  const fmt = (value: number) => formatValue(value, format, currency);
  const [hover, setHover] = React.useState<string | null>(null);

  if (data.length === 0) {
    return <EmptyPlot height={180} message={emptyMessage} />;
  }

  const max = providedMax ?? Math.max(...data.map((point) => point.value), 1);

  return (
    <ul className="space-y-3.5">
      {data.map((point) => {
        const pct = max > 0 ? (point.value / max) * 100 : 0;
        return (
          <li
            key={point.label}
            onPointerEnter={() => setHover(point.label)}
            onPointerLeave={() => setHover(null)}
            className="group"
          >
            <div className="mb-1.5 flex items-baseline justify-between gap-4">
              <span className="truncate text-[0.8125rem] text-ink-soft">
                {point.label}
              </span>
              {/* Value at the tip — the axis is implicit on a bar list */}
              <span className="shrink-0 text-[0.8125rem] font-medium text-ink tabular">
                {fmt(point.value)}
              </span>
            </div>

            {/* Track is a lighter step of the same surface family, so the
                unfilled portion still reads as part of the measure. */}
            <div className="h-2 w-full overflow-hidden rounded-[2px] bg-[var(--color-chart-track)]">
              <div
                className={cn(
                  "h-full rounded-r-[4px] transition-[width,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  hover && hover !== point.label ? "opacity-45" : "opacity-100",
                )}
                style={{
                  width: `${Math.max(pct, point.value > 0 ? 1.5 : 0)}%`,
                  backgroundColor: SERIES,
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Columns — counts over a small number of buckets                             */
/* -------------------------------------------------------------------------- */

export function ColumnSeries({
  data,
  format = "count",
  currency,
  height = 200,
  emptyMessage = "Nothing to show yet.",
}: {
  data: Point[];
  format?: ValueFormat;
  currency?: string;
  height?: number;
  emptyMessage?: string;
}) {
  const fmt = (value: number) => formatValue(value, format, currency);
  const [hover, setHover] = React.useState<number | null>(null);

  if (data.length === 0) {
    return <EmptyPlot height={height} message={emptyMessage} />;
  }

  const max = Math.max(...data.map((point) => point.value), 1);
  const peak = data.reduce(
    (best, point, index) => (point.value > data[best].value ? index : best),
    0,
  );

  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((point, index) => {
        const pct = (point.value / max) * 100;
        const highlighted = hover === index || (hover === null && index === peak);

        return (
          <div
            key={point.label}
            className="flex h-full min-w-0 flex-1 flex-col justify-end"
            onPointerEnter={() => setHover(index)}
            onPointerLeave={() => setHover(null)}
          >
            {/* Only the peak (or hovered) column carries a value — a number on
                every column is noise. */}
            <span
              className={cn(
                "mb-1.5 text-center text-[0.6875rem] font-medium tabular transition-opacity",
                highlighted ? "text-ink opacity-100" : "opacity-0",
              )}
            >
              {fmt(point.value)}
            </span>

            <div
              className="mx-auto w-full max-w-6 rounded-t-[4px] transition-[height,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{
                height: `${Math.max(pct, point.value > 0 ? 2 : 0)}%`,
                backgroundColor: SERIES,
                opacity: hover !== null && hover !== index ? 0.45 : 1,
              }}
            />

            <span className="mt-2 truncate text-center text-[0.625rem] text-faint">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat tile                                                                   */
/* -------------------------------------------------------------------------- */

export function StatTile({
  label,
  value,
  delta,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  /** Signed change against a named period, e.g. "+12% vs last 30 days". */
  delta?: { value: string; positive: boolean };
  hint?: string;
  tone?: "default" | "accent" | "caution";
  className?: string;
}) {
  return (
    <div className={cn("bg-surface p-5", className)}>
      <p className="text-[0.6875rem] uppercase tracking-[0.1em] text-faint">
        {label}
      </p>
      {/* Proportional figures: a large standalone number looks loose in
          tabular. Tabular is reserved for columns that must align. */}
      <p
        className={cn(
          "mt-2 text-[1.75rem] font-semibold leading-none tracking-tight",
          tone === "accent"
            ? "text-[var(--color-chart-series)]"
            : tone === "caution"
              ? "text-caution"
              : "text-ink",
        )}
      >
        {value}
      </p>
      {delta || hint ? (
        <p className="mt-2 flex items-center gap-2 text-[0.75rem]">
          {delta ? (
            <span
              className={cn(
                "font-medium",
                delta.positive ? "text-positive" : "text-live",
              )}
            >
              {delta.value}
            </span>
          ) : null}
          {hint ? <span className="text-faint">{hint}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function EmptyPlot({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-sm border border-dashed border-line"
      style={{ height }}
    >
      <p className="text-[0.8125rem] text-faint">{message}</p>
    </div>
  );
}
