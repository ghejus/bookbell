import "server-only";
import { renderSVG } from "uqr";

/**
 * A QR code for a web address, as an SVG picture: black squares on white with
 * a quiet border around them (phones need both to scan it reliably).
 */
export function qrSvg(url: string): string {
  return renderSVG(url, { ecc: "M", border: 3, whiteColor: "#ffffff", blackColor: "#000000" });
}
