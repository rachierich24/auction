import { z } from "zod";

import { parseMoneyToMinor } from "@/lib/money";

/**
 * Auction authoring rules.
 *
 * Applied identically on the client (to save a round trip) and on the server
 * (because that is the only copy that counts). Money arrives as typed text and
 * is converted to integer minor units here, once.
 */

const money = (label: string, { min = 0 }: { min?: number } = {}) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value, ctx) => {
      const minorUnits = parseMoneyToMinor(value);
      if (minorUnits === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number.` });
        return z.NEVER;
      }
      if (minorUnits < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${label} must be at least ${min / 100}.`,
        });
        return z.NEVER;
      }
      return minorUnits;
    });

const optionalMoney = (label: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const minorUnits = parseMoneyToMinor(value);
      if (minorUnits === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number.` });
        return z.NEVER;
      }
      return minorUnits;
    });

/** Datetime-local strings arrive without a zone; the client sends the offset. */
const instant = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is not a valid date.` });
        return z.NEVER;
      }
      return date;
    });

export const auctionImageSchema = z.object({
  id: z.string().optional(),
  url: z.string().min(1).max(600),
  altText: z.string().max(300).optional().nullable(),
  sortOrder: z.number().int().min(0).max(200),
  isPrimary: z.boolean(),
});

export const auctionSchema = z
  .object({
    // -- Basic information -------------------------------------------------
    title: z.string().trim().min(3, "Give the lot a title.").max(180),
    lotNumber: z
      .string()
      .trim()
      .min(1, "Every lot needs a number.")
      .max(24)
      .regex(/^[A-Za-z0-9-]+$/, "Use letters, numbers and hyphens only."),
    slug: z
      .string()
      .trim()
      .max(200)
      .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only.")
      .optional(),
    categoryId: z.string().min(1, "Choose a department."),
    shortDescription: z
      .string()
      .trim()
      .min(10, "Write a short summary for the catalogue card.")
      .max(320),
    description: z
      .string()
      .trim()
      .min(20, "Write the full catalogue entry.")
      .max(20_000),

    // -- Pricing -----------------------------------------------------------
    startingPrice: money("Starting price", { min: 100 }),
    minimumIncrement: money("Bid increment", { min: 100 }),
    reservePrice: optionalMoney("Reserve price"),
    buyerPremiumBps: z.coerce
      .number()
      .int()
      .min(0, "Buyer's premium cannot be negative.")
      .max(5000, "Buyer's premium looks too high."),
    currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]),

    // -- Schedule ----------------------------------------------------------
    startAt: instant("Start time"),
    endAt: instant("End time"),

    // -- Behaviour ---------------------------------------------------------
    extensionEnabled: z.coerce.boolean(),
    extensionThresholdSec: z.coerce.number().int().min(0).max(3600),
    extensionDurationSec: z.coerce.number().int().min(0).max(3600),
    proxyBiddingEnabled: z.coerce.boolean(),
    watchlistEnabled: z.coerce.boolean(),
    featured: z.coerce.boolean(),

    // -- Presentation ------------------------------------------------------
    location: z.string().trim().max(120).optional().nullable(),
    shippingNote: z.string().trim().max(2000).optional().nullable(),
    paymentNote: z.string().trim().max(2000).optional().nullable(),

    /** Category-specific specifications. */
    attributes: z.record(z.string().max(80), z.string().max(1000)).default({}),

    images: z.array(auctionImageSchema).max(24).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.endAt.getTime() <= data.startAt.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endAt"],
        message: "The lot must close after it opens.",
      });
    }

    if (data.reservePrice !== null && data.reservePrice < data.startingPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reservePrice"],
        // A reserve below the opening bid is met by the first valid bid, which
        // is never what the consignor meant.
        message: "The reserve cannot be below the starting price.",
      });
    }

    if (data.extensionEnabled && data.extensionDurationSec === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["extensionDurationSec"],
        message: "An extension of zero seconds does nothing.",
      });
    }

    if (data.images.length > 0 && !data.images.some((image) => image.isPrimary)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["images"],
        message: "Choose which image leads the lot.",
      });
    }
  });

export type AuctionInput = z.infer<typeof auctionSchema>;

/** Dynamic specification fields declared per department. */
export const categoryFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Keys must start with a letter."),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["text", "textarea", "number", "date"]).default("text"),
  required: z.boolean().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name the department.").max(80),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and hyphens only.")
    .optional(),
  description: z.string().trim().max(400).optional().nullable(),
  image: z.string().trim().max(600).optional().nullable(),
  status: z.enum(["ACTIVE", "HIDDEN"]),
  sortOrder: z.coerce.number().int().min(0).max(999),
  fieldSchema: z.array(categoryFieldSchema).max(24).default([]),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryField = z.infer<typeof categoryFieldSchema>;
