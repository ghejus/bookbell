"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { getMyShop, requireShop } from "@/lib/shop";
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
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id).eq("shop_id", shop.id);
  refresh();
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
