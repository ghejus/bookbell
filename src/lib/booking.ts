import "server-only";
import { cache } from "react";
import type { Currency } from "@/lib/format";
import { addDays, getFreeSlots, isoWeekday, type Busy, type OpeningBlock } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { utcToZoned, zonedToUtc } from "@/lib/time";

// Everything the public booking page reads. Only public data: RLS lets
// anyone read shops, active services, opening hours and notes, and the
// get_busy_times function returns taken times with no customer details.

export type PublicShop = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: Currency;
  about: string;
  address: string;
  phone: string;
  booking_window_days: number;
  min_notice_minutes: number;
  slot_step_minutes: number;
};

export type PublicService = { id: string; name: string; duration_minutes: number; price_cents: number | null };
export type WeeklyHours = OpeningBlock & { weekday: number };

/** A shop's public page data, or null if the web address doesn't exist. */
export const getPublicShop = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, timezone, currency, about, address, phone, booking_window_days, min_notice_minutes, slot_step_minutes")
    .eq("slug", slug)
    .maybeSingle<PublicShop>();
  if (!shop) return null;

  const [{ data: services }, { data: hours }] = await Promise.all([
    // Owners viewing their own page could also see hidden services, so filter explicitly.
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("created_at")
      .returns<PublicService[]>(),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("shop_id", shop.id).returns<WeeklyHours[]>(),
  ]);

  return { supabase, shop, services: services ?? [], hours: hours ?? [] };
});

export type DayAvailability = { date: string; slots: { iso: string; label: string }[] };

/** Free times for `days` calendar days starting at `fromDate` (shop time). */
export async function getAvailability(
  data: NonNullable<Awaited<ReturnType<typeof getPublicShop>>>,
  service: PublicService,
  fromDate: string,
  days: number,
  now: Date,
): Promise<DayAvailability[]> {
  const { supabase, shop, hours } = data;
  const rangeStart = zonedToUtc(fromDate, "00:00", shop.timezone);
  const rangeEnd = zonedToUtc(addDays(fromDate, days), "00:00", shop.timezone);

  const { data: busyRows, error } = await supabase.rpc("get_busy_times", {
    p_shop_id: shop.id,
    p_from: rangeStart.toISOString(),
    p_to: rangeEnd.toISOString(),
  });
  if (error) throw new Error(`Could not load free times: ${error.message}`);
  const busy: Busy[] = (busyRows as { starts_at: string; ends_at: string }[]).map((b) => ({
    start: new Date(b.starts_at),
    end: new Date(b.ends_at),
  }));

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(fromDate, i);
    const slots = getFreeSlots({
      date,
      timezone: shop.timezone,
      hours: hours.filter((h) => h.weekday === isoWeekday(date)),
      durationMinutes: service.duration_minutes,
      busy,
      now,
      minNoticeMinutes: shop.min_notice_minutes,
      windowDays: shop.booking_window_days,
      stepMinutes: shop.slot_step_minutes,
    });
    return { date, slots: slots.map((s) => ({ iso: s.start.toISOString(), label: s.label })) };
  });
}

/** Today's date in the shop's time zone. */
export function shopToday(timezone: string, now: Date) {
  return utcToZoned(now, timezone).date;
}
