"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { ActionState } from "@/lib/action-state";
import { z } from "zod";
import { sendBookingEmails, sendShopChangeEmail, type OwnerBookingRow } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { siteUrl } from "@/lib/site";
import { getMyShop, requireShop, type Shop } from "@/lib/shop";
import { isoWeekday } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import {
  firstError,
  idSchema,
  openingHoursSchema,
  serviceSchema,
  shopInfoSchema,
  shopSchema,
  staffSchema,
  timeOffSchema,
} from "@/lib/validation";

// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

const fields = (formData: FormData) =>
  Object.fromEntries([...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]));

// ------------------------------------------------------------------- shop

export async function saveShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const parsed = shopSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase, shop } = await getMyShop();
  const { error } = shop
    ? await supabase.from("shops").update(parsed.data).eq("id", shop.id)
    : await supabase.from("shops").insert(parsed.data);

  if (error) {
    if (error.code === "23505") {
      return { error: error.message.includes("slug") ? "That web address is taken. Try another one." : "You already have a shop.", values };
    }
    return { error: "Could not save. Please try again.", values };
  }
  // A brand-new shop goes back to the top of the dashboard, where the setup
  // checklist (now one step done) shows what to do next.
  if (!shop) redirect("/dashboard");
  refresh();
  return { message: "Saved." };
}

// --------------------------------------------------------------- services

export async function addService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = serviceSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("services").insert({ ...parsed.data, shop_id: shop.id });
  if (error) return { error: "Could not add the service. Please try again." };
  refresh();
  return { message: `Added “${parsed.data.name}”.` };
}

export async function toggleService(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const { supabase, shop } = await requireShop();
  await supabase.from("services").update({ active: !active }).eq("id", id).eq("shop_id", shop.id);
  refresh();
}

export async function deleteService(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("services").delete().eq("id", id).eq("shop_id", shop.id);
  // A service that already has bookings can't be deleted, so we turn it off instead.
  if (error?.code === "23503") {
    await supabase.from("services").update({ active: false }).eq("id", id).eq("shop_id", shop.id);
  }
  refresh();
}

// ---------------------------------------------------------- opening hours

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export async function addOpeningHours(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = openingHoursSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { weekday, opens, closes } = parsed.data;

  const { supabase, shop } = await requireShop();
  const { data: sameDay } = await supabase
    .from("opening_hours")
    .select("opens, closes")
    .eq("shop_id", shop.id)
    .eq("weekday", weekday);

  const overlaps = (sameDay ?? []).some(
    (r) => toMinutes(opens) < toMinutes(r.closes) && toMinutes(r.opens) < toMinutes(closes),
  );
  if (overlaps) return { error: "Those hours overlap hours you already set for that day." };

  const { error } = await supabase.from("opening_hours").insert({ shop_id: shop.id, weekday, opens, closes });
  if (error) return { error: "Could not save those hours. Please try again." };
  refresh();
  return { message: "Hours added." };
}

/** Quick start: Monday to Friday, 09:00 to 17:00, for days that have no hours yet. */
export async function addStandardWeek() {
  const { supabase, shop } = await requireShop();
  const { data: existing } = await supabase.from("opening_hours").select("weekday").eq("shop_id", shop.id);
  const taken = new Set((existing ?? []).map((r) => r.weekday));
  const rows = [1, 2, 3, 4, 5]
    .filter((d) => !taken.has(d))
    .map((weekday) => ({ shop_id: shop.id, weekday, opens: "09:00", closes: "17:00" }));
  if (rows.length) await supabase.from("opening_hours").insert(rows);
  refresh();
}

export async function deleteOpeningHours(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  await supabase.from("opening_hours").delete().eq("id", id).eq("shop_id", shop.id);
  refresh();
}

// --------------------------------------------------------------- time off

export async function addTimeOff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, shop } = await requireShop();
  const parsed = timeOffSchema(shop.timezone).safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { error } = await supabase.from("time_off").insert({
    shop_id: shop.id,
    starts_at: parsed.data.starts_at.toISOString(),
    ends_at: parsed.data.ends_at.toISOString(),
    reason: parsed.data.reason,
    staff_id: parsed.data.staff_id,
  });
  if (error) return { error: "Could not save the time off. Please try again." };
  refresh();
  return { message: "Time off added." };
}

export async function deleteTimeOff(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  await supabase.from("time_off").delete().eq("id", id).eq("shop_id", shop.id);
  refresh();
}

// ------------------------------------------------------------------ team

export async function addStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = staffSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("staff").insert({ name: parsed.data.name, shop_id: shop.id });
  if (error) return { error: "Could not add them. Please try again." };
  refresh();
  return { message: `Added ${parsed.data.name}.` };
}

export async function renameStaff(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const parsed = staffSchema.safeParse(fields(formData));
  if (!parsed.success) return;
  const { supabase, shop } = await requireShop();
  await supabase.from("staff").update({ name: parsed.data.name }).eq("id", id).eq("shop_id", shop.id);
  refresh();
}

/** How many workers are taking bookings. The last one can't be turned off or removed. */
async function activeStaffCount(supabase: Awaited<ReturnType<typeof requireShop>>["supabase"], shopId: string) {
  const { count } = await supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("active", true);
  return count ?? 0;
}

export async function toggleStaff(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const active = formData.get("active") === "true";
  const { supabase, shop } = await requireShop();
  if (active && (await activeStaffCount(supabase, shop.id)) <= 1) return;
  await supabase.from("staff").update({ active: !active }).eq("id", id).eq("shop_id", shop.id);
  refresh();
}

export async function deleteStaff(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  const { data: worker } = await supabase.from("staff").select("active").eq("id", id).eq("shop_id", shop.id).maybeSingle();
  if (!worker) return;
  if (worker.active && (await activeStaffCount(supabase, shop.id)) <= 1) return;
  const { error } = await supabase.from("staff").delete().eq("id", id).eq("shop_id", shop.id);
  // Someone with bookings (past or future) can't be deleted, so we turn them off instead.
  if (error?.code === "23503") {
    await supabase.from("staff").update({ active: false }).eq("id", id).eq("shop_id", shop.id);
  }
  refresh();
}

// --------------------------------------------------------------- bookings

export async function cancelBooking(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  // Only a live booking changes, and we get it back to tell the customer.
  const { data: booking } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .eq("status", "booked")
    .select("id, starts_at, ends_at, customer_name, customer_email, services(name, price_cents), staff(name)")
    .maybeSingle<OwnerBookingRow>();
  refresh();
  if (!booking || Date.parse(booking.starts_at) < Date.now()) return;

  const [{ count: teamSize }, site] = await Promise.all([
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    siteUrl(),
  ]);
  after(() => sendShopChangeEmail("cancelled", booking, shop, teamSize ?? 1, site));
}

// --------------------------------------------------- shop info (AI notes)

export async function addShopInfo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = shopInfoSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("shop_info").insert({ ...parsed.data, shop_id: shop.id });
  if (error) return { error: "Could not save the note. Please try again." };
  refresh();
  return { message: "Note saved." };
}

export async function deleteShopInfo(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  await supabase.from("shop_info").delete().eq("id", id).eq("shop_id", shop.id);
  refresh();
}

// ----------------------------------------------------- calendar (owner)

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
  redirect(`/dashboard/calendar?view=${d.view}&date=${d.date}&b=${data.booking_id}`);
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
  redirect(`/dashboard/calendar?view=${d.view}&date=${d.date}&b=${d.id}`);
}
