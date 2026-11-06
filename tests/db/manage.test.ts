/**
 * The customer's secret "manage my booking" link, against the real database
 * (part of `npm run test:db`). Uses test shop A (open Mondays 09:00–17:00,
 * Bucharest time) on a Monday five weeks ahead, and cancels its bookings at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, server, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
const site = server();
let a: TestOwner;
let serviceId: string;
let monday: string;
let token: string;
let bookingId: string;
const at = (time: string) => zonedToUtc(monday, time, TZ).toISOString();
const sameTime = (x: string, y: string) => Date.parse(x) === Date.parse(y);

async function book(time: string, email: string) {
  const res = await site
    .rpc("book_appointment", {
      p_shop_id: a.shopId,
      p_service_id: serviceId,
      p_starts_at: at(time),
      p_customer_name: "Manage Test",
      p_customer_email: email,
      p_customer_phone: "+40 700 000 001",
    })
    .single<{ booking_id: string; manage_token: string }>();
  if (res.error) throw res.error;
  return res.data;
}

const lookup = (t: string | null) => anon.rpc("get_booking_by_token", { p_token: t });
const move = (time: string) => anon.rpc("reschedule_booking_by_token", { p_token: token, p_starts_at: at(time) });

async function cleanUp() {
  await a.db
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("shop_id", a.shopId)
    .eq("status", "booked")
    .gte("starts_at", at("00:00"))
    .lt("starts_at", at("23:59"));
}

beforeAll(async () => {
  ({ a } = await testOwners());
  const svc = await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single();
  serviceId = svc.data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, 35);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  await cleanUp();
  ({ manage_token: token, booking_id: bookingId } = await book("10:00", "manage-1@randul-test.dev"));
}, 30_000);

afterAll(cleanUp);

describe("the secret link", () => {
  it("shows the customer their own booking", async () => {
    const { data, error } = await lookup(token).single<Record<string, unknown>>();
    expect(error).toBeNull();
    expect(data).toMatchObject({ booking_id: bookingId, status: "booked", customer_email: "manage-1@randul-test.dev", service_name: "Visible service" });
    expect(sameTime(data!.starts_at as string, at("10:00"))).toBe(true);
  });

  it("shows nothing for a wrong, broken or missing token", async () => {
    const wrong = token.replace(/^./, (c) => (c === "a" ? "b" : "a"));
    for (const t of [wrong, "not-a-token", "", null]) expect((await lookup(t)).data ?? [], String(t)).toEqual([]);
  });

  it("keeps the link table and the server-only functions closed to strangers", async () => {
    expect((await anon.from("booking_links").select("*").limit(1)).data ?? []).toEqual([]);
    expect((await anon.rpc("issue_manage_token", { p_booking_id: bookingId })).error).not.toBeNull();
    expect((await anon.rpc("take_email_slot", { p_limit: 1000 })).error).not.toBeNull();
  });

  it("keeps the link table closed to the shop owner too", async () => {
    expect((await a.db.from("booking_links").select("*").limit(1)).data ?? []).toEqual([]);
  });
});

describe("moving a booking", () => {
  it("works for a free time, and the booking shows the new time", async () => {
    expect((await move("11:00")).error).toBeNull();
    const { data } = await lookup(token).single<{ starts_at: string; ends_at: string }>();
    expect(sameTime(data!.starts_at, at("11:00"))).toBe(true);
    expect(sameTime(data!.ends_at, at("11:30"))).toBe(true);
  });

  it("works for a time that overlaps its own old time", async () => {
    expect((await move("11:15")).error).toBeNull();
  });

  it("is refused for a time someone else has", async () => {
    await book("14:00", "manage-2@randul-test.dev");
    expect((await move("14:00")).error?.message).toBe("slot_taken");
  });

  it("follows the same rules as booking", async () => {
    expect((await move("08:00")).error?.message).toBe("outside_hours");
    expect((await move("16:45")).error?.message).toBe("outside_hours");
  });
});

describe("cancelling a booking", () => {
  it("works once", async () => {
    expect((await anon.rpc("cancel_booking_by_token", { p_token: token })).error).toBeNull();
    const { data } = await lookup(token).single<{ status: string }>();
    expect(data!.status).toBe("cancelled");
  });

  it("can't be done twice, and a cancelled booking can't be moved", async () => {
    expect((await anon.rpc("cancel_booking_by_token", { p_token: token })).error?.message).toBe("not_booked");
    expect((await move("12:00")).error?.message).toBe("not_booked");
  });

  it("needs a real token", async () => {
    expect((await anon.rpc("cancel_booking_by_token", { p_token: "0".repeat(48) })).error?.message).toBe("not_found");
  });
});
