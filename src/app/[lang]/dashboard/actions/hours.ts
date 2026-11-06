"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { firstError, idSchema, openingHoursSchema, timeOffSchema } from "@/lib/validation";

// Opening hours and days off.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

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

// Days off

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
