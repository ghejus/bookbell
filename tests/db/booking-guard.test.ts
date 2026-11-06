/**
 * The booking guard, against the real database (part of `npm run test:db`).
 * Robots used to skip the booking form by calling book_appointment straight
 * from the outside. Now only the website's server may book, and it asks
 * take_booking_turn first (a limit on tries per visitor).
 */
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { client, owner, server, testOwners, type TestOwner } from "./helpers";

const anon = client();
const site = server();
let a: TestOwner;
let b: TestOwner;
let serviceId: string;

const newVisitor = () => `test-${randomBytes(8).toString("hex")}`;
const take = (visitor: string, shopId = a.shopId) => site.rpc("take_booking_turn", { p_shop_id: shopId, p_visitor: visitor });
const tryBooking = (db: ReturnType<typeof client>) =>
  db.rpc("book_appointment", {
    p_shop_id: a.shopId,
    p_service_id: serviceId,
    p_starts_at: "2030-01-07T08:00:00Z",
    p_customer_name: "Robot",
    p_customer_email: "robot@randul-test.dev",
  });

// Each run starts with no tries counted at the test shops.
const forgetTries = () => site.from("booking_turns").delete().in("shop_id", [a.shopId, b.shopId]);

beforeAll(async () => {
  ({ a, b } = await testOwners());
  const svc = await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single();
  serviceId = svc.data!.id;
  await forgetTries();
}, 40_000);

afterAll(forgetTries);

describe("only the website's server can book", () => {
  it("refuses a stranger who calls book_appointment directly", async () => {
    const res = await tryBooking(anon);
    expect(res.error).not.toBeNull();
    expect(res.error?.message).not.toMatch(/^(too_soon|too_far|outside_hours|slot_taken)$/);
  });

  it("refuses a signed-in person who calls it directly", async () => {
    const person = await owner("customer-test-c@randul-test.dev");
    expect((await tryBooking(person.db)).error).not.toBeNull();
  });

  it("keeps the try counter shut to the outside", async () => {
    expect((await anon.rpc("take_booking_turn", { p_shop_id: a.shopId, p_visitor: newVisitor() })).error).not.toBeNull();
    expect((await a.db.rpc("take_booking_turn", { p_shop_id: a.shopId, p_visitor: newVisitor() })).error).not.toBeNull();
    expect((await anon.from("booking_turns").select("*").limit(1)).data ?? []).toEqual([]);
    expect((await a.db.from("booking_turns").select("*").limit(1)).data ?? []).toEqual([]);
  });

  it("keeps the demo-account list shut to the outside", async () => {
    expect((await anon.rpc("old_demo_accounts", {})).error).not.toBeNull();
    expect((await a.db.rpc("old_demo_accounts", {})).error).not.toBeNull();
    expect((await site.rpc("old_demo_accounts", { p_days: 3, p_limit: 1 })).error).toBeNull();
  });
});

describe("tries per visitor", () => {
  it("allows 6 tries per hour at one shop, then says no", async () => {
    const visitor = newVisitor();
    for (let i = 0; i < 6; i++) expect((await take(visitor)).data).toBe("ok");
    expect((await take(visitor)).data).toBe("visitor_limit");
    // Another visitor is not affected.
    expect((await take(newVisitor())).data).toBe("ok");
  });

  it("counts one visitor's tries at all shops together for the day", async () => {
    const visitor = newVisitor();
    // 18 tries earlier today (two hours ago, so the hourly limit is fine again)…
    const earlier = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const old = Array.from({ length: 18 }, () => ({ shop_id: a.shopId, visitor, created_at: earlier }));
    expect((await site.from("booking_turns").insert(old)).error).toBeNull();
    // …so only 2 more are allowed today, at any shop.
    expect((await take(visitor, b.shopId)).data).toBe("ok");
    expect((await take(visitor, a.shopId)).data).toBe("ok");
    expect((await take(visitor, b.shopId)).data).toBe("visitor_limit");
  });

  it("answers shop_not_found for a shop that doesn't exist", async () => {
    expect((await take(newVisitor(), "00000000-0000-4000-8000-000000000000")).data).toBe("shop_not_found");
  });

  it("refuses a missing or silly visitor code", async () => {
    expect((await take("")).error?.message).toBe("invalid_visitor");
    expect((await take("x".repeat(200))).error?.message).toBe("invalid_visitor");
  });
});
