/**
 * The waitlist, against the real database (part of `npm run test:db`).
 * Owner B plays a customer waiting at shop A. Wishes are only rows: the
 * database doesn't check the day is full (the booking page does that).
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
let today: string;
const day = (n: number) => addDays(today, n);

const join = (db = b.db, d = day(3), staff: string | null = null, phone = "") =>
  db.rpc("join_waitlist", { p_service_id: serviceId, p_staff_id: staff, p_day: d, p_phone: phone });

async function cleanUp() {
  await admin.from("waitlist").delete().eq("shop_id", a.shopId);
  await admin.from("bookings").delete().eq("shop_id", a.shopId).eq("customer_email", "waitlist-test@randul-test.dev");
}

beforeAll(async () => {
  ({ a, b } = await testOwners());
  serviceId = (await a.db.from("services").select("id").eq("shop_id", a.shopId).eq("name", "Visible service").single()).data!.id;
  workerId = (await a.db.from("staff").select("id").eq("shop_id", a.shopId).order("created_at").limit(1).single()).data!.id;
  today = utcToZoned(new Date(), TZ).date;
  await cleanUp();
}, 40_000);

afterAll(cleanUp);

describe("joining", () => {
  it("needs a real account", async () => {
    expect((await join(anon)).error).not.toBeNull();
    const demo = client();
    const signIn = await demo.auth.signInAnonymously();
    if (signIn.error) throw signIn.error;
    expect((await join(demo)).error?.message).toBe("demo_account");
    await admin.auth.admin.deleteUser(signIn.data.user!.id);
  });

  it("works for a customer, and twice gives the same wish", async () => {
    const first = await join(b.db, day(3), null, " +40 700 000 111 ");
    expect(first.error).toBeNull();
    const again = await join(b.db, day(3));
    expect(again.data).toBe(first.data);
    const { data: mine } = await b.db.from("waitlist").select("id, day, name, email, phone").eq("customer_id", b.userId);
    expect(mine).toHaveLength(1);
    expect(mine![0]).toMatchObject({ day: day(3), email: "lock-test-b@randul-test.dev", phone: "+40 700 000 111" });
  });

  it("is not for the shop's own owner", async () => {
    expect((await join(a.db)).error?.message).toBe("own_shop");
  });

  it("only for days the shop takes bookings", async () => {
    expect((await join(b.db, day(-1))).error?.message).toBe("bad_day");
    expect((await join(b.db, day(400))).error?.message).toBe("bad_day");
  });

  it("only with a worker of that shop", async () => {
    expect((await join(b.db, day(3), "00000000-0000-4000-8000-000000000000")).error?.message).toBe("staff_not_found");
    expect((await join(b.db, day(3), workerId)).error).toBeNull();
  });

  it("allows 5 open wishes at most", async () => {
    for (const n of [4, 5, 6]) expect((await join(b.db, day(n))).error).toBeNull();
    expect((await join(b.db, day(7))).error?.message).toBe("too_many_waits");
    await b.db.from("waitlist").delete().eq("customer_id", b.userId).in("day", [day(5), day(6)]);
  });
});

describe("who sees what", () => {
  it("the owner sees their shop's waiting people; strangers see nothing", async () => {
    const { data: owner } = await a.db.from("waitlist").select("name, email, phone").eq("shop_id", a.shopId);
    expect(owner!.length).toBeGreaterThan(0);
    expect((await anon.from("waitlist").select("id")).data ?? []).toHaveLength(0);
  });

  it("nobody adds rows directly", async () => {
    const res = await b.db.from("waitlist").insert({ shop_id: a.shopId, service_id: serviceId, day: day(8), customer_id: b.userId });
    expect(res.error).not.toBeNull();
  });

  it("the owner can take someone off", async () => {
    const { data: row } = await a.db.from("waitlist").select("id").eq("shop_id", a.shopId).eq("day", day(4)).single();
    await a.db.from("waitlist").delete().eq("id", row!.id);
    expect((await admin.from("waitlist").select("id").eq("id", row!.id)).data).toHaveLength(0);
  });
});

describe("booking that day", () => {
  it("removes the customer's wish for it", async () => {
    let saturday = day(8); // never the day(3) wish checked below
    while (isoWeekday(saturday) !== 6) saturday = addDays(saturday, 1);
    expect((await join(b.db, saturday)).error).toBeNull();
    // A booking on that day becomes theirs (like "Add to My bookings").
    const made = await a.db
      .rpc("owner_add_booking", {
        p_service_id: serviceId,
        p_staff_id: workerId,
        p_starts_at: zonedToUtc(saturday, "08:00", TZ).toISOString(),
        p_customer_name: "Waitlist Tester",
        p_customer_email: "waitlist-test@randul-test.dev",
        p_customer_phone: "",
      })
      .single<{ booking_id: string }>();
    expect(made.error).toBeNull();
    await admin.from("bookings").update({ customer_id: b.userId }).eq("id", made.data!.booking_id);
    expect((await admin.from("waitlist").select("id").eq("customer_id", b.userId).eq("day", saturday)).data).toHaveLength(0);
    expect((await admin.from("waitlist").select("id").eq("customer_id", b.userId).eq("day", day(3))).data!.length).toBeGreaterThan(0);
  });
});

describe("days off", () => {
  it("are public, without the reason", async () => {
    const res = await anon.rpc("get_days_off", { p_shop_id: a.shopId, p_from: "2029-12-31T00:00:00Z", p_to: "2030-01-03T00:00:00Z" });
    expect(res.error).toBeNull();
    const rows = res.data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(["ends_at", "staff_id", "starts_at"]);
  });
});
