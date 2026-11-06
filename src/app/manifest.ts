import type { MetadataRoute } from "next";
import { cookies, headers } from "next/headers";
import { brand } from "@/lib/brand";
import { isLang, LANG_COOKIE, pickLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/dict";

// Lets people add Bookbell to their phone's home screen, so it opens like an app.
// The description follows the visitor's language, like the pages do.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const chosen = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(chosen) ? chosen : pickLang((await headers()).get("accept-language"));
  return {
    name: "Bookbell",
    short_name: "Bookbell",
    description: dictFor(lang).home.metaDescription,
    lang,
    start_url: "/start",
    display: "standalone",
    background_color: brand.ground,
    theme_color: brand.ground,
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
