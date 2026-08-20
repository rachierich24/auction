import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** URL-safe slug. Falls back to a random suffix when input has no word chars. */
export function slugify(input: string): string {
  const base = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return base || `lot-${Math.random().toString(36).slice(2, 8)}`;
}

/** "2 minutes ago", "in 3 hours" — for bid history and activity feeds. */
export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const diffMs = target.getTime() - now.getTime();
  const abs = Math.abs(diffMs);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 24 * 3600_000],
    ["month", 30 * 24 * 3600_000],
    ["day", 24 * 3600_000],
    ["hour", 3600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];

  if (abs < 45_000) return diffMs < 0 ? "just now" : "in a moment";

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (abs >= ms) return formatter.format(Math.round(diffMs / ms), unit);
  }
  return "just now";
}

const DEFAULT_TZ =
  process.env.NEXT_PUBLIC_DEFAULT_TIMEZONE ?? "Asia/Kolkata";

/**
 * Times are stored UTC and rendered in the viewer's zone. Server-rendered
 * output uses the configured house timezone so first paint matches the
 * saleroom's own clock rather than the server's.
 */
export function formatDateTime(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = {},
  timeZone: string = DEFAULT_TZ,
): string {
  const target = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
    ...options,
  }).format(target);
}

export function formatDate(
  date: Date | string,
  timeZone: string = DEFAULT_TZ,
): string {
  return formatDateTime(date, { dateStyle: "medium", timeStyle: undefined }, timeZone);
}

/** Value for a datetime-local input, expressed in the given timezone. */
export function toLocalInputValue(
  date: Date | string,
  timeZone: string = DEFAULT_TZ,
): string {
  const target = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(target);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

/**
 * Interprets a `datetime-local` string as a wall-clock time in `timeZone` and
 * returns the corresponding UTC instant. Admins schedule in saleroom time; the
 * database only ever sees UTC.
 */
export function fromLocalInputValue(
  value: string,
  timeZone: string = DEFAULT_TZ,
): Date {
  // Treat the input as UTC first, then correct by the zone's offset at that
  // instant (handles DST for zones that observe it).
  const naive = new Date(`${value}:00Z`);
  if (Number.isNaN(naive.getTime())) return new Date(NaN);

  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(naive);

  const get = (type: string) => Number(formatted.find((p) => p.type === type)?.value ?? 0);
  const asZoned = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );

  return new Date(naive.getTime() * 2 - asZoned);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function truncate(input: string, max: number): string {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}

/** Clamp a page number parsed from an untrusted query string. */
export function safePage(raw: string | undefined, max = 10_000): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(Math.floor(parsed), max);
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
