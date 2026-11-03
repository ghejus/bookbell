import { ImageResponse } from "next/og";
import { getShopMeta } from "@/lib/booking";
import { ShareCard } from "@/lib/brand";
import { interFonts } from "@/lib/og-fonts";

// The picture shown when someone shares a shop's booking link,
// for example in WhatsApp or on Facebook.
export const alt = "Book online with Bookbell";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await getShopMeta(slug);
  return new ImageResponse(
    shop ? (
      <ShareCard title={shop.name} subtitle={shop.about} footer="Book online" />
    ) : (
      <ShareCard title="Online booking for small shops" subtitle="" footer="Bookbell" />
    ),
    { ...size, fonts: await interFonts() },
  );
}
