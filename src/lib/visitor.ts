import "server-only";
import { createHash, createHmac } from "node:crypto";
import { checkTicket, issueTicket, type TicketCheck } from "./form-guard";

/** A signed "page made at" ticket for the booking form (see form-guard.ts). */
export function bookingTicket(shopId: string): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? issueTicket(secret, shopId) : "";
}

export function checkBookingTicket(shopId: string, ticket: string): TicketCheck {
  const secret = process.env.SUPABASE_SECRET_KEY;
  return secret ? checkTicket(secret, shopId, ticket) : "bad";
}

// Who is knocking: a one-way code made from the visitor's network address, so
// limits can count tries per visitor without ever storing an address.

/** The visitor's network address. On Vercel these headers are set by Vercel itself, so visitors can't fake them. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip")?.trim() ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * A one-way code for this address (and an optional scope, like a shop id).
 * It is keyed with the server's secret: a plain hash of an address could be
 * undone by trying all four billion addresses.
 */
export function visitorKey(ip: string, scope = ""): string {
  const secret = process.env.SUPABASE_SECRET_KEY;
  const text = `bookbell-visitor:${scope}:${ip}`;
  const hash = secret ? createHmac("sha256", secret).update(text) : createHash("sha256").update(text);
  return hash.digest("hex").slice(0, 32);
}
