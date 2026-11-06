"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { z } from "zod";
import { sendBookingEmails, sendShopChangeEmail, type OwnerBookingRow } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { flash } from "@/lib/flash";
import { fields } from "@/lib/form-data";
import { siteUrl } from "@/lib/site";
import { requireShop, type Shop } from "@/lib/shop";
import { isoWeekday } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { firstError } from "@/lib/validation";
import { notifyWaitlist } from "@/lib/waitlist";

// The owner's calendar: adding and moving bookings.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time.");
const view = z.enum(["day", "week"]).catch("day");

const addSchema = z.object({
  service_id: z.uuid("Pick a service."),
  staff_id: z.uuid("Pick who it is with."),
  date,
  time,
  customer_name: z.string().trim().min(1, "Type the customer’s name.").max(80),
  customer_email: z
    .string()
    .trim()
    .toLowerCase()
    .max(200)
    .refine((v) => v === "" || z.email().safeParse(v).success, "Type a valid email, or leave it empty."),
  customer_phone: z.string().trim().max(40),
  force: z.string().optional(),
  view,
});

const moveSchema = z.object({ id: z.uuid(), staff_id: z.uuid("Pick who it is with."), date, time, force: z.string().optional(), view });

/**
 * A gentle check before the owner books or moves outside opening hours or on a
 * day off. The owner may still do it (it is their calendar), after a second press.
 */
async function hoursWarning(
  supabase: Awaited<ReturnType<typeof requireShop>>["supabase"],
  shop: Shop,
  start: Date,
  minutes: number,
  staffId: string,
): Promise<string | null> {
  const end = new Date(start.getTime() + minutes * 60_000);
  const from = utcToZoned(start, shop.timezone);
  const to = utcToZoned(end, shop.timezone);
  const { data: hours } = await supabase
    .from("opening_hours")
    .select("opens, closes")
    .eq("shop_id", shop.id)
    .eq("weekday", isoWeekday(from.date))
    .returns<{ opens: string; closes: string }[]>();
  const inside =
    to.date === from.date && (hours ?? []).some((h) => h.opens.slice(0, 5) <= from.time && to.time <= h.closes.slice(0, 5));
  if (!inside) return "That’s outside your opening hours.";
  const { data: off } = await supabase
    .from("time_off")
    .select("id")
    .eq("shop_id", shop.id)
    .lt("starts_at", end.toISOString())
    .gt("ends_at", start.toISOString())
    .or(`staff_id.is.null,staff_id.eq.${staffId}`)
    .limit(1);
  if (off?.length) return "That’s during a day off.";
  return null;
}

/** "Thu 5 Nov 10:30", for toasts. */
const shortWhen = (date: string, time: string) =>
  `${new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00Z`))} ${time}`;

/** The warning once; the same time and person pressed again goes ahead. */
const forceKey = (d: { date: string; time: string; staff_id: string }) => `${d.date}T${d.time}|${d.staff_id}`;

export async function ownerAddBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const parsed = addSchema.safeParse({ customer_email: "", customer_phone: "", ...values });
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const d = parsed.data;
  const { supabase, shop } = await requireShop();
  const start = zonedToUtc(d.date, d.time, shop.timezone);

  if (d.force !== forceKey(d)) {
    const { data: service } = await supabase.from("services").select("duration_minutes").eq("id", d.service_id).maybeSingle();
    const warning = await hoursWarning(supabase, shop, start, service?.duration_minutes ?? 30, d.staff_id);
    if (warning) return { error: `${warning} Press “Add booking” again to add it anyway.`, values: { ...values, force: forceKey(d) } };
  }

  const { data, error } = await supabase
    .rpc("owner_add_booking", {
      p_service_id: d.service_id,
      p_staff_id: d.staff_id,
      p_starts_at: start.toISOString(),
      p_customer_name: d.customer_name,
      p_customer_email: d.customer_email,
      p_customer_phone: d.customer_phone,
    })
    .single<{ booking_id: string; manage_token: string }>();
  if (error || !data) {
    return {
      error: bookingError(error?.message, "Could not add the booking. Please try again.").replace(
        "Someone just booked that time. Please pick another one.",
        "That person already has a booking then. Pick another time or person.",
      ),
      values,
    };
  }

  if (d.customer_email) {
    const site = await siteUrl();
    after(() => sendBookingEmails(data.manage_token, site, { notifyOwner: false }));
  }
  await flash("added", "Booking added", `${d.customer_name}, ${shortWhen(d.date, d.time)}.`);
  redirect(`/dashboard/calendar?${d.view === "week" ? "view=week&" : ""}date=${d.date}`);
}

export async function ownerMoveBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const parsed = moveSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };
  const d = parsed.data;
  const { supabase, shop } = await requireShop();
  const start = zonedToUtc(d.date, d.time, shop.timezone);

  if (d.force !== forceKey(d)) {
    const { data: current } = await supabase.from("bookings").select("starts_at, ends_at").eq("id", d.id).maybeSingle();
    const minutes = current ? (Date.parse(current.ends_at) - Date.parse(current.starts_at)) / 60_000 : 30;
    const warning = await hoursWarning(supabase, shop, start, minutes, d.staff_id);
    if (warning) return { error: `${warning} Press “Move” again to move it anyway.`, values: { ...values, force: forceKey(d) } };
  }

  // The old time frees up, so people waiting for that day may get it.
  const { data: before } = await supabase.from("bookings").select("starts_at").eq("id", d.id).maybeSingle<{ starts_at: string }>();
  const { error } = await supabase.rpc("owner_move_booking", {
    p_booking_id: d.id,
    p_starts_at: start.toISOString(),
    p_staff_id: d.staff_id,
  });
  if (error) {
    return {
      error: bookingError(error.message, "Could not move the booking. Please try again.").replace(
        "Someone just booked that time. Please pick another one.",
        "That person already has a booking then. Pick another time or person.",
      ),
      values,
    };
  }

  const [{ data: booking }, { count: teamSize }, site] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, customer_name, customer_email, services(name, price_cents), staff(name)")
      .eq("id", d.id)
      .maybeSingle<OwnerBookingRow>(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    siteUrl(),
  ]);
  if (booking?.customer_email) after(() => sendShopChangeEmail("moved", booking, shop, teamSize ?? 1, site));
  if (before) after(() => notifyWaitlist(shop.id, before.starts_at, site));
  await flash("moved", "Booking moved", `${booking?.customer_name ?? "The booking"}: now ${shortWhen(d.date, d.time)}.`);
  redirect(`/dashboard/calendar?${d.view === "week" ? "view=week&" : ""}date=${d.date}`);
}
