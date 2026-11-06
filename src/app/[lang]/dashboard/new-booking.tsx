import Link from "next/link";
import { Sheet, SheetHeader } from "@/components/sheet";
import { shopToday } from "@/lib/booking";
import { requireShop } from "@/lib/shop";
import { addDays, isoWeekday } from "@/lib/slots";
import { zonedToUtc } from "@/lib/time";
import { NewBookingForm, type NewBookingData } from "./new-booking-form";

const DAYS = 7;
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });

/**
 * The "New booking" sheet, for walk-ins and phone calls. Opened by the round
 * "+" button, or by tapping an empty time in the calendar (which fills in the
 * day, time and person).
 */
export async function NewBookingSheet({
  closeHref,
  date,
  time,
  staffId,
  view,
}: {
  closeHref: string;
  date?: string;
  time?: string;
  staffId?: string;
  view: string;
}) {
  const { supabase, shop } = await requireShop();
  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);
  const wanted = date && date >= today ? date : today;
  // A week of days to pick from: from today, or from the tapped day if it is further away.
  const first = wanted <= addDays(today, DAYS - 1) ? today : wanted;
  const last = addDays(first, DAYS);
  const from = zonedToUtc(first, "00:00", tz).toISOString();
  const to = zonedToUtc(last, "00:00", tz).toISOString();

  const [{ data: services }, { data: staff }, { data: hours }, { data: bookings }, { data: offs }] = await Promise.all([
    supabase.from("services").select("id, name, duration_minutes").eq("shop_id", shop.id).eq("active", true).order("created_at"),
    supabase.from("staff").select("id, name").eq("shop_id", shop.id).eq("active", true).order("created_at"),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("shop_id", shop.id),
    supabase.from("bookings").select("starts_at, ends_at, staff_id").eq("shop_id", shop.id).eq("status", "booked").lt("starts_at", to).gt("ends_at", from),
    supabase.from("time_off").select("starts_at, ends_at, staff_id").eq("shop_id", shop.id).lt("starts_at", to).gt("ends_at", from),
  ]);

  const list = services ?? [];
  const team = staff ?? [];
  const data: NewBookingData = {
    services: list.map((s) => ({ id: s.id, name: s.name, duration: s.duration_minutes })),
    staff: team.map((w) => ({ id: w.id, name: w.name })),
    days: Array.from({ length: DAYS }, (_, i) => {
      const d = addDays(first, i);
      return {
        date: d,
        weekday: weekday.format(asUtc(d)),
        num: dayNum.format(asUtc(d)),
        hours: (hours ?? []).filter((h) => h.weekday === isoWeekday(d)).map((h) => ({ opens: h.opens, closes: h.closes })),
      };
    }),
    busy: [
      ...(bookings ?? []).map((b) => ({ start: b.starts_at, end: b.ends_at, staffId: b.staff_id as string | null })),
      ...(offs ?? []).map((o) => ({ start: o.starts_at, end: o.ends_at, staffId: o.staff_id as string | null })),
    ],
    timezone: tz,
    now: now.toISOString(),
    initial: {
      date: wanted,
      time,
      staffId: staffId && team.some((w) => w.id === staffId) ? staffId : undefined,
    },
    view,
  };

  return (
    <Sheet label="New booking" closeHref={closeHref}>
      <SheetHeader title="New booking" description="For walk-ins and phone calls." closeHref={closeHref} />
      {list.length === 0 || team.length === 0 ? (
        <p className="text-sm text-neutral-400">
          {list.length === 0 ? "Add a service first, on the " : "Add a person first, on the "}
          <Link href={list.length === 0 ? "/dashboard/services" : "/dashboard/team"} className="font-medium text-accent-400 hover:underline">
            {list.length === 0 ? "Services" : "Team"}
          </Link>{" "}
          page.
        </p>
      ) : (
        <NewBookingForm key={`${wanted}-${time}-${staffId}`} data={data} />
      )}
    </Sheet>
  );
}
