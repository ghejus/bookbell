import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * True when the request comes from Vercel's daily job runner. Vercel sends
 * "Authorization: Bearer <CRON_SECRET>"; anyone else gets turned away.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
