import { ImageResponse } from "next/og";
import { ShareCard } from "@/lib/brand";
import { DEFAULT_LANG, isLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/dict";
import { interFonts } from "@/lib/og-fonts";

// The picture shown when someone shares the Bookbell home page (and any page
// without its own picture), in the language of the page.
export const alt = "Bookbell";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const t = dictFor(isLang(lang) ? lang : DEFAULT_LANG);
  return new ImageResponse(<ShareCard title={t.home.shareTitle} subtitle={t.home.shareText} footer={t.home.shareFooter} />, {
    ...size,
    fonts: await interFonts(),
  });
}
