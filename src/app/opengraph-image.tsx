import { ImageResponse } from "next/og";
import { ShareCard } from "@/lib/brand";
import { interFonts } from "@/lib/og-fonts";

// The picture shown when someone shares the Bookbell home page.
export const alt = "Bookbell: online booking for small shops";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <ShareCard
        title="Online booking for small shops"
        subtitle="Customers pick a free time, and a friendly helper answers their questions."
        footer="Try a demo shop"
      />
    ),
    { ...size, fonts: await interFonts() },
  );
}
