import { createHmac, timingSafeEqual } from "node:crypto";

// A "ticket" for the booking form: the time the page was made, signed by the
// server so it can't be faked. A form sent back within a moment of the page
// loading was filled in by a robot (people need longer than that to pick a
// time and type their name).

export const TOO_FAST_MS = 2000;
export const TICKET_LIFE_MS = 24 * 60 * 60 * 1000;

export type TicketCheck = "ok" | "too_fast" | "expired" | "bad";

function sign(secret: string, shopId: string, issuedAt: number) {
  return createHmac("sha256", secret).update(`bookbell-form:${shopId}:${issuedAt}`).digest("base64url").slice(0, 32);
}

export function issueTicket(secret: string, shopId: string, now = Date.now()): string {
  return `${now}.${sign(secret, shopId, now)}`;
}

export function checkTicket(secret: string, shopId: string, ticket: string, now = Date.now()): TicketCheck {
  const [time, mac, ...rest] = ticket.split(".");
  const issuedAt = Number(time);
  if (rest.length || !mac || !/^\d{10,16}$/.test(time) || !Number.isSafeInteger(issuedAt)) return "bad";
  const expected = Buffer.from(sign(secret, shopId, issuedAt));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return "bad";
  const age = now - issuedAt;
  if (age < 0) return "bad";
  if (age < TOO_FAST_MS) return "too_fast";
  if (age > TICKET_LIFE_MS) return "expired";
  return "ok";
}
