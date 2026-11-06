"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { firstError, idSchema, shopInfoSchema } from "@/lib/validation";

// Notes for the chat helper (questions and answers).
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

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
