"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { firstError, idSchema, staffSchema } from "@/lib/validation";

// The team: add, rename, turn on or off, remove.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

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
