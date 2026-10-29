/**
 * Lock test against the real Supabase database (run with `npm run test:db`).
 * It proves the row level security rules: one shop owner can never read
 * private data of, or change, another owner's shop, and strangers can only
 * see public things.
 *
 * It uses two test owners (A and B) and creates them the first time it runs.
 * Email confirmation must be off in Supabase for the first run to sign them up.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const PASSWORD = "Lock-test-river-7-cactus";

function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Signs in a test owner, signing them up first if needed. */
async function owner(email: string) {
  const db = client();
  let res = await db.auth.signInWithPassword({ email, password: PASSWORD });
  if (res.error) {
    const up = await db.auth.signUp({ email, password: PASSWORD });
    if (up.error) throw up.error;
    res = await db.auth.signInWithPassword({ email, password: PASSWORD });
  }
  if (res.error) throw res.error;
  return { db, userId: res.data.user!.id };
}

/** Gives the owner a shop with one visible and one hidden service, hours, a day off and a note. */
async function ensureShop(db: SupabaseClient, userId: string, slug: string) {
  const existing = await db.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  let shopId = existing.data?.id as string | undefined;
  if (!shopId) {
    const made = await db.from("shops").insert({ name: `Lock test ${slug}`, slug, currency: "EUR" }).select("id").single();
    if (made.error) throw made.error;
    shopId = made.data.id;
    await db.from("services").insert([
      { shop_id: shopId, name: "Visible service", duration_minutes: 30, active: true },
      { shop_id: shopId, name: "Hidden service", duration_minutes: 30, active: false },
    ]);
    await db.from("opening_hours").insert({ shop_id: shopId, weekday: 1, opens: "09:00", closes: "17:00" });
    await db.from("time_off").insert({ shop_id: shopId, starts_at: "2030-01-01T08:00:00Z", ends_at: "2030-01-02T08:00:00Z", reason: "private reason" });
    await db.from("shop_info").insert({ shop_id: shopId, question: "Parking?", answer: "Yes." });
  }
  return shopId!;
}

let a: { db: SupabaseClient; userId: string; shopId: string };
let b: { db: SupabaseClient; userId: string; shopId: string };
const anon = client();

beforeAll(async () => {
  const ownerA = await owner("lock-test-a@randul-test.dev");
  const ownerB = await owner("lock-test-b@randul-test.dev");
  a = { ...ownerA, shopId: await ensureShop(ownerA.db, ownerA.userId, "lock-test-a") };
  b = { ...ownerB, shopId: await ensureShop(ownerB.db, ownerB.userId, "lock-test-b") };
}, 30_000);

describe("an owner and their own shop", () => {
  it("sees their own hidden services and private days off", async () => {
    const services = await a.db.from("services").select("name").eq("shop_id", a.shopId);
    expect(services.data?.map((s) => s.name)).toContain("Hidden service");
    const off = await a.db.from("time_off").select("reason").eq("shop_id", a.shopId);
    expect(off.data?.[0]?.reason).toBe("private reason");
  });
});

describe("owner B looking at owner A's shop", () => {
  it("can see A's public shop page details", async () => {
    const shop = await b.db.from("shops").select("name").eq("id", a.shopId).single();
    expect(shop.data?.name).toBe("Lock test lock-test-a");
  });

  it("cannot see A's hidden services", async () => {
    const services = await b.db.from("services").select("name").eq("shop_id", a.shopId);
    expect(services.data?.map((s) => s.name)).toEqual(["Visible service"]);
  });

  it("cannot see A's private days off", async () => {
    const off = await b.db.from("time_off").select("id").eq("shop_id", a.shopId);
    expect(off.data).toEqual([]);
  });

  it("cannot rename A's shop", async () => {
    const res = await b.db.from("shops").update({ name: "Hacked" }).eq("id", a.shopId).select("id");
    expect(res.data ?? []).toEqual([]);
    const shop = await a.db.from("shops").select("name").eq("id", a.shopId).single();
    expect(shop.data?.name).toBe("Lock test lock-test-a");
  });

  it("cannot take over A's shop by changing the owner", async () => {
    const res = await b.db.from("shops").update({ owner_id: b.userId }).eq("id", a.shopId).select("id");
    expect(res.data ?? []).toEqual([]);
  });

  it("cannot add a service to A's shop", async () => {
    const res = await b.db.from("services").insert({ shop_id: a.shopId, name: "Sneaky", duration_minutes: 30 });
    expect(res.error?.code).toBe("42501"); // "not allowed"
  });

  it("cannot move their own service into A's shop", async () => {
    const mine = await b.db.from("services").select("id").eq("shop_id", b.shopId).limit(1).single();
    const res = await b.db.from("services").update({ shop_id: a.shopId }).eq("id", mine.data!.id).select("id");
    expect(res.error?.code ?? "blocked").not.toBe(undefined);
    const stillMine = await b.db.from("services").select("shop_id").eq("id", mine.data!.id).single();
    expect(stillMine.data?.shop_id).toBe(b.shopId);
  });

  it("cannot delete A's services, hours, notes or days off", async () => {
    for (const table of ["services", "opening_hours", "shop_info", "time_off"] as const) {
      const res = await b.db.from(table).delete().eq("shop_id", a.shopId).select("id");
      expect(res.data ?? [], table).toEqual([]);
    }
    const left = await a.db.from("services").select("id", { count: "exact", head: true }).eq("shop_id", a.shopId);
    expect(left.count).toBe(2);
  });

  it("cannot read A's bookings", async () => {
    const res = await b.db.from("bookings").select("id").eq("shop_id", a.shopId);
    expect(res.data ?? []).toEqual([]);
  });
});

describe("a stranger who is not logged in", () => {
  it("can see public things: shops, active services, hours and notes", async () => {
    expect((await anon.from("shops").select("id").eq("id", a.shopId)).data).toHaveLength(1);
    expect((await anon.from("services").select("name").eq("shop_id", a.shopId)).data?.map((s) => s.name)).toEqual([
      "Visible service",
    ]);
    expect((await anon.from("opening_hours").select("id").eq("shop_id", a.shopId)).data).toHaveLength(1);
    expect((await anon.from("shop_info").select("id").eq("shop_id", a.shopId)).data).toHaveLength(1);
  });

  it("cannot see days off or bookings", async () => {
    const off = await anon.from("time_off").select("id");
    expect(off.data ?? []).toEqual([]);
    const bookings = await anon.from("bookings").select("id");
    expect(bookings.data ?? []).toEqual([]);
  });

  it("cannot create a shop", async () => {
    const res = await anon.from("shops").insert({ name: "Nope", slug: "nope-shop" });
    expect(res.error).not.toBeNull();
  });
});
