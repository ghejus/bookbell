/**
 * Reviews, against the real database (part of `npm run test:db`).
 * Shop A's owner adds visits on Saturdays (shop A is closed then; the owner may
 * add any time), and the server key turns them into "booked online" visits,
 * the only kind customers can review.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, isoWeekday } from "../../src/lib/slots";
import { utcToZoned, zonedToUtc } from "../../src/lib/time";
import { client, server, testOwners, type TestOwner } from "./helpers";

const TZ = "Europe/Bucharest";
const anon = client();
const admin = server();
let a: TestOwner;
let b: TestOwner;
let serviceId: string;
let workerId: string;
let past: string; // a Saturday about 3 weeks ago
let old: string; // a Saturday more than 60 days ago
let future: string; // a Saturday about 4 weeks ahead

const saturday = (fromToday: number) => {
  let day = addDays(utcToZoned(new Date(), TZ).date, fromToday);
  while (isoWeekday(day) !== 6) day = addDays(day, 1);
  return day;
};

type Made = { booking_id: string; manage_token: string };

/** A visit by a customer, booked online. */
async function visit(date: string, time: string, { online = true } = {}) {
  const res = await a.db
    .rpc("owner_add_booking", {
      p_service_id: serviceId,
      p_staff_id: workerId,
      p_starts_at: zonedToUtc(date, time, TZ).toISOString(),
      p_customer_name: "Review Tester Person",
      p_customer_email: "reviews-test@randul-test.dev",
      p_customer_phone: "",
    })
    .single<Made>();
  if (res.error) throw res.error;
  if (online) await admin.from("bookings").update({ source: "online" }).eq("id", res.data.booking_id);
  return res.data;
}

const review = (token: string | null, stars: number, body = "", bookingId: string | null = null, db = anon) =>
  db.rpc("leave_review", { p_token: token, p_booking_id: bookingId, p_stars: stars, p_body: body });

async function cleanUp() {
  const { data } = await admin.from("bookings").select("id").eq("customer_email", "reviews-test@randul-test.dev");
  const ids = (data ?? []).map((r) => r.id as string);
  if (ids.length) {
    await admin.from("reviews").delete().in("booking_id", ids);
    await admin.from("bookings").delete().in("id", ids);
  }
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  serviceId = (await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single()).data!.id;
  workerId = (await a.db.from("staff").select("id").eq("shop_id", a.shopId).order("created_at").limit(1).single()).data!.id;
  past = saturday(-24);
  old = saturday(-75);
  future = saturday(28);
  await cleanUp();
}, 40_000);

afterAll(cleanUp);

describe("who can review", () => {
  it("someone who came, with the link from their email", async () => {
    const v = await visit(past, "09:00");
    const state = await anon.rpc("review_by_token", { p_token: v.manage_token }).single<{ state: string }>();
    expect(state.data?.state).toBe("open");
    expect((await review(v.manage_token, 5, "  Lovely  ")).error).toBeNull();

    const shown = await anon.rpc("shop_reviews", { p_shop_id: a.shopId });
    const mine = (shown.data as { stars: number; body: string; author: string }[]).find((r) => r.body === "Lovely");
    expect(mine).toMatchObject({ stars: 5, author: "Review P." });
    const rating = await anon.rpc("shop_rating", { p_shop_id: a.shopId }).single<{ total: number; counts: number[] }>();
    expect(rating.data!.total).toBeGreaterThan(0);
    expect(rating.data!.counts).toHaveLength(5);
  });

  it("not with a wrong link", async () => {
    expect((await review("0".repeat(48), 5)).error?.message).toBe("not_found");
    expect((await review("not a token", 5)).error?.message).toBe("not_found");
  });

  it("not before the visit", async () => {
    const v = await visit(future, "09:00");
    expect((await review(v.manage_token, 5)).error?.message).toBe("not_yet");
  });

  it("not for a visit the owner added", async () => {
    const v = await visit(past, "10:00", { online: false });
    expect((await review(v.manage_token, 5)).error?.message).toBe("cant_review");
  });

  it("not for a cancelled visit or one more than 60 days ago", async () => {
    const cancelled = await visit(past, "11:00");
    await a.db.from("bookings").update({ status: "cancelled" }).eq("id", cancelled.booking_id);
    expect((await review(cancelled.manage_token, 4)).error?.message).toBe("cant_review");
    const tooOld = await visit(old, "09:00");
    expect((await review(tooOld.manage_token, 4)).error?.message).toBe("cant_review");
  });

  it("not the shop's own owner", async () => {
    const v = await visit(past, "12:00");
    expect((await review(v.manage_token, 5, "", null, a.db)).error?.message).toBe("own_shop");
  });

  it("refuses no star, six stars or too many words", async () => {
    const v = await visit(past, "13:00");
    expect((await review(v.manage_token, 0)).error?.message).toBe("bad_review");
    expect((await review(v.manage_token, 6)).error?.message).toBe("bad_review");
    expect((await review(v.manage_token, 5, "x".repeat(1001))).error?.message).toBe("bad_review");
  });
});

describe("changing a review", () => {
  it("works for 14 days, then it is locked", async () => {
    const v = await visit(past, "14:00");
    expect((await review(v.manage_token, 2, "First go")).error).toBeNull();
    expect((await review(v.manage_token, 4, "Second go")).error).toBeNull();
    const { data: rows } = await admin.from("reviews").select("id, stars, body").eq("booking_id", v.booking_id);
    expect(rows).toHaveLength(1);
    expect(rows![0]).toMatchObject({ stars: 4, body: "Second go" });

    await admin.from("reviews").update({ created_at: new Date(Date.now() - 15 * 86_400_000).toISOString() }).eq("booking_id", v.booking_id);
    expect((await review(v.manage_token, 1)).error?.message).toBe("locked");
  });
});

describe("with an account", () => {
  it("the customer reviews their own booking from My bookings", async () => {
    const v = await visit(past, "15:00");
    // Owner B plays the customer here: it's their booking, at someone else's shop.
    await admin.from("bookings").update({ customer_id: b.userId }).eq("id", v.booking_id);
    const mine = await b.db.rpc("my_reviews");
    expect((mine.data as { booking_id: string; state: string }[]).find((r) => r.booking_id === v.booking_id)?.state).toBe("open");
    expect((await review(null, 3, "From my account", v.booking_id, b.db)).error).toBeNull();
    const after = await b.db.rpc("my_reviews");
    expect((after.data as { booking_id: string; state: string }[]).find((r) => r.booking_id === v.booking_id)?.state).toBe("done");
  });

  it("but not someone else's booking", async () => {
    const v = await visit(past, "16:00");
    expect((await review(null, 3, "", v.booking_id, b.db)).error?.message).toBe("not_found");
    expect((await review(null, 3, "", v.booking_id, anon)).error?.message).toBe("not_found");
  });
});

describe("the owner", () => {
  it("can reply to a review of their shop, and remove the reply", async () => {
    const v = await visit(past, "17:00");
    await review(v.manage_token, 5, "Reply to me");
    const { data: row } = await a.db.from("reviews").select("id").eq("booking_id", v.booking_id).single();
    expect((await a.db.rpc("reply_to_review", { p_review_id: row!.id, p_reply: "Thanks!" })).error).toBeNull();
    const seen = await anon.rpc("review_by_token", { p_token: v.manage_token }).single<{ reply: string }>();
    expect(seen.data?.reply).toBe("Thanks!");
    expect((await a.db.rpc("reply_to_review", { p_review_id: row!.id, p_reply: "  " })).error).toBeNull();
    expect((await admin.from("reviews").select("reply, replied_at").eq("id", row!.id).single()).data).toEqual({ reply: null, replied_at: null });
  });

  it("can't reply on another shop, delete or change a review", async () => {
    const v = await visit(past, "18:00");
    await review(v.manage_token, 1, "Bad");
    const { data: row } = await a.db.from("reviews").select("id").eq("booking_id", v.booking_id).single();
    expect((await b.db.rpc("reply_to_review", { p_review_id: row!.id, p_reply: "Hi" })).error?.message).toBe("not_found");
    await a.db.from("reviews").delete().eq("id", row!.id);
    await a.db.from("reviews").update({ stars: 5 }).eq("id", row!.id);
    expect((await admin.from("reviews").select("stars").eq("id", row!.id).single()).data?.stars).toBe(1);
  });

  it("marking the visit \"didn't come\" hides the review", async () => {
    const v = await visit(past, "19:00");
    await review(v.manage_token, 1, "Hide me please");
    expect((await a.db.from("bookings").update({ status: "no_show" }).eq("id", v.booking_id)).error).toBeNull();
    const shown = await anon.rpc("shop_reviews", { p_shop_id: a.shopId, p_limit: 50 });
    expect((shown.data as { body: string }[]).some((r) => r.body === "Hide me please")).toBe(false);
  });
});

describe("privacy", () => {
  it("visitors can't read the reviews table, and the public list has no contact details", async () => {
    const direct = await anon.from("reviews").select("*");
    expect(direct.data ?? []).toHaveLength(0);
    const fromB = await b.db.from("reviews").select("id").eq("shop_id", a.shopId);
    expect(fromB.data ?? []).toHaveLength(0);
    const shown = await anon.rpc("shop_reviews", { p_shop_id: a.shopId, p_limit: 1 });
    expect(Object.keys((shown.data as object[])[0] ?? {})).not.toContain("customer_email");
  });
});
