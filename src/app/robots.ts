import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Nothing behind authentication, and nothing transactional, belongs in
        // an index.
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/profile",
          "/notifications",
          "/payment/",
          "/login",
          "/reset-password",
          "/verify-email",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
