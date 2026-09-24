import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// lastModified tracks content changes, so bump a date when that page's
// copy changes (the legal pages match their effective dates).
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date("2026-09-24"),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date("2026-09-24"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date("2026-09-19"),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
