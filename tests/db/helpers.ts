// Shared setup for the tests that talk to the real Supabase database.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
// The test owners' password lives in .env.local (never in the code), because the code is public.
const PASSWORD: string =
  process.env.TEST_OWNER_PASSWORD ??
  (() => {
    throw new Error("Add TEST_OWNER_PASSWORD to .env.local to run the database tests (see README).");
  })();

export function client() {
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Signs in a test owner, signing them up first if needed. */
export async function owner(email: string) {
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

/** Gives the owner a shop with one visible and one hidden service, Monday hours, a day off and a note. */
export async function ensureShop(db: SupabaseClient, userId: string, slug: string) {
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

export type TestOwner = { db: SupabaseClient; userId: string; shopId: string };

export async function testOwners(): Promise<{ a: TestOwner; b: TestOwner }> {
  const ownerA = await owner("lock-test-a@randul-test.dev");
  const ownerB = await owner("lock-test-b@randul-test.dev");
  return {
    a: { ...ownerA, shopId: await ensureShop(ownerA.db, ownerA.userId, "lock-test-a") },
    b: { ...ownerB, shopId: await ensureShop(ownerB.db, ownerB.userId, "lock-test-b") },
  };
}
