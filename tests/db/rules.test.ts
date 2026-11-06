/**
 * The owner's booking rules, against the real database (part of `npm run test:db`):
 * the gap after each booking and the deadline for changing a booking online.
 * Uses test shop A (open Mondays 09:00–17:00, Bucharest time, one worker, a
 * 30-minute "Visible service") on a Monday three weeks ahead. Shop A's rules go
 * back to the defaults at the end, because other test files share the shop.
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
let workerId: string;
let monday: string;
const at = (time: string) => zonedToUtc(monday, time, TZ).toISOString();
const DEFAULTS = { buffer_minutes: 0, cancel_deadline_hours: 0 };
let n = 0;

type Made = { booking_id: string; manage_token: string };

/** A customer books online (the way the website does). */
function book(time: string) {
  n += 1;
  return site
    .rpc("book_appointment", {
      p_shop_id: a.shopId,
      p_service_id: serviceId,
      p_starts_at: at(time),
      p_customer_name: "Rules Test",
      p_customer_email: `rules-${n}@randul-test.dev`,
    })
    .single<Made>();
}

const setRules = (rules: Partial<typeof DEFAULTS>) => a.db.from("shops").update(rules).eq("id", a.shopId);

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
  serviceId = (await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single()).data!.id;
  workerId = (await a.db.from("staff").select("id").eq("shop_id", a.shopId).order("created_at").limit(1).single()).data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, 21);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  await setRules(DEFAULTS);
  await cleanUp();
}, 40_000);

afterAll(async () => {
  await setRules(DEFAULTS);
  await cleanUp();
});

describe("the gap after each booking", () => {
  let first: Made;

  beforeAll(async () => {
    expect((await setRules({ buffer_minutes: 15 })).error).toBeNull();
    const res = await book("10:00"); // 10:00–10:30, so 09:45–10:45 stays free
    expect(res.error).toBeNull();
    first = res.data!;
  });

  it("keeps the gap free after a booking", async () => {
    expect((await book("10:30")).error?.message).toBe("slot_taken");
    expect((await book("10:45")).error).toBeNull();
  });

  it("keeps the gap free before a booking too", async () => {
    expect((await book("09:30")).error?.message).toBe("slot_taken"); // would end at 10:00
    expect((await book("09:15")).error).toBeNull(); // ends 09:45
  });

  it("shows the gap as taken to the booking page", async () => {
    const res = await anon.rpc("get_busy_times", { p_shop_id: a.shopId, p_from: at("00:00"), p_to: at("23:59") });
    expect(res.error).toBeNull();
    const starts = (res.data as { starts_at: string; ends_at: string }[]).map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)]);
    expect(starts).toContainEqual([Date.parse(at("09:45")), Date.parse(at("10:45"))]);
  });

  it("doesn't hold the owner to the gap", async () => {
    const res = await a.db.rpc("owner_add_booking", {
      p_service_id: serviceId,
      p_staff_id: workerId,
      p_starts_at: at("11:15"), // right after the 10:45–11:15 booking
      p_customer_name: "Walk-in",
    });
    expect(res.error).toBeNull();
  });

  it("applies the gap when a customer moves a booking, but not against itself", async () => {
    const move = (time: string) => anon.rpc("reschedule_booking_by_token", { p_token: first.manage_token, p_starts_at: at(time) });
    expect((await move("11:45")).error?.message).toBe("slot_taken"); // 11:15–11:45 walk-in + gap
    expect((await move("13:00")).error).toBeNull();
    expect((await move("13:15")).error).toBeNull(); // only its own old time (13:00–13:30) was near
  });

  it("refuses gaps the rules don't allow", async () => {
    expect((await setRules({ buffer_minutes: 7 })).error).not.toBeNull();
    expect((await setRules({ buffer_minutes: 125 })).error).not.toBeNull();
  });
});

describe("the deadline for changing a booking online", () => {
  let soon: Made;

  beforeAll(async () => {
    await setRules({ buffer_minutes: 0 });
    // The owner adds one for three hours from now (the owner may add any time).
    const inThreeHours = new Date(Math.ceil((Date.now() + 3 * 3_600_000) / 900_000) * 900_000).toISOString();
    const res = await a.db
      .rpc("owner_add_booking", {
        p_service_id: serviceId,
        p_staff_id: workerId,
        p_starts_at: inThreeHours,
        p_customer_name: "Deadline Test",
        p_customer_email: "deadline@randul-test.dev",
      })
      .single<Made>();
    expect(res.error).toBeNull();
    soon = res.data!;
  });

  afterAll(async () => {
    await a.db.from("bookings").update({ status: "cancelled" }).eq("id", soon.booking_id);
  });

  it("tells the customer's page when online changes close", async () => {
    await setRules({ cancel_deadline_hours: 24 });
    const row = await anon.rpc("get_booking_by_token", { p_token: soon.manage_token }).single<{ starts_at: string; change_until: string }>();
    expect(Date.parse(row.data!.starts_at) - Date.parse(row.data!.change_until)).toBe(24 * 3_600_000);
  });

  it("refuses a customer's cancel or move inside the deadline", async () => {
    expect((await anon.rpc("cancel_booking_by_token", { p_token: soon.manage_token })).error?.message).toBe("too_close");
    expect(
      (await anon.rpc("reschedule_booking_by_token", { p_token: soon.manage_token, p_starts_at: at("14:00") })).error?.message,
    ).toBe("too_close");
  });

  it("allows it again without a deadline", async () => {
    await setRules({ cancel_deadline_hours: 0 });
    expect((await anon.rpc("cancel_booking_by_token", { p_token: soon.manage_token })).error).toBeNull();
  });

  it("refuses deadlines the rules don't allow", async () => {
    expect((await setRules({ cancel_deadline_hours: 200 })).error).not.toBeNull();
  });
});
