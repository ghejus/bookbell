/**
 * Lock test against the real Supabase database (run with `npm run test:db`).
 * It proves the row level security rules: one shop owner can never read
 * private data of, or change, another owner's shop, and strangers can only
 * see public things.
 *
 * It uses two test owners (A and B) and creates them the first time it runs.
 * Email confirmation must be off in Supabase for the first run to sign them up.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { client, testOwners, type TestOwner } from "./helpers";

let a: TestOwner;
let b: TestOwner;
const anon = client();

beforeAll(async () => {
  ({ a, b } = await testOwners());
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
