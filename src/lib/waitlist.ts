import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvailability, getShopById, shopToday, type ShopData } from "@/lib/booking";
import { asUtc, datesFor } from "@/lib/dates";
import { isTestAddress } from "@/lib/email/addresses";
import { sendEmail } from "@/lib/email/send";
import { spotOpenEmail } from "@/lib/email/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZoned } from "@/lib/time";

// The waitlist: people waiting for a time to open on a full day.
// Nothing runs in the background. Whoever looks (My bookings, the owner's
// list, or a cancel that just freed a time) checks the free times right then,
// with the same code as the booking page.

export const MAX_WAITS = 5;

export type WaitRow = {
  id: string;
  shop_id: string;
  service_id: string;
  staff_id: string | null;
  day: string;
  customer_id: string | null;
  name: string;
  email: string;
  phone: string;
  created_at: string;
  notified_at: string | null;
  /** The customer's language, for the email. */
  lang: "en" | "ro";
};

export type WaitWithTimes = WaitRow & {
  shopSlug: string;
  shopName: string;
  serviceName: string;
  /** Who they asked for; null = anyone. */
  staffName: string | null;
  /** Times free right now that fit the wish. */
  slots: { iso: string; label: string }[];
  /** The service or worker isn't taking bookings any more. */
  gone: boolean;
  /** The day has passed (in the shop's time zone). */
  past: boolean;
};

export const WAIT_COLUMNS = "id, shop_id, service_id, staff_id, day, customer_id, name, email, phone, created_at, notified_at, lang";

/** The booking page for a wish, on that day, ready to book. */
export function bookHref(w: Pick<WaitWithTimes, "shopSlug" | "service_id" | "staff_id" | "day">) {
  const p = new URLSearchParams({ service: w.service_id, date: w.day });
  if (w.staff_id) p.set("staff", w.staff_id);
  return `/s/${w.shopSlug}?${p}`;
}

/** Checks each wish against the free times right now. Each shop is loaded once. */
export async function withFreeTimes(db: SupabaseClient, rows: WaitRow[], now = new Date()): Promise<WaitWithTimes[]> {
  const shops = new Map<string, Promise<ShopData | null>>();
  return Promise.all(
    rows.map(async (row) => {
      if (!shops.has(row.shop_id)) shops.set(row.shop_id, getShopById(db, row.shop_id));
      const data = await shops.get(row.shop_id)!;
      const service = data?.services.find((s) => s.id === row.service_id);
      const worker = row.staff_id ? data?.staff.find((w) => w.id === row.staff_id) : undefined;
      const base = {
        ...row,
        past: data ? row.day < shopToday(data.shop.timezone, now) : true,
        shopSlug: data?.shop.slug ?? "",
        shopName: data?.shop.name ?? "",
        serviceName: service?.name ?? "",
        staffName: worker?.name ?? null,
      };
      if (!data || !service || (row.staff_id && !worker) || base.past) return { ...base, slots: [], gone: !base.past };
      const [day] = await getAvailability(data, service, row.day, 1, now, row.staff_id ?? undefined);
      return { ...base, slots: day?.slots ?? [], gone: false };
    }),
  );
}

/**
 * A booking was cancelled or moved away from `startsAt`: email the people
 * waiting for that day whose wish fits a free time now. Once each. Safe to run
 * after the page has answered (never throws).
 */
export async function notifyWaitlist(shopId: string, startsAt: string, site: string) {
  try {
    const admin = createAdminClient();
    if (!admin) return;
    const data = await getShopById(admin, shopId);
    if (!data) return;
    const day = utcToZoned(new Date(startsAt), data.shop.timezone).date;
    const { data: rows } = await admin
      .from("waitlist")
      .select(WAIT_COLUMNS)
      .eq("shop_id", shopId)
      .eq("day", day)
      .is("notified_at", null)
      .neq("email", "")
      .order("created_at")
      .limit(50)
      .returns<WaitRow[]>();
    const waits = await withFreeTimes(admin, rows ?? []);
    for (const w of waits) {
      if (w.slots.length === 0 || isTestAddress(w.email)) continue;
      // Claim it first, so two cancels at once can't both email.
      const { data: claimed } = await admin
        .from("waitlist")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", w.id)
        .is("notified_at", null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;
      await sendEmail({
        to: w.email,
        ...spotOpenEmail({
          name: w.name.split(/\s+/)[0] ?? "",
          shopName: w.shopName,
          serviceName: w.serviceName,
          dayLabel: datesFor(w.lang).longDay.format(asUtc(w.day)),
          times: w.slots.map((s) => s.label),
          bookUrl: `${site}${bookHref(w)}`,
          lang: w.lang,
        }),
      });
    }
  } catch (error) {
    console.error("Waitlist emails failed:", error);
  }
}
