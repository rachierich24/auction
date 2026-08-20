import { parseJson } from "@/lib/db/json";
import { formatMoneyPlain } from "@/lib/money";
import { toLocalInputValue } from "@/lib/utils";

/**
 * Shapes and builders for the create/edit auction form.
 *
 * Deliberately *not* a `"use client"` module: the server pages call these to
 * seed the form, and the client component consumes the result. A helper
 * exported from a client module cannot be invoked on the server, so anything
 * both sides need lives here.
 */

export type EditorImage = {
  /** Stable key for React and drag identity; not the database id. */
  uid: string;
  id?: string;
  url: string;
  altText: string;
  isPrimary: boolean;
  uploading?: boolean;
  progress?: number;
  error?: string;
};

let counter = 0;

export function nextImageUid(): string {
  return `img-${Date.now().toString(36)}-${++counter}`;
}

export function makeEditorImage(input: {
  id?: string;
  url: string;
  altText?: string | null;
  isPrimary: boolean;
}): EditorImage {
  return {
    uid: nextImageUid(),
    id: input.id,
    url: input.url,
    altText: input.altText ?? "",
    isPrimary: input.isPrimary,
  };
}

export type AuctionFormValues = {
  id?: string;
  title: string;
  lotNumber: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  startingPrice: string;
  minimumIncrement: string;
  reservePrice: string;
  buyerPremiumBps: string;
  currency: string;
  startAt: string;
  endAt: string;
  extensionEnabled: boolean;
  extensionThresholdSec: string;
  extensionDurationSec: string;
  proxyBiddingEnabled: boolean;
  watchlistEnabled: boolean;
  featured: boolean;
  location: string;
  shippingNote: string;
  paymentNote: string;
  attributes: Record<string, string>;
  images: EditorImage[];
};

/** Blank form for a new lot, with sensible saleroom defaults. */
export function emptyAuctionValues(lotNumber: string): AuctionFormValues {
  // Opens as soon as it is published. Publishing a lot whose start time has
  // already passed sends it straight to LIVE, so listing an item and starting
  // the bidding is a single action — no scheduling, no second click. Set a
  // future date here instead if a lot should open later.
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  return {
    title: "",
    lotNumber,
    slug: "",
    categoryId: "",
    shortDescription: "",
    description: "",
    startingPrice: "",
    minimumIncrement: "",
    reservePrice: "",
    buyerPremiumBps: "12",
    currency: "INR",
    startAt: toLocalInputValue(start),
    endAt: toLocalInputValue(end),
    extensionEnabled: true,
    extensionThresholdSec: "120",
    extensionDurationSec: "120",
    proxyBiddingEnabled: true,
    watchlistEnabled: true,
    featured: false,
    location: "",
    shippingNote: "",
    paymentNote: "",
    attributes: {},
    images: [],
  };
}

/** Populates the form from a stored lot. Money is shown in major units. */
export function auctionValuesFrom(auction: {
  id: string;
  title: string;
  lotNumber: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  startingPrice: number;
  minimumIncrement: number;
  reservePrice: number | null;
  buyerPremiumBps: number;
  currency: string;
  startAt: Date;
  endAt: Date;
  extensionEnabled: boolean;
  extensionThresholdSec: number;
  extensionDurationSec: number;
  proxyBiddingEnabled: boolean;
  watchlistEnabled: boolean;
  featured: boolean;
  location: string | null;
  shippingNote: string | null;
  paymentNote: string | null;
  attributes: string;
  images: { id: string; url: string; altText: string | null; isPrimary: boolean }[];
}): AuctionFormValues {
  const plain = (minorUnits: number) =>
    formatMoneyPlain(minorUnits, auction.currency).replace(/,/g, "");

  return {
    id: auction.id,
    title: auction.title,
    lotNumber: auction.lotNumber,
    slug: auction.slug,
    categoryId: auction.categoryId,
    shortDescription: auction.shortDescription,
    description: auction.description,
    startingPrice: plain(auction.startingPrice),
    minimumIncrement: plain(auction.minimumIncrement),
    reservePrice: auction.reservePrice === null ? "" : plain(auction.reservePrice),
    // Stored as basis points, edited as a percentage.
    buyerPremiumBps: String(auction.buyerPremiumBps / 100),
    currency: auction.currency,
    startAt: toLocalInputValue(auction.startAt),
    endAt: toLocalInputValue(auction.endAt),
    extensionEnabled: auction.extensionEnabled,
    extensionThresholdSec: String(auction.extensionThresholdSec),
    extensionDurationSec: String(auction.extensionDurationSec),
    proxyBiddingEnabled: auction.proxyBiddingEnabled,
    watchlistEnabled: auction.watchlistEnabled,
    featured: auction.featured,
    location: auction.location ?? "",
    shippingNote: auction.shippingNote ?? "",
    paymentNote: auction.paymentNote ?? "",
    attributes: parseJson<Record<string, string>>(auction.attributes, {}),
    images: auction.images.map(makeEditorImage),
  };
}
