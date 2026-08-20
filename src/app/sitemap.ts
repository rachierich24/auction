import type { MetadataRoute } from "next";

import { prisma } from "@/lib/db/prisma";
import { PUBLIC_AUCTION_STATUSES } from "@/lib/validation/enums";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [auctions, categories] = await Promise.all([
    prisma.auction.findMany({
      // Drafts and withdrawn lots are not public, so they are not in the map.
      where: { status: { in: PUBLIC_AUCTION_STATUSES } },
      select: { slug: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    }),
    prisma.category.findMany({
      where: { status: "ACTIVE" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${BASE}/auctions`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/how-it-works`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/register`, changeFrequency: "yearly", priority: 0.4 },
  ];

  return [
    ...staticRoutes,

    ...categories.map((category) => ({
      url: `${BASE}/auctions?category=${category.slug}`,
      lastModified: category.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),

    ...auctions.map((auction) => ({
      url: `${BASE}/auction/${auction.slug}`,
      lastModified: auction.updatedAt,
      // A live lot changes with every bid; a settled one never changes again.
      changeFrequency:
        auction.status === "LIVE" || auction.status === "EXTENDED"
          ? ("hourly" as const)
          : ("weekly" as const),
      priority: auction.status === "LIVE" ? 0.8 : 0.5,
    })),
  ];
}
