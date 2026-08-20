"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import { assertPermission } from "@/lib/auth/guards";
import { assertTransition, effectiveStatus } from "@/lib/auction/status";
import { settleAuction } from "@/lib/auction/settlement";
import { publish } from "@/lib/realtime/bus";
import { diffFields, recordAudit } from "@/lib/audit";
import { stringifyJson } from "@/lib/db/json";
import { auctionSchema } from "@/lib/validation/auction";
import { slugify } from "@/lib/utils";

export type AdminActionResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  id?: string;
  slug?: string;
};

function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Ensures a slug is unique, suffixing only when it actually collides. */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = slugify(base).slice(0, 120) || "lot";
  let candidate = root;

  for (let attempt = 2; attempt < 60; attempt++) {
    const clash = await prisma.auction.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!clash || clash.id === excludeId) return candidate;
    candidate = `${root}-${attempt}`;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function uniqueLotNumber(
  lotNumber: string,
  excludeId?: string,
): Promise<boolean> {
  const clash = await prisma.auction.findUnique({
    where: { lotNumber },
    select: { id: true },
  });
  return !clash || clash.id === excludeId;
}

/* -------------------------------------------------------------------------- */
/* Create                                                                      */
/* -------------------------------------------------------------------------- */

export async function createAuction(
  raw: unknown,
): Promise<AdminActionResult> {
  const user = await assertPermission("auction.create");

  const parsed = auctionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  if (!(await uniqueLotNumber(data.lotNumber))) {
    return { ok: false, errors: { lotNumber: "That lot number is already in use." } };
  }

  const slug = await uniqueSlug(data.slug || `${data.title}`);

  const auction = await prisma.auction.create({
    data: {
      lotNumber: data.lotNumber,
      title: data.title,
      slug,
      categoryId: data.categoryId,
      shortDescription: data.shortDescription,
      description: data.description,
      startingPrice: data.startingPrice,
      minimumIncrement: data.minimumIncrement,
      reservePrice: data.reservePrice,
      buyerPremiumBps: data.buyerPremiumBps,
      currency: data.currency,
      startAt: data.startAt,
      endAt: data.endAt,
      originalEndAt: data.endAt,
      // New lots always begin as drafts; publishing is a separate, audited act.
      status: "DRAFT",
      extensionEnabled: data.extensionEnabled,
      extensionThresholdSec: data.extensionThresholdSec,
      extensionDurationSec: data.extensionDurationSec,
      proxyBiddingEnabled: data.proxyBiddingEnabled,
      watchlistEnabled: data.watchlistEnabled,
      featured: data.featured,
      location: data.location || null,
      shippingNote: data.shippingNote || null,
      paymentNote: data.paymentNote || null,
      attributes: stringifyJson(data.attributes),
      createdById: user.id,
      images: {
        create: data.images.map((image, index) => ({
          url: image.url,
          altText: image.altText || null,
          sortOrder: index,
          isPrimary: image.isPrimary,
        })),
      },
    },
    select: { id: true, slug: true, lotNumber: true },
  });

  await recordAudit({
    actorId: user.id,
    action: "auction.create",
    entityType: "auction",
    entityId: auction.id,
    metadata: { lotNumber: auction.lotNumber, title: data.title },
  });

  revalidatePath("/admin/auctions");
  return { ok: true, id: auction.id, slug: auction.slug, message: "Auction created as a draft." };
}

/* -------------------------------------------------------------------------- */
/* Update                                                                      */
/* -------------------------------------------------------------------------- */

export async function updateAuction(
  id: string,
  raw: unknown,
): Promise<AdminActionResult> {
  const user = await assertPermission("auction.update");

  const parsed = auctionSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: fieldErrors(parsed.error) };
  }
  const data = parsed.data;

  const existing = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      lotNumber: true,
      title: true,
      startAt: true,
      endAt: true,
      startingPrice: true,
      minimumIncrement: true,
      reservePrice: true,
      bidCount: true,
      currentBid: true,
    },
  });
  if (!existing) return { ok: false, message: "That auction no longer exists." };

  if (!(await uniqueLotNumber(data.lotNumber, id))) {
    return { ok: false, errors: { lotNumber: "That lot number is already in use." } };
  }

  // Once a lot has bids on it, its economics are frozen. Changing the starting
  // price, increment or reserve underneath live bidders would retroactively
  // change what they agreed to.
  const hasBids = existing.bidCount > 0;
  if (hasBids) {
    const locked: Record<string, [bigint | null, number | null]> = {
      startingPrice: [existing.startingPrice, data.startingPrice],
      minimumIncrement: [existing.minimumIncrement, data.minimumIncrement],
      reservePrice: [existing.reservePrice, data.reservePrice],
    };
    for (const [field, [before, after]] of Object.entries(locked)) {
      const beforeNum = before === null ? null : Number(before);
      if (beforeNum !== after) {
        return {
          ok: false,
          errors: {
            [field]:
              "This lot already has bids — pricing terms can no longer be changed.",
          },
        };
      }
    }
  }

  const terminal = ["SOLD", "UNSOLD", "CANCELLED"];
  if (terminal.includes(existing.status)) {
    return {
      ok: false,
      message: `A ${existing.status.toLowerCase()} lot cannot be edited.`,
    };
  }

  const slug =
    data.slug && data.slug !== existing.slug
      ? await uniqueSlug(data.slug, id)
      : existing.slug;

  await prisma.$transaction(async (tx) => {
    await tx.auction.update({
      where: { id },
      data: {
        lotNumber: data.lotNumber,
        title: data.title,
        slug,
        categoryId: data.categoryId,
        shortDescription: data.shortDescription,
        description: data.description,
        startingPrice: data.startingPrice,
        minimumIncrement: data.minimumIncrement,
        reservePrice: data.reservePrice,
        buyerPremiumBps: data.buyerPremiumBps,
        currency: data.currency,
        startAt: data.startAt,
        endAt: data.endAt,
        // Editing the schedule resets the anti-snipe baseline.
        originalEndAt: data.endAt,
        extensionEnabled: data.extensionEnabled,
        extensionThresholdSec: data.extensionThresholdSec,
        extensionDurationSec: data.extensionDurationSec,
        proxyBiddingEnabled: data.proxyBiddingEnabled,
        watchlistEnabled: data.watchlistEnabled,
        featured: data.featured,
        location: data.location || null,
        shippingNote: data.shippingNote || null,
        paymentNote: data.paymentNote || null,
        attributes: stringifyJson(data.attributes),
      },
    });

    // Images are replaced wholesale — the form always sends the complete,
    // ordered set, so reconciling row by row would be needless complexity.
    await tx.auctionImage.deleteMany({ where: { auctionId: id } });
    if (data.images.length > 0) {
      await tx.auctionImage.createMany({
        data: data.images.map((image, index) => ({
          auctionId: id,
          url: image.url,
          altText: image.altText || null,
          sortOrder: index,
          isPrimary: image.isPrimary,
        })),
      });
    }
  });

  await recordAudit({
    actorId: user.id,
    action: "auction.update",
    entityType: "auction",
    entityId: id,
    metadata: {
      lotNumber: data.lotNumber,
      changes: diffFields(
        {
          title: existing.title,
          startAt: existing.startAt,
          endAt: existing.endAt,
        },
        { title: data.title, startAt: data.startAt, endAt: data.endAt },
      ),
    },
  });

  revalidatePath("/admin/auctions");
  revalidatePath(`/auction/${slug}`);
  return { ok: true, id, slug, message: "Changes saved." };
}

/* -------------------------------------------------------------------------- */
/* Lifecycle                                                                   */
/* -------------------------------------------------------------------------- */

const lifecycleInput = z.object({
  id: z.string().min(1),
  action: z.enum([
    "publish",
    "unpublish",
    "start",
    "end",
    "cancel",
    "feature",
    "unfeature",
  ]),
});

export async function auctionLifecycle(
  raw: z.input<typeof lifecycleInput>,
): Promise<AdminActionResult> {
  const parsed = lifecycleInput.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Unrecognised action." };
  const { id, action } = parsed.data;

  const user = await assertPermission(
    action === "publish" || action === "unpublish"
      ? "auction.publish"
      : action === "feature" || action === "unfeature"
        ? "auction.update"
        : "auction.lifecycle",
  );

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      status: true,
      lotNumber: true,
      startAt: true,
      endAt: true,
      bidCount: true,
    },
  });
  if (!auction) return { ok: false, message: "That auction no longer exists." };

  const from = auction.status as never;

  try {
    switch (action) {
      case "feature":
      case "unfeature": {
        await prisma.auction.update({
          where: { id },
          data: { featured: action === "feature" },
        });
        break;
      }

      case "publish": {
        assertTransition(from, "UPCOMING");
        // A lot whose opening time has already passed goes straight to live.
        const target =
          auction.startAt.getTime() <= Date.now() &&
          auction.endAt.getTime() > Date.now()
            ? "LIVE"
            : "UPCOMING";

        await prisma.auction.update({
          where: { id },
          data: { status: "UPCOMING", publishedAt: new Date() },
        });
        if (target === "LIVE") {
          assertTransition("UPCOMING", "LIVE");
          await prisma.auction.update({
            where: { id },
            data: { status: "LIVE" },
          });
        }
        break;
      }

      case "unpublish": {
        if (auction.bidCount > 0) {
          return {
            ok: false,
            message: "This lot already has bids and cannot be withdrawn from sale.",
          };
        }
        assertTransition(from, "DRAFT");
        await prisma.auction.update({
          where: { id },
          data: { status: "DRAFT", publishedAt: null },
        });
        break;
      }

      case "start": {
        assertTransition(from, "LIVE");
        await prisma.auction.update({
          where: { id },
          data: {
            status: "LIVE",
            // Opening early moves the clock rather than pretending it did not.
            startAt: new Date(),
            publishedAt: new Date(),
          },
        });
        break;
      }

      case "end": {
        // Settlement decides SOLD vs UNSOLD against the reserve; the admin
        // only decides *when*.
        const outcome = await settleAuction(id, { force: true });
        if (outcome.status === "SKIPPED") {
          return { ok: false, message: `Could not close this lot: ${outcome.reason}.` };
        }
        await recordAudit({
          actorId: user.id,
          action: "auction.end",
          entityType: "auction",
          entityId: id,
          metadata: { outcome: outcome.status, lotNumber: auction.lotNumber },
        });
        revalidatePath("/admin/auctions");
        revalidatePath(`/auction/${auction.slug}`);
        return {
          ok: true,
          message:
            outcome.status === "SOLD"
              ? "Lot closed and sold. The winner has been notified."
              : "Lot closed unsold — the reserve was not met.",
        };
      }

      case "cancel": {
        assertTransition(from, "CANCELLED");
        await prisma.auction.update({
          where: { id },
          data: { status: "CANCELLED", settledAt: new Date() },
        });
        await prisma.proxyBid.updateMany({
          where: { auctionId: id },
          data: { active: false },
        });
        publish({
          type: "status",
          auctionId: id,
          status: "CANCELLED",
          endAt: new Date().toISOString(),
          at: new Date().toISOString(),
        });
        break;
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "InvalidTransitionError") {
      return { ok: false, message: error.message };
    }
    throw error;
  }

  await recordAudit({
    actorId: user.id,
    action: `auction.${action === "feature" || action === "unfeature" ? "update" : action}` as never,
    entityType: "auction",
    entityId: id,
    metadata: { lotNumber: auction.lotNumber, from: auction.status, action },
  });

  revalidatePath("/admin/auctions");
  revalidatePath(`/auction/${auction.slug}`);
  revalidatePath("/");

  // `end` returns early above (settlement reports its own outcome), so it is
  // deliberately absent here.
  const messages: Record<Exclude<typeof action, "end">, string> = {
    publish: "Auction published.",
    unpublish: "Auction returned to draft.",
    start: "Bidding is now open.",
    cancel: "Auction cancelled.",
    feature: "Added to featured lots.",
    unfeature: "Removed from featured lots.",
  };

  return { ok: true, message: messages[action] };
}

/* -------------------------------------------------------------------------- */
/* Duplicate & delete                                                          */
/* -------------------------------------------------------------------------- */

export async function duplicateAuction(id: string): Promise<AdminActionResult> {
  const user = await assertPermission("auction.create");

  const source = await prisma.auction.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return { ok: false, message: "That auction no longer exists." };

  const lotNumber = await nextLotNumber(source.lotNumber);
  const slug = await uniqueSlug(`${source.title}-copy`);

  const copy = await prisma.auction.create({
    data: {
      lotNumber,
      title: `${source.title} (copy)`,
      slug,
      categoryId: source.categoryId,
      shortDescription: source.shortDescription,
      description: source.description,
      startingPrice: source.startingPrice,
      minimumIncrement: source.minimumIncrement,
      reservePrice: source.reservePrice,
      buyerPremiumBps: source.buyerPremiumBps,
      currency: source.currency,
      startAt: source.startAt,
      endAt: source.endAt,
      originalEndAt: source.endAt,
      // A duplicate is a fresh draft: no bids, no history, no winner.
      status: "DRAFT",
      extensionEnabled: source.extensionEnabled,
      extensionThresholdSec: source.extensionThresholdSec,
      extensionDurationSec: source.extensionDurationSec,
      proxyBiddingEnabled: source.proxyBiddingEnabled,
      watchlistEnabled: source.watchlistEnabled,
      featured: false,
      location: source.location,
      shippingNote: source.shippingNote,
      paymentNote: source.paymentNote,
      attributes: source.attributes,
      createdById: user.id,
      images: {
        create: source.images.map((image) => ({
          url: image.url,
          altText: image.altText,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      },
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: user.id,
    action: "auction.duplicate",
    entityType: "auction",
    entityId: copy.id,
    metadata: { copiedFrom: id, lotNumber },
  });

  revalidatePath("/admin/auctions");
  return { ok: true, id: copy.id, message: `Duplicated as lot ${lotNumber}.` };
}

export async function deleteAuction(id: string): Promise<AdminActionResult> {
  const user = await assertPermission("auction.delete");

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: { id: true, lotNumber: true, title: true, status: true, bidCount: true },
  });
  if (!auction) return { ok: false, message: "That auction no longer exists." };

  // Bids are a financial record. A lot that has been bid on is cancelled, never
  // deleted, so the ledger stays intact.
  if (auction.bidCount > 0) {
    return {
      ok: false,
      message:
        "This lot has bids against it. Cancel it instead — the bid history must be preserved.",
    };
  }

  await prisma.auction.delete({ where: { id } });

  await recordAudit({
    actorId: user.id,
    action: "auction.delete",
    entityType: "auction",
    entityId: id,
    metadata: { lotNumber: auction.lotNumber, title: auction.title },
  });

  revalidatePath("/admin/auctions");
  return { ok: true, message: `Lot ${auction.lotNumber} deleted.` };
}

/** Suggests the next free lot number, preserving any alpha prefix. */
async function nextLotNumber(seed: string): Promise<string> {
  const match = seed.match(/^([A-Za-z-]*)(\d+)$/);
  const prefix = match?.[1] ?? "";
  let value = match ? Number(match[2]) : 1;

  for (let attempt = 0; attempt < 500; attempt++) {
    value += 1;
    const candidate = `${prefix}${value}`;
    const clash = await prisma.auction.findUnique({
      where: { lotNumber: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  return `${prefix}${Date.now().toString(36)}`;
}

/** Suggested next lot number for the create form. */
export async function suggestLotNumber(): Promise<string> {
  await assertPermission("auction.create");
  const latest = await prisma.auction.findFirst({
    orderBy: { createdAt: "desc" },
    select: { lotNumber: true },
  });
  return latest ? nextLotNumber(latest.lotNumber) : "101";
}

/** Re-derives status for one lot; used by the row-level "refresh" control. */
export async function reconcileAuction(id: string): Promise<AdminActionResult> {
  await assertPermission("auction.view");

  const auction = await prisma.auction.findUnique({
    where: { id },
    select: { id: true, status: true, startAt: true, endAt: true },
  });
  if (!auction) return { ok: false, message: "That auction no longer exists." };

  const target = effectiveStatus(auction);
  if (target === auction.status) {
    return { ok: true, message: "Already up to date." };
  }

  if (auction.status === "UPCOMING" && target !== "UPCOMING") {
    await prisma.auction.updateMany({
      where: { id, status: "UPCOMING" },
      data: { status: "LIVE" },
    });
  } else if (target === "ENDED") {
    await settleAuction(id);
  }

  revalidatePath("/admin/auctions");
  return { ok: true, message: "Status brought up to date." };
}

export async function listCategoriesForForm() {
  await assertPermission("auction.view");
  return prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, fieldSchema: true, status: true },
  });
}
