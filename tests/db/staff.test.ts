/**
 * Shops with more than one worker, against the real database (part of `npm run test:db`).
 *
 * Uses test shop B (open Mondays 09:00–17:00, Bucharest time), so it never gets in
 * the way of booking.test.ts, which uses shop A at the same time. Shop B gets a
 * second worker for these tests; it is turned off again at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, server, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
const site = server();
let a: TestOwner;
let b: TestOwner;
let serviceId: string;
let first: string; // shop B's first worker
let second: string; // shop B's second worker
let aWorker: string; // a worker from shop A
let monday: string;
const at = (time: string, date = monday) => zonedToUtc(date, time, TZ).toISOString();
let n = 0;

/** A stranger books in shop B. Every call uses a new email, so the 3-per-email rule never interferes. */
function book(startsAt: string, staffId: string | null = null) {
  n += 1;
  return site.rpc("book_appointment", {
    p_shop_id: b.shopId,
    p_service_id: serviceId,
    p_starts_at: startsAt,
    p_customer_name: "Staff Test",
    p_customer_email: `staff-${n}@randul-test.dev`,
    p_customer_phone: "",
    p_staff_id: staffId,
  }).single<{ booking_id: string; manage_token: string }>();
}

async function workerOf(bookingId: string) {
  const res = await b.db.from("bookings").select("staff_id").eq("id", bookingId).single();
  return res.data?.staff_id as string;
}

async function cleanUp() {
  await b.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", b.shopId).eq("status", "booked");
  await b.db.from("time_off").delete().eq("shop_id", b.shopId).eq("reason", "staff test day off");
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  const svc = await b.db.from("services").select("id").eq("shop_id", b.shopId).eq("active", true).limit(1).single();
  serviceId = svc.data!.id;

  // Shop B: its first worker, plus a second one (made once, then reused).
  const team = await b.db.from("staff").select("id, name").eq("shop_id", b.shopId).order("created_at");
  first = team.data![0].id;
  await b.db.from("staff").update({ active: true }).eq("id", first);
  const existing = team.data!.find((w) => w.name === "Second worker");
  if (existing) {
    second = existing.id;
    await b.db.from("staff").update({ active: true }).eq("id", second);
  } else {
    const made = await b.db.from("staff").insert({ shop_id: b.shopId, name: "Second worker" }).select("id").single();
    if (made.error) throw made.error;
    second = made.data.id;
  }
  const theirs = await a.db.from("staff").select("id").eq("shop_id", a.shopId).limit(1).single();
  aWorker = theirs.data!.id;

  // Two weeks ahead, so it is never the Monday booking.test.ts uses (that's shop A anyway).
  let day = addDays(utcToZoned(new Date(), TZ).date, 10);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  await cleanUp();
}, 30_000);

afterAll(async () => {
  await cleanUp();
  // Back to one worker taking bookings, like the other tests expect.
  await b.db.from("staff").update({ active: false }).eq("id", second);
});

describe("a shop with two workers", () => {
  it("every shop starts with a worker", async () => {
    const res = await anon.from("staff").select("id").eq("shop_id", a.shopId);
    expect(res.data?.length).toBeGreaterThanOrEqual(1);
  });

  it("takes two bookings at the same time, one per worker, then refuses a third", async () => {
    const one = await book(at("10:00"));
    const two = await book(at("10:00"));
    expect(one.error).toBeNull();
    expect(two.error).toBeNull();
    expect(new Set([await workerOf(one.data!.booking_id), await workerOf(two.data!.booking_id)])).toEqual(new Set([first, second]));
    expect((await book(at("10:00"))).error?.message).toBe("slot_taken");
  });

  it("books a chosen worker, and keeps that worker from being double-booked", async () => {
    const mine = await book(at("11:00"), second);
    expect(mine.error).toBeNull();
    expect(await workerOf(mine.data!.booking_id)).toBe(second);
    expect((await book(at("11:00"), second)).error?.message).toBe("slot_taken");
    expect((await book(at("11:00"), first)).error).toBeNull();
  });

  it("\"anyone\" goes to the worker who is free", async () => {
    expect((await book(at("12:00"), first)).error).toBeNull();
    const res = await book(at("12:00"));
    expect(res.error).toBeNull();
    expect(await workerOf(res.data!.booking_id)).toBe(second);
  });

  it("respects one worker's own day off", async () => {
    const off = await b.db
      .from("time_off")
      .insert({ shop_id: b.shopId, staff_id: second, starts_at: at("13:00"), ends_at: at("14:00"), reason: "staff test day off" });
    expect(off.error).toBeNull();
    expect((await book(at("13:00"), second)).error?.message).toBe("closed_then");
    const res = await book(at("13:00"));
    expect(res.error).toBeNull();
    expect(await workerOf(res.data!.booking_id)).toBe(first);
  });

  it("tells strangers whose time is taken, but nothing about the customer", async () => {
    const res = await anon.rpc("get_busy_times", { p_shop_id: b.shopId, p_from: at("00:00"), p_to: at("23:59") });
    expect(res.error).toBeNull();
    const rows = res.data as { starts_at: string; ends_at: string; staff_id: string | null }[];
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["ends_at", "staff_id", "starts_at"]);
    const offStart = new Date(at("13:00")).getTime();
    expect(rows.some((r) => r.staff_id === second && new Date(r.starts_at).getTime() === offStart)).toBe(true); // the day off
  });
});

describe("the database refuses", () => {
  it("a worker from another shop", async () => {
    expect((await book(at("15:00"), aWorker)).error?.message).toBe("staff_not_found");
  });

  it("a turned-off worker, who strangers can't see either", async () => {
    await b.db.from("staff").update({ active: false }).eq("id", second);
    expect((await book(at("15:00"), second)).error?.message).toBe("staff_not_found");
    expect((await anon.from("staff").select("id").eq("id", second)).data).toEqual([]);
    await b.db.from("staff").update({ active: true }).eq("id", second);
  });

  it("an owner moving their booking onto another shop's worker", async () => {
    const res = await book(at("16:00"), first);
    const moved = await b.db.from("bookings").update({ staff_id: aWorker }).eq("id", res.data!.booking_id);
    expect(moved.error).not.toBeNull();
    expect(await workerOf(res.data!.booking_id)).toBe(first);
  });

  it("an owner adding a worker to another shop", async () => {
    const res = await b.db.from("staff").insert({ shop_id: a.shopId, name: "Intruder" });
    expect(res.error).not.toBeNull();
  });

  it("an owner giving another shop's worker a day off", async () => {
    const res = await b.db
      .from("time_off")
      .insert({ shop_id: b.shopId, staff_id: aWorker, starts_at: at("09:00"), ends_at: at("10:00"), reason: "staff test day off" });
    expect(res.error).not.toBeNull();
  });

  it("deleting a worker who has bookings", async () => {
    const res = await b.db.from("staff").delete().eq("id", first);
    expect(res.error?.code).toBe("23503");
  });
});
