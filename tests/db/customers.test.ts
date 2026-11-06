/**
 * Customers and no-shows, against the real database (part of `npm run test:db`).
 * Uses test shops A and B. Shop A's owner adds visits in the past (the owner
 * may add any time) on a Sunday far back, so nothing clashes with other tests.
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
let sunday: string; // a Sunday about 10 weeks ago
const at = (time: string, date = sunday) => zonedToUtc(date, time, TZ).toISOString();
const KEY = "e:customers-test@randul-test.dev";

type Customer = { customer_key: string; name: string; visits: number; no_shows: number; cancelled: number; spent_cents: number; note: string | null };

function add(time: string, name: string, email: string, phone = "", date = sunday) {
  return a.db
    .rpc("owner_add_booking", {
      p_service_id: serviceId,
      p_staff_id: workerId,
      p_starts_at: at(time, date),
      p_customer_name: name,
      p_customer_email: email,
      p_customer_phone: phone,
    })
    .single<{ booking_id: string }>();
}

async function cleanUp() {
  await a.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", a.shopId).in("status", ["booked", "no_show"]).gte("starts_at", at("00:00")).lt("starts_at", at("23:59"));
  await a.db.from("customer_notes").delete().eq("shop_id", a.shopId);
}

const customers = async (db = a.db) => {
  const res = await db.rpc("owner_customers");
  if (res.error) throw res.error;
  return res.data as Customer[];
};

beforeAll(async () => {
  ({ a, b } = await testOwners());
  serviceId = (await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single()).data!.id;
  workerId = (await a.db.from("staff").select("id").eq("shop_id", a.shopId).order("created_at").limit(1).single()).data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, -70);
  while (isoWeekday(day) !== 7) day = addDays(day, 1);
  sunday = day;
  await cleanUp();
}, 40_000);

afterAll(cleanUp);

describe("one person's visits", () => {
  it("group by email, whatever the letter case, and count spending", async () => {
    await a.db.from("services").update({ price_cents: 2000 }).eq("id", serviceId);
    expect((await add("09:00", "Customer Test", "customers-test@randul-test.dev")).error).toBeNull();
    expect((await add("10:00", "Customer T.", "Customers-Test@Randul-Test.dev")).error).toBeNull();
    const me = (await customers()).find((c) => c.customer_key === KEY);
    expect(me).toMatchObject({ visits: 2, no_shows: 0, spent_cents: 4000 });
  });

  it("keep the price they were booked at", async () => {
    await a.db.from("services").update({ price_cents: 9900 }).eq("id", serviceId);
    const me = (await customers()).find((c) => c.customer_key === KEY);
    expect(me!.spent_cents).toBe(4000);
    await a.db.from("services").update({ price_cents: null }).eq("id", serviceId);
  });

  it("group walk-ins by phone number, then by name", async () => {
    await add("11:00", "Phone Person", "", "+40 711 222 333");
    await add("12:00", "Phone P.", "", "+40 711-222-333");
    await add("13:00", "Only A Name", "");
    const keys = (await customers()).map((c) => c.customer_key);
    expect(keys).toContain("p:40711222333");
    expect(keys).toContain("n:only a name");
    expect((await customers()).find((c) => c.customer_key === "p:40711222333")!.visits).toBe(2);
  });
});

describe("didn't come", () => {
  it("can be marked on a visit that has started, and undone", async () => {
    const made = await add("14:00", "Customer Test", "customers-test@randul-test.dev");
    const id = made.data!.booking_id;
    expect((await a.db.from("bookings").update({ status: "no_show" }).eq("id", id)).error).toBeNull();
    expect((await customers()).find((c) => c.customer_key === KEY)).toMatchObject({ visits: 2, no_shows: 1 });
    expect((await a.db.from("bookings").update({ status: "booked" }).eq("id", id)).error).toBeNull();
    expect((await customers()).find((c) => c.customer_key === KEY)).toMatchObject({ visits: 3, no_shows: 0 });
  });

  it("can't be marked on a future booking", async () => {
    const future = addDays(utcToZoned(new Date(), TZ).date, 70);
    const made = await add("15:00", "Future Test", "future-test@randul-test.dev", "", future);
    expect(made.error).toBeNull();
    const res = await a.db.from("bookings").update({ status: "no_show" }).eq("id", made.data!.booking_id).select("id");
    expect(res.error ?? res.data?.length === 0).toBeTruthy();
    await a.db.from("bookings").update({ status: "cancelled" }).eq("id", made.data!.booking_id);
  });

  it("can't be marked by another owner", async () => {
    const id = (await a.db.from("bookings").select("id").eq("shop_id", a.shopId).eq("customer_key", KEY).limit(1).single()).data!.id;
    const res = await b.db.from("bookings").update({ status: "no_show" }).eq("id", id).select("id");
    expect(res.data ?? []).toEqual([]);
  });
});

describe("customer notes", () => {
  it("are saved and shown with the customer", async () => {
    expect((await a.db.from("customer_notes").insert({ shop_id: a.shopId, customer_key: KEY, note: "Likes it short." })).error).toBeNull();
    expect((await customers()).find((c) => c.customer_key === KEY)!.note).toBe("Likes it short.");
  });

  it("are private to the shop's owner", async () => {
    expect((await b.db.from("customer_notes").select("*").eq("shop_id", a.shopId)).data ?? []).toEqual([]);
    expect((await anon.from("customer_notes").select("*")).data ?? []).toEqual([]);
    expect((await b.db.from("customer_notes").insert({ shop_id: a.shopId, customer_key: "e:x@y.z", note: "Nope" })).error).not.toBeNull();
  });

  it("aren't in another owner's customer list, and strangers get no list", async () => {
    expect((await customers(b.db)).some((c) => c.customer_key === KEY)).toBe(false);
    expect((await anon.rpc("owner_customers")).error).not.toBeNull();
  });
});
