/**
 * Customer accounts ("My bookings"), against the real database (part of
 * `npm run test:db`). Uses test shop A (open Mondays 09:00–17:00, Bucharest
 * time) on a Monday six weeks ahead, and cancels its bookings at the end.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, owner, server, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
const site = server();
let a: TestOwner;
let b: TestOwner;
let customer: Awaited<ReturnType<typeof owner>>;
let serviceId: string;
let monday: string;
const at = (time: string) => zonedToUtc(monday, time, TZ).toISOString();

type Made = { booking_id: string; manage_token: string };

/** Books the way the website does: the server passes who is signed in (or nobody). */
async function book(customerId: string | null, time: string, email: string): Promise<Made> {
  const res = await site
    .rpc("book_appointment", {
      p_shop_id: a.shopId,
      p_service_id: serviceId,
      p_starts_at: at(time),
      p_customer_name: "Customer Test",
      p_customer_email: email,
      p_customer_id: customerId,
    })
    .single<Made>();
  if (res.error) throw res.error;
  return res.data;
}

const mine = async (db: ReturnType<typeof client>) => {
  const { data, error } = await db.rpc("my_bookings");
  if (error) throw error;
  return (data as { booking_id: string; shop_slug: string; service_name: string }[]).map((r) => r.booking_id);
};

/** What the shop owner sees about a booking: who it belongs to and how it came in. */
const row = async (id: string) =>
  (await a.db.from("bookings").select("customer_id, source").eq("id", id).single<{ customer_id: string | null; source: string }>()).data;

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
  ({ a, b } = await testOwners());
  customer = await owner("customer-test-c@randul-test.dev");
  const svc = await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single();
  serviceId = svc.data!.id;
  let day = addDays(utcToZoned(new Date(), TZ).date, 42);
  while (isoWeekday(day) !== 1) day = addDays(day, 1);
  monday = day;
  await cleanUp();
}, 40_000);

afterAll(cleanUp);

describe("booking while signed in", () => {
  let made: Made;
  beforeAll(async () => {
    made = await book(customer.userId, "09:00", "customer-c@randul-test.dev");
  });

  it("puts the booking in the customer's My bookings", async () => {
    expect(await mine(customer.db)).toContain(made.booking_id);
    expect(await row(made.booking_id)).toEqual({ customer_id: customer.userId, source: "online" });
  });

  it("never shows it in someone else's My bookings", async () => {
    expect(await mine(b.db)).not.toContain(made.booking_id);
  });

  it("gives a fresh secret link to the customer only", async () => {
    const link = await customer.db.rpc("my_booking_link", { p_booking_id: made.booking_id });
    expect(link.error).toBeNull();
    expect(link.data).toMatch(/^[0-9a-f]{48}$/);
    const page = await anon.rpc("get_booking_by_token", { p_token: link.data }).single<{ booking_id: string }>();
    expect(page.data?.booking_id).toBe(made.booking_id);

    expect((await b.db.rpc("my_booking_link", { p_booking_id: made.booking_id })).error?.message).toBe("not_found");
    expect((await anon.rpc("my_booking_link", { p_booking_id: made.booking_id })).error).not.toBeNull();
  });

  it("keeps My bookings closed to visitors who aren't signed in", async () => {
    expect((await anon.rpc("my_bookings")).error).not.toBeNull();
  });
});

describe("booking as a guest", () => {
  let made: Made;
  beforeAll(async () => {
    made = await book(null, "10:00", "guest-c@randul-test.dev");
  });

  it("links the booking to nobody", async () => {
    expect(await row(made.booking_id)).toEqual({ customer_id: null, source: "online" });
    expect((await customer.db.rpc("booking_saved_by_token", { p_token: made.manage_token })).data).toBe("none");
  });

  it("can be added to an account with the secret link", async () => {
    expect((await anon.rpc("claim_booking_by_token", { p_token: made.manage_token })).error).not.toBeNull();
    expect((await customer.db.rpc("claim_booking_by_token", { p_token: "0".repeat(48) })).error?.message).toBe("not_found");

    expect((await customer.db.rpc("claim_booking_by_token", { p_token: made.manage_token })).error).toBeNull();
    expect(await mine(customer.db)).toContain(made.booking_id);
    expect((await customer.db.rpc("booking_saved_by_token", { p_token: made.manage_token })).data).toBe("mine");
  });

  it("can't then be taken by another account", async () => {
    expect((await b.db.rpc("claim_booking_by_token", { p_token: made.manage_token })).error?.message).toBe("other_account");
    expect((await b.db.rpc("booking_saved_by_token", { p_token: made.manage_token })).data).toBe("other");
    expect(await mine(b.db)).not.toContain(made.booking_id);
  });
});

describe("the owner adding a booking", () => {
  it("is marked as added by the owner and belongs to no customer", async () => {
    const staff = await a.db.from("staff").select("id").eq("shop_id", a.shopId).eq("active", true).limit(1).single();
    const res = await a.db
      .rpc("owner_add_booking", {
        p_service_id: serviceId,
        p_staff_id: staff.data!.id,
        p_starts_at: at("11:00"),
        p_customer_name: "Walk-in",
      })
      .single<Made>();
    expect(res.error).toBeNull();
    expect(await row(res.data!.booking_id)).toEqual({ customer_id: null, source: "owner" });
    expect(await mine(a.db)).not.toContain(res.data!.booking_id);
  });
});
