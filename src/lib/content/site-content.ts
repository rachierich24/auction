import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { parseJson, stringifyJson } from "@/lib/db/json";

/**
 * Editable site copy.
 *
 * Every string a content manager might reasonably want to change lives here
 * rather than in a component, so routine copy changes never need a deploy.
 * Defaults below are the fallback when a key has not been overridden yet.
 */

export const heroSchema = z.object({
  eyebrow: z.string().max(80),
  headline: z.string().max(120),
  body: z.string().max(400),
  primaryCta: z.object({ label: z.string().max(40), href: z.string().max(200) }),
  secondaryCta: z.object({ label: z.string().max(40), href: z.string().max(200) }),
});

export const trustSchema = z.object({
  heading: z.string().max(120),
  body: z.string().max(400),
  points: z
    .array(z.object({ title: z.string().max(80), body: z.string().max(300) }))
    .max(6),
});

export const howItWorksSchema = z.object({
  heading: z.string().max(120),
  body: z.string().max(400),
  steps: z
    .array(z.object({ title: z.string().max(80), body: z.string().max(300) }))
    .max(6),
});

export const announcementSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(200),
  href: z.string().max(200).optional(),
});

export const footerSchema = z.object({
  blurb: z.string().max(400),
  email: z.string().max(120),
  phone: z.string().max(60),
  address: z.string().max(200),
  legalName: z.string().max(120),
});

export const newsletterSchema = z.object({
  heading: z.string().max(120),
  body: z.string().max(300),
});

const SCHEMAS = {
  hero: heroSchema,
  trust: trustSchema,
  howItWorks: howItWorksSchema,
  announcement: announcementSchema,
  footer: footerSchema,
  newsletter: newsletterSchema,
} as const;

export type ContentKey = keyof typeof SCHEMAS;
export type ContentValue<K extends ContentKey> = z.infer<(typeof SCHEMAS)[K]>;

export const CONTENT_DEFAULTS: { [K in ContentKey]: ContentValue<K> } = {
  hero: {
    eyebrow: "Curated sales · Live bidding",
    headline: "Bid. Win. Own.",
    body: "A curated saleroom for collectors. Every lot is catalogued, condition-reported and sold under a transparent, server-timed bidding process — with a full ledger of every bid placed.",
    primaryCta: { label: "Explore Auctions", href: "/auctions" },
    secondaryCta: { label: "How It Works", href: "/how-it-works" },
  },

  trust: {
    heading: "A saleroom built on evidence, not assurances",
    body: "Collectors commit real money on the strength of what a house can prove. Every mechanism below is visible to bidders, not merely promised to them.",
    points: [
      {
        title: "Server-timed bidding",
        body: "Bids are accepted, ordered and closed by the server clock. A browser's clock never decides whether a lot is open, and a bid placed after the hammer is rejected outright.",
      },
      {
        title: "A complete public ledger",
        body: "Every bid on every lot is recorded and shown in sequence with its timestamp. Bidder identities are masked; the bidding itself is not.",
      },
      {
        title: "Anti-sniping extensions",
        body: "A bid inside the closing window pushes the close out, so a lot is decided by the highest bidder rather than the fastest connection.",
      },
      {
        title: "Reserves stated plainly",
        body: "Whether a lot carries a reserve is disclosed before bidding opens, and whether that reserve has been met is shown live.",
      },
    ],
  },

  howItWorks: {
    heading: "How the saleroom works",
    body: "Four steps from registration to collection. No proxy fees, no hidden increments.",
    steps: [
      {
        title: "Register",
        body: "Create an account and confirm your email. Registration is free and takes under a minute.",
      },
      {
        title: "Browse the catalogue",
        body: "Every lot carries a condition report, specifications, provenance where known, and the full bid history to date.",
      },
      {
        title: "Place your bid",
        body: "Bid the minimum increment or set a maximum and let the saleroom bid on your behalf, up to your ceiling and no further.",
      },
      {
        title: "Settle and collect",
        body: "Winning bidders receive an invoice with the buyer's premium itemised, then arrange shipping or collection.",
      },
    ],
  },

  announcement: {
    enabled: true,
    message: "The Autumn Collectors' Sale is now open for bidding.",
    href: "/auctions?status=live",
  },

  footer: {
    blurb: "Maison Auctions is an independent saleroom for collectors of horology, fine art, automobiles and rare objects.",
    email: "saleroom@maison.auction",
    phone: "+91 22 4000 1200",
    address: "14 Ballard Estate, Mumbai 400001, India",
    legalName: "Maison Auctions Private Limited",
  },

  newsletter: {
    heading: "Catalogue previews, before the room",
    body: "Consignment highlights and opening times for each sale. One email per sale, nothing else.",
  },
};

/** Reads a content block, falling back to the default when unset or corrupt. */
export async function getContent<K extends ContentKey>(
  key: K,
): Promise<ContentValue<K>> {
  const row = await prisma.siteContent
    .findUnique({ where: { key } })
    .catch(() => null);

  if (!row) return CONTENT_DEFAULTS[key];

  const parsed = SCHEMAS[key].safeParse(parseJson(row.value, null));
  return parsed.success
    ? (parsed.data as ContentValue<K>)
    : CONTENT_DEFAULTS[key];
}

export async function getAllContent(): Promise<{
  [K in ContentKey]: ContentValue<K>;
}> {
  const rows = await prisma.siteContent.findMany().catch(() => []);
  const byKey = new Map(rows.map((row) => [row.key, row.value]));

  const result = { ...CONTENT_DEFAULTS };
  for (const key of Object.keys(SCHEMAS) as ContentKey[]) {
    const raw = byKey.get(key);
    if (!raw) continue;
    const parsed = SCHEMAS[key].safeParse(parseJson(raw, null));
    if (parsed.success) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (result as any)[key] = parsed.data;
    }
  }
  return result;
}

export async function setContent<K extends ContentKey>(
  key: K,
  value: unknown,
  updatedById: string,
): Promise<ContentValue<K>> {
  const parsed = SCHEMAS[key].parse(value) as ContentValue<K>;

  await prisma.siteContent.upsert({
    where: { key },
    create: { key, value: stringifyJson(parsed), updatedById },
    update: { value: stringifyJson(parsed), updatedById },
  });

  return parsed;
}

export function contentSchema(key: ContentKey) {
  return SCHEMAS[key];
}
