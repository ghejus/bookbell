"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { firstError, idSchema, serviceSchema } from "@/lib/validation";
import { getActionOwnerT } from "@/lib/i18n/server";

// Services: add, show or hide, delete.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

export async function addService(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const o = await getActionOwnerT();
  const parsed = serviceSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: firstError(parsed.error, o) };

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("services").insert({ ...parsed.data, shop_id: shop.id });
  if (error) return { error: o("Could not add the service. Please try again.") };
  refresh();
  return { message: o("Added “{name}”.", { name: parsed.data.name }) };
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
