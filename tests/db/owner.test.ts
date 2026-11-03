/**
 * The owner adding and moving bookings from their calendar, against the real
 * database (part of `npm run test:db`). Uses test shops A and B on days seven
 * weeks ahead, and cancels the bookings it made at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
let a: TestOwner;
let b: TestOwner;
let aService: string;
let aWorker: string;
let bService: string;
let bWorker: string;
let sunday: string; // shop A is closed on Sundays
const at = (time: string, date = sunday) => zonedToUtc(date, time, TZ).toISOString();
const sameTime = (x: string, y: string) => Date.parse(x) === Date.parse(y);

function add(owner: TestOwner, time: string, extra: Partial<Record<string, string>> = {}) {
  return owner.db
    .rpc("owner_add_booking", {
      p_service_id: aService,
      p_staff_id: aWorker,
      p_starts_at: at(time),
      p_customer_name: "Owner Test",
      p_customer_email: "",
      p_customer_phone: "",
      ...extra,
    })
    .single<{ booking_id: string; manage_token: string }>();
}

async function cleanUp() {
  await a.db.from("bookings").update({ status: "cancelled" }).eq("shop_id", a.shopId).eq("customer_name", "Owner Test").eq("status", "booked");
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  aService = (await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single()).data!.id;
  aWorker = (await a.db.from("staff").select("id").eq("shop_id", a.shopId).order("created_at").limit(1).single()).data!.id;
  bService = (await b.db.from("services").select("id").eq("shop_id", b.shopId).limit(1).single()).data!.id;
  bWorker = (await b.db.from("staff").select("id").eq("shop_id", b.shopId).order("created_at").limit(1).single()).data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, 49);
  while (isoWeekday(day) !== 7) day = addDays(day, 1);
  sunday = day;
  await cleanUp();
}, 30_000);

afterAll(cleanUp);

describe("the owner adding a booking", () => {
  it("works for a walk-in with no email, even when the shop is closed", async () => {
    const res = await add(a, "20:00");
    expect(res.error).toBeNull();
    expect(res.data!.manage_token).toMatch(/^[0-9a-f]{48}$/);
    const row = await a.db.from("bookings").select("customer_email, starts_at, ends_at").eq("id", res.data!.booking_id).single();
    expect(row.data!.customer_email).toBe("");
    expect(sameTime(row.data!.ends_at, at("20:30"))).toBe(true);
  });

  it("still can't book one person twice at the same time", async () => {
    expect((await add(a, "20:15")).error?.message).toBe("slot_taken");
  });

  it("refuses another shop's service or worker", async () => {
    expect((await add(a, "18:00", { p_service_id: bService })).error?.message).toBe("service_not_found");
    expect((await add(a, "18:00", { p_staff_id: bWorker })).error?.message).toBe("staff_not_found");
  });

  it("refuses a broken email", async () => {
    expect((await add(a, "18:00", { p_customer_email: "not-an-email" })).error?.message).toBe("invalid_details");
  });

  it("is closed to strangers", async () => {
    expect((await add({ ...a, db: anon }, "18:00")).error).not.toBeNull();
  });
});

describe("the owner moving a booking", () => {
  let id: string;
  beforeAll(async () => {
    id = (await add(a, "10:00")).data!.booking_id;
  });
  const move = (owner: TestOwner, time: string, staff = aWorker) =>
    owner.db.rpc("owner_move_booking", { p_booking_id: id, p_starts_at: at(time), p_staff_id: staff });

  it("keeps the booking's length", async () => {
    expect((await move(a, "11:00")).error).toBeNull();
    const row = await a.db.from("bookings").select("starts_at, ends_at").eq("id", id).single();
    expect(sameTime(row.data!.starts_at, at("11:00"))).toBe(true);
    expect(sameTime(row.data!.ends_at, at("11:30"))).toBe(true);
  });

  it("is refused onto a taken time", async () => {
    expect((await move(a, "20:00")).error?.message).toBe("slot_taken");
  });

  it("is refused for another shop's owner, or onto another shop's worker", async () => {
    expect((await move(b, "12:00")).error?.message).toBe("not_found");
    expect((await move(a, "12:00", bWorker)).error?.message).toBe("staff_not_found");
  });

  it("is refused once the booking is cancelled", async () => {
    await a.db.from("bookings").update({ status: "cancelled" }).eq("id", id);
    expect((await move(a, "12:00")).error?.message).toBe("not_booked");
  });

  it("can't point a booking at another shop's service", async () => {
    const other = (await add(a, "13:00")).data!.booking_id;
    const res = await a.db.from("bookings").update({ service_id: bService }).eq("id", other).select("id");
    expect(res.error).not.toBeNull();
  });
});
