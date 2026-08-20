/**
 * Money is an integer count of minor units (paise for INR) everywhere in this
 * codebase — database, domain logic, API payloads. Floats are only ever
 * produced at the final formatting step.
 */

export const MINOR_UNITS_PER_MAJOR = 100;

export type Currency = "INR" | "USD" | "EUR" | "GBP" | "AED";

const CURRENCY_LOCALE: Record<Currency, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  AED: "en-AE",
};

/** 250000 (paise) -> "₹2,500" */
export function formatMoney(
  minor: number | null | undefined,
  currency: string = "INR",
  options: { showDecimals?: boolean; compact?: boolean } = {},
): string {
  if (minor === null || minor === undefined) return "—";
  const cur = (currency as Currency) in CURRENCY_LOCALE ? (currency as Currency) : "INR";
  const major = minor / MINOR_UNITS_PER_MAJOR;
  const hasFraction = minor % MINOR_UNITS_PER_MAJOR !== 0;
  const showDecimals = options.showDecimals ?? hasFraction;

  return new Intl.NumberFormat(CURRENCY_LOCALE[cur], {
    style: "currency",
    currency: cur,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
    notation: options.compact ? "compact" : "standard",
  }).format(major);
}

/** 250000 -> "2,500" (no symbol; for inputs and tight table cells) */
export function formatMoneyPlain(minor: number, currency = "INR"): string {
  const cur = (currency as Currency) in CURRENCY_LOCALE ? (currency as Currency) : "INR";
  const hasFraction = minor % MINOR_UNITS_PER_MAJOR !== 0;
  return new Intl.NumberFormat(CURRENCY_LOCALE[cur], {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(minor / MINOR_UNITS_PER_MAJOR);
}

export function currencySymbol(currency = "INR"): string {
  const cur = (currency as Currency) in CURRENCY_LOCALE ? (currency as Currency) : "INR";
  const parts = new Intl.NumberFormat(CURRENCY_LOCALE[cur], {
    style: "currency",
    currency: cur,
  }).formatToParts(0);
  return parts.find((p) => p.type === "currency")?.value ?? "₹";
}

/**
 * Parse user input ("2,500", "2500.50", "₹2,500") into minor units.
 * Returns null when the input is not a clean positive amount — callers must
 * treat null as a validation failure rather than coercing to zero.
 */
export function parseMoneyToMinor(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * MINOR_UNITS_PER_MAJOR);
  }
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned || cleaned.split(".").length > 2) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * MINOR_UNITS_PER_MAJOR);
}

export function majorToMinor(major: number): number {
  return Math.round(major * MINOR_UNITS_PER_MAJOR);
}

export function minorToMajor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/** Buyer's premium is stored in basis points: 1200 bps = 12%. */
export function buyerPremiumFor(hammerMinor: number, bps: number): number {
  return Math.round((hammerMinor * bps) / 10_000);
}

export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
}

/**
 * Normalises a money column read from the database.
 *
 * Money is stored in 64-bit columns so a lot is never capped by a 32-bit
 * ceiling, and Prisma hands those back as `bigint`. Every read is funnelled
 * through here so no arithmetic anywhere in the app can accidentally mix a
 * `bigint` with a `number` — a combination JavaScript throws on.
 *
 * `Number` is exact for integers up to 2^53, i.e. ninety trillion rupees in
 * paise, so the conversion is lossless for any amount a saleroom will see.
 */
export function minor(value: bigint | number): number;
export function minor(value: bigint | number | null | undefined): number | null;
export function minor(value: bigint | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return typeof value === "bigint" ? Number(value) : value;
}
