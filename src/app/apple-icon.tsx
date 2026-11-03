import { ImageResponse } from "next/og";
import { BellMark } from "@/lib/brand";

// The icon iPhones show when someone adds Bookbell to their home screen.
// Square on purpose: the phone rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BellMark size={180} rounded={false} />, size);
}
