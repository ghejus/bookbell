import { qrSvg } from "@/lib/qr";
import { requireShop } from "@/lib/shop";
import { siteUrl } from "@/lib/site";

// "Download QR code": the shop's booking page as a QR picture file. (The
// address has no ".svg" on purpose: the login check skips addresses that end
// like a picture file.)
export async function GET() {
  const { shop } = await requireShop();
  const svg = qrSvg(`${await siteUrl()}/s/${shop.slug}`);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${shop.slug}-qr-code.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
}
