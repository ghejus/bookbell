import { ImageResponse } from "next/og";
import { BellMark } from "@/lib/brand";

// The app icon in three sizes: the browser tab, and the two sizes phones
// use when someone adds Bookbell to their home screen (see manifest.ts).
export function generateImageMetadata() {
  return [32, 192, 512].map((px) => ({ id: String(px), contentType: "image/png", size: { width: px, height: px } }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const px = Number(await id);
  // The tab icon keeps round corners; the home-screen ones are square,
  // because phones cut their own shape out of them.
  return new ImageResponse(<BellMark size={px} rounded={px === 32} />, { width: px, height: px });
}
