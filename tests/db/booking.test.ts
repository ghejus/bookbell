/**
 * Booking rules against the real database (part of `npm run test:db`).
 * A stranger (not logged in) calls the two public functions directly, the way
 * a hand-made request would, and every rule must hold without the website's help.
 *
 * Test shop A is open Mondays 09:00–17:00 (Bucharest time) with a 30-minute
 * "Visible service" and a hidden one. Every booking made here is cancelled at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
let a: TestOwner;
let b: TestOwner;
let visibleId: string;
let hiddenId: string;
let monday: string; // a Monday at least 3 days ahead
const at = (time: string, date = monday) => zonedToUtc(date, time, TZ).toISOString();

function book(startsAt: string, email = "customer@randul-test.dev", serviceId = visibleId) {
  return anon.rpc("book_appointment", {
    p_shop_id: a.shopId,
    p_service_id: serviceId,
    p_starts_at: startsAt,
    p_customer_name: "Test Customer",
    p_customer_email: email,
    p_customer_phone: "",
  });
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  const services = await a.db.from("services").select("id, name").eq("shop_id", a.shopId);
  visibleId = services.data!.find((s) => s.name === "Visible service")!.id;
  hiddenId = services.data!.find((s) => s.name === "Hidden service")!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, 3);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  // Start clean, in case an earlier run stopped halfway.
  await a.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", a.shopId).eq("status", "booked");
}, 30_000);

afterAll(async () => {
  await a.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", a.shopId).eq("status", "booked");
  await a.db.from("time_off").delete().eq("shop_id", a.shopId).eq("reason", "booking test day off");
});

describe("booking a free time", () => {
  it("works for a stranger, and returns the booking id and a secret link token", async () => {
    const res = await book(at("10:00"));
    expect(res.error).toBeNull();
    const [row] = res.data as { booking_id: string; manage_token: string }[];
    expect(typeof row.booking_id).toBe("string");
    expect(row.manage_token).toMatch(/^[0-9a-f]{48}$/);
  });

  it("shows up for the owner with the customer's details", async () => {
    const res = await a.db.from("bookings").select("customer_name, ends_at").eq("shop_id", a.shopId).eq("status", "booked").eq("starts_at", at("10:00"));
    expect(res.data?.[0]?.customer_name).toBe("Test Customer");
    expect(new Date(res.data![0].ends_at).toISOString()).toBe(at("10:30"));
  });

  it("is hidden from another owner and from strangers", async () => {
    expect((await b.db.from("bookings").select("id").eq("shop_id", a.shopId)).data ?? []).toEqual([]);
    expect((await anon.from("bookings").select("id")).data ?? []).toEqual([]);
  });
});

describe("the database refuses", () => {
  it("the same time twice", async () => {
    expect((await book(at("10:00"), "other@randul-test.dev")).error?.message).toBe("slot_taken");
  });

  it("a time that overlaps another booking", async () => {
    expect((await book(at("10:15"), "other@randul-test.dev")).error?.message).toBe("slot_taken");
  });

  it("times outside opening hours", async () => {
    expect((await book(at("08:30"))).error?.message).toBe("outside_hours"); // before opening
    expect((await book(at("16:45"))).error?.message).toBe("outside_hours"); // runs past closing
    expect((await book(at("10:00", addDays(monday, 1)))).error?.message).toBe("outside_hours"); // closed on Tuesday
  });

  it("a time that is too soon or too far ahead", async () => {
    expect((await book(new Date(Date.now() + 30 * 60_000).toISOString())).error?.message).toBe("too_soon");
    expect((await book(at("10:00", addDays(monday, 7 * 13)))).error?.message).toBe("too_far");
  });

  it("a hidden service", async () => {
    expect((await book(at("12:00"), undefined, hiddenId)).error?.message).toBe("service_not_found");
  });

  it("a service from another shop", async () => {
    const theirs = await b.db.from("services").select("id").eq("shop_id", b.shopId).eq("active", true).limit(1).single();
    expect((await book(at("12:00"), undefined, theirs.data!.id)).error?.message).toBe("service_not_found");
  });

  it("a day off", async () => {
    const off = await a.db.from("time_off").insert({ shop_id: a.shopId, starts_at: at("13:00"), ends_at: at("14:00"), reason: "booking test day off" });
    expect(off.error).toBeNull();
    expect((await book(at("13:30"))).error?.message).toBe("closed_then");
  });

  it("an email that isn't an email", async () => {
    expect((await book(at("15:00"), "not-an-email")).error?.message).toBe("invalid_details");
  });

  it("a fourth upcoming booking from the same email", async () => {
    const email = "busy-customer@randul-test.dev";
    for (const t of ["11:00", "11:30", "12:00"]) expect((await book(at(t), email)).error, t).toBeNull();
    expect((await book(at("12:30"), email)).error?.message).toBe("too_many");
  });
});

describe("taken times for strangers", () => {
  it("show start, end and which worker only, never who booked", async () => {
    const res = await anon.rpc("get_busy_times", { p_shop_id: a.shopId, p_from: at("00:00"), p_to: at("23:59") });
    expect(res.error).toBeNull();
    const rows = res.data as Record<string, string>[];
    expect(rows.length).toBeGreaterThanOrEqual(5); // 4 bookings + the day off
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["ends_at", "staff_id", "starts_at"]);
  });

  it("refuse windows longer than 62 days", async () => {
    const res = await anon.rpc("get_busy_times", { p_shop_id: a.shopId, p_from: at("00:00"), p_to: at("00:00", addDays(monday, 90)) });
    expect(res.data).toEqual([]);
  });

  it("free up again when the owner cancels", async () => {
    await a.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", a.shopId).eq("starts_at", at("10:00"));
    expect((await book(at("10:00"), "second@randul-test.dev")).error).toBeNull();
  });
});
