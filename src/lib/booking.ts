import "server-only";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import { cacheLife } from "next/cache";
import { cache } from "react";
import type { Currency } from "@/lib/format";
import { addDays, getTeamFreeSlots, isoWeekday, type OpeningBlock, type StaffBusy } from "@/lib/slots";
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
  /** A gap kept free after each booking. */
  buffer_minutes: number;
  /** Customers can't cancel or move online this many hours before. */
  cancel_deadline_hours: number;
  /** The logo in Storage (see lib/media.ts), if any. */
  logo_path: string | null;
};

export type PublicService = { id: string; name: string; duration_minutes: number; price_cents: number | null };
export type PublicStaff = { id: string; name: string };
export type WeeklyHours = OpeningBlock & { weekday: number };

/**
 * Just the shop's name and about text, for the browser tab title and link previews.
 * Public data read without the visitor's login, and remembered for a few minutes,
 * so Next.js can work it out ahead of time.
 */
export async function getShopMeta(slug: string) {
  "use cache";
  cacheLife("minutes");
  const db = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await db.from("shops").select("name, about").eq("slug", slug).maybeSingle<{ name: string; about: string }>();
  return data;
}

/** A shop's public page data, or null if the web address doesn't exist. */
export const getPublicShop = cache(async (slug: string) => loadShop(await createClient(), "slug", slug));

/**
 * The same, found by id with any database client. For work done after the
 * page has answered (like waitlist emails), where there is no visitor login.
 */
export const getShopById = (db: SupabaseClient, id: string) => loadShop(db, "id", id);

async function loadShop(supabase: SupabaseClient, by: "slug" | "id", value: string) {
  const { data: shop } = await supabase
    .from("shops")
    .select("id, name, slug, timezone, currency, about, address, phone, booking_window_days, min_notice_minutes, slot_step_minutes, buffer_minutes, cancel_deadline_hours, logo_path")
    .eq(by, value)
    .maybeSingle<PublicShop>();
  if (!shop) return null;

  const [{ data: services }, { data: hours }, { data: staff }, { data: photos }] = await Promise.all([
    // Owners viewing their own page could also see hidden services, so filter explicitly.
    supabase
      .from("services")
      .select("id, name, duration_minutes, price_cents")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("created_at")
      .returns<PublicService[]>(),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("shop_id", shop.id).returns<WeeklyHours[]>(),
    // The same for workers: only the ones taking bookings.
    supabase
      .from("staff")
      .select("id, name")
      .eq("shop_id", shop.id)
      .eq("active", true)
      .order("created_at")
      .returns<PublicStaff[]>(),
    supabase.from("shop_photos").select("path").eq("shop_id", shop.id).order("position").order("created_at").returns<{ path: string }[]>(),
  ]);

  return { supabase, shop, services: services ?? [], hours: hours ?? [], staff: staff ?? [], photos: (photos ?? []).map((p) => p.path) };
}

export type ShopData = NonNullable<Awaited<ReturnType<typeof loadShop>>>;

export type DayAvailability = {
  date: string;
  slots: { iso: string; label: string }[];
  /** Open, but every time is taken (asked for with `withFull`): people can join the waitlist. */
  full?: boolean;
};

/**
 * Free times for `days` calendar days starting at `fromDate` (shop time).
 * With `staffId`, only that worker's free times. Without it, the times when anyone is free.
 */
export async function getAvailability(
  data: ShopData,
  service: PublicService,
  fromDate: string,
  days: number,
  now: Date,
  staffId?: string,
  /** A booking being moved: its own time doesn't count as taken. */
  ignore?: { staffId: string; startsAt: string },
  /** Also work out which days are full rather than closed (one more small query). */
  withFull = false,
): Promise<DayAvailability[]> {
  const { supabase, shop, hours, staff } = data;
  const rangeStart = zonedToUtc(fromDate, "00:00", shop.timezone);
  const rangeEnd = zonedToUtc(addDays(fromDate, days), "00:00", shop.timezone);

  const range = { p_shop_id: shop.id, p_from: rangeStart.toISOString(), p_to: rangeEnd.toISOString() };
  const [{ data: busyRows, error }, offRows] = await Promise.all([
    supabase.rpc("get_busy_times", range),
    withFull ? supabase.rpc("get_days_off", range).then((r) => (r.data ?? []) as BusyRow[]) : Promise.resolve(null),
  ]);
  if (error) throw new Error(`Could not load free times: ${error.message}`);
  // Taken times include the shop's gap before each booking, so the booking
  // being moved shows up starting that much earlier.
  const ignoreAt = ignore ? Date.parse(ignore.startsAt) - shop.buffer_minutes * 60_000 : NaN;
  const toBusy = (b: BusyRow): StaffBusy => ({ start: new Date(b.starts_at), end: new Date(b.ends_at), staffId: b.staff_id });
  const busy = (busyRows as BusyRow[])
    .filter((b) => !(ignore && b.staff_id === ignore.staffId && Date.parse(b.starts_at) === ignoreAt))
    .map(toBusy);
  const daysOff = offRows?.map(toBusy);
  const staffIds = staff.map((w) => w.id);

  return Array.from({ length: days }, (_, i) => {
    const date = addDays(fromDate, i);
    const input = {
      date,
      timezone: shop.timezone,
      hours: hours.filter((h) => h.weekday === isoWeekday(date)),
      durationMinutes: service.duration_minutes,
      now,
      minNoticeMinutes: shop.min_notice_minutes,
      windowDays: shop.booking_window_days,
      stepMinutes: shop.slot_step_minutes,
    };
    const slots = getTeamFreeSlots(input, busy, staffIds, staffId);
    // Full = no free time now, but there would be with nobody booked.
    const full = daysOff && slots.length === 0 ? getTeamFreeSlots(input, daysOff, staffIds, staffId).length > 0 : undefined;
    return { date, slots: slots.map((s) => ({ iso: s.start.toISOString(), label: s.label })), ...(full ? { full } : {}) };
  });
}

type BusyRow = { starts_at: string; ends_at: string; staff_id: string | null };

/** Today's date in the shop's time zone. */
export function shopToday(timezone: string, now: Date) {
  return utcToZoned(now, timezone).date;
}
