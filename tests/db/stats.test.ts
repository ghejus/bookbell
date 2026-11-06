/**
 * The Stats numbers, against the real database (part of `npm run test:db`).
 * Test shop B's owner adds a known set of past visits in one week about four
 * months ago (the owner may add any time), then the numbers must match.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
let a: TestOwner;
let b: TestOwner;
let serviceId: string;
let workerId: string;
let monday: string;
const at = (date: string, time: string) => zonedToUtc(date, time, TZ).toISOString();
const week = () => ({ p_from: at(monday, "00:00"), p_to: at(addDays(monday, 7), "00:00") });

type Stats = {
  kept: number;
  upcoming: number;
  no_shows: number;
  cancelled: number;
  active: number;
  revenue_cents: number;
  customers: number;
  by_weekday: { day: number; n: number }[];
  by_hour: { hour: number; n: number }[];
  top_services: { name: string; n: number; cents: number }[];
};

async function add(date: string, time: string, email: string) {
  const res = await b.db
    .rpc("owner_add_booking", {
      p_service_id: serviceId,
      p_staff_id: workerId,
      p_starts_at: at(date, time),
      p_customer_name: "Stats Test",
      p_customer_email: email,
    })
    .single<{ booking_id: string }>();
  if (res.error) throw res.error;
  return res.data.booking_id;
}

async function cleanUp() {
  // Bookings can't be deleted by owners; cancelled ones in this week are
  // counted separately, so each run starts from a known "cancelled" count.
  await b.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", b.shopId).in("status", ["booked", "no_show"]).gte("starts_at", week().p_from).lt("starts_at", week().p_to);
}

let cancelledBefore = 0;
let originalPrice: number | null = null;

beforeAll(async () => {
  ({ a, b } = await testOwners());
  const service = (await b.db.from("services").select("id, price_cents").eq("shop_id", b.shopId).eq("active", true).order("created_at").limit(1).single()).data!;
  serviceId = service.id;
  originalPrice = service.price_cents;
  workerId = (await b.db.from("staff").select("id").eq("shop_id", b.shopId).eq("active", true).order("created_at").limit(1).single()).data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, -120);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  await cleanUp();
  cancelledBefore = ((await b.db.rpc("owner_stats", week())).data as Stats).cancelled;

  await b.db.from("services").update({ price_cents: 2500 }).eq("id", serviceId);
  await add(monday, "09:00", "stats-1@randul-test.dev");
  await add(monday, "10:00", "stats-2@randul-test.dev");
  await add(addDays(monday, 1), "10:30", "stats-1@randul-test.dev");
  const missed = await add(addDays(monday, 2), "11:00", "stats-3@randul-test.dev");
  const cancelled = await add(addDays(monday, 2), "12:00", "stats-4@randul-test.dev");
  await b.db.from("bookings").update({ status: "no_show" }).eq("id", missed);
  await b.db.from("bookings").update({ status: "cancelled" }).eq("id", cancelled);
  // A later price change doesn't change past takings.
  await b.db.from("services").update({ price_cents: 9900 }).eq("id", serviceId);
}, 60_000);

afterAll(async () => {
  await b.db.from("services").update({ price_cents: originalPrice }).eq("id", serviceId);
  await cleanUp();
});

describe("owner_stats", () => {
  it("counts visits, missed and cancelled bookings and takings", async () => {
    const res = await b.db.rpc("owner_stats", week());
    expect(res.error).toBeNull();
    const s = res.data as Stats;
    expect(s).toMatchObject({ kept: 3, upcoming: 0, no_shows: 1, active: 4, revenue_cents: 7500, customers: 2 });
    expect(s.cancelled).toBe(cancelledBefore + 1);
  });

  it("splits visits by weekday and starting hour, in the shop's time", async () => {
    const s = (await b.db.rpc("owner_stats", week())).data as Stats;
    expect(s.by_weekday).toEqual([
      { day: 1, n: 2 },
      { day: 2, n: 1 },
    ]);
    expect(s.by_hour).toEqual([
      { hour: 9, n: 1 },
      { hour: 10, n: 2 },
    ]);
    expect(s.top_services).toHaveLength(1);
    expect(s.top_services[0]).toMatchObject({ n: 3, cents: 7500 });
  });

  it("only ever counts the caller's own shop", async () => {
    const s = (await a.db.rpc("owner_stats", week())).data as Stats;
    expect(s.revenue_cents).not.toBe(7500);
    expect((await anon.rpc("owner_stats", week())).error).not.toBeNull();
  });

  it("refuses ranges longer than about a year", async () => {
    const s = (await b.db.rpc("owner_stats", { p_from: at(monday, "00:00"), p_to: at(addDays(monday, 500), "00:00") })).data as Stats;
    expect(s.active).toBe(0);
  });
});
