import type { MetadataRoute } from "next";

// Tells search engines what to look at. Owner pages, the server's own
// addresses and private booking links stay out of search results.
export default function robots(): MetadataRoute.Robots {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bookbell.vercel.app").replace(/\/+$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/my", "/start", "/api/", "/auth/", "/b/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
