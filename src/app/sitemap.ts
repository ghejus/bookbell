import type { MetadataRoute } from "next";

// The list of public pages search engines may show. Shop pages are left out
// on purpose: most shops here are short-lived demo shops.
export default function sitemap(): MetadataRoute.Sitemap {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bookbell.vercel.app").replace(/\/+$/, "");
  return [
    { url: site, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/signup`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${site}/login`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
