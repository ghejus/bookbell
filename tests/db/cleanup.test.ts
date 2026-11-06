/**
 * The daily cleanup of old demo accounts, against the real database (part of
 * `npm run test:db`). A no-email (anonymous) account makes a small shop with a
 * booking, the way "Try a demo shop" does. Deleting the account, as the
 * cleanup job does, must leave nothing of that shop behind.
 */
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { client, server } from "./helpers";

const site = server();

describe("deleting an old demo account", () => {
  it("removes its shop and everything in it", async () => {
    const visitor = client();
    const signIn = await visitor.auth.signInAnonymously();
    expect(signIn.error).toBeNull();
    const userId = signIn.data.user!.id;

    const slug = `cleanup-test-${randomBytes(4).toString("hex")}`;
    const shop = await visitor.from("shops").insert({ name: "Cleanup test", slug, currency: "EUR" }).select("id").single();
    expect(shop.error).toBeNull();
    const shopId = shop.data!.id as string;
    const service = await visitor
      .from("services")
      .insert({ shop_id: shopId, name: "Haircut", duration_minutes: 30 })
      .select("id")
      .single();
    await visitor.from("opening_hours").insert({ shop_id: shopId, weekday: 1, opens: "09:00", closes: "17:00" });
    await visitor.from("shop_info").insert({ shop_id: shopId, question: "Parking?", answer: "Yes." });
    const worker = await visitor.from("staff").select("id").eq("shop_id", shopId).single();
    const booking = await visitor
      .rpc("owner_add_booking", {
        p_service_id: service.data!.id,
        p_staff_id: worker.data!.id,
        p_starts_at: "2030-01-07T08:00:00Z",
        p_customer_name: "Walk-in",
      })
      .single<{ booking_id: string }>();
    expect(booking.error).toBeNull();

    expect((await site.auth.admin.deleteUser(userId)).error).toBeNull();

    const count = async (table: string, column = "shop_id", value = shopId) =>
      (await site.from(table).select("*", { count: "exact", head: true }).eq(column, value)).count;
    expect(await count("shops", "id")).toBe(0);
    for (const table of ["services", "staff", "opening_hours", "shop_info", "bookings"]) {
      expect(await count(table)).toBe(0);
    }
    expect(await count("booking_links", "booking_id", booking.data!.booking_id)).toBe(0);
  });
});
