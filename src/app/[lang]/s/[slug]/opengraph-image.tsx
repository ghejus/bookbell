import { ImageResponse } from "next/og";
import { getShopMeta } from "@/lib/booking";
import { ShareCard } from "@/lib/brand";
import { DEFAULT_LANG, isLang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/dict";
import { interFonts } from "@/lib/og-fonts";

// The picture shown when someone shares a shop's booking link,
// for example in WhatsApp or on Facebook.
export const alt = "Book online with Bookbell";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string; lang: string }> }) {
  const { slug, lang } = await params;
  const t = dictFor(isLang(lang) ? lang : DEFAULT_LANG);
  const shop = await getShopMeta(slug);
  return new ImageResponse(
    shop ? (
      <ShareCard title={shop.name} subtitle={shop.about} footer={t.shop.shareFooter} />
    ) : (
      <ShareCard title={t.shop.shareGeneric} subtitle="" footer="Bookbell" />
    ),
    { ...size, fonts: await interFonts() },
  );
}
