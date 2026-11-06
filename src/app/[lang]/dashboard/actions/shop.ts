"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { getMyShop } from "@/lib/shop";
import { firstError, shopSchema } from "@/lib/validation";
import { FIRST_WORKER } from "@/lib/i18n/config";
import { getActionOwnerT } from "@/lib/i18n/server";

// Saving the shop's profile.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

export async function saveShop(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const o = await getActionOwnerT();
  const values = fields(formData);
  const parsed = shopSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error, o), values };

  const { supabase, shop } = await getMyShop();
  const { data: made, error } = shop
    ? { ...(await supabase.from("shops").update(parsed.data).eq("id", shop.id)), data: null }
    : await supabase.from("shops").insert({ ...parsed.data, lang: o.lang }).select("id").single();

  // The database names a new shop's first worker "Me"; say it in the owner's language.
  if (!shop && made && o.lang !== "en") {
    await supabase.from("staff").update({ name: FIRST_WORKER[o.lang] }).eq("shop_id", made.id).eq("name", FIRST_WORKER.en);
  }

  if (error) {
    if (error.code === "23505") {
      return { error: error.message.includes("slug") ? o("That web address is taken. Try another one.") : o("You already have a shop."), values };
    }
    return { error: o("Could not save. Please try again."), values };
  }
  // A brand-new shop goes back to the top of the dashboard, where the setup
  // checklist (now one step done) shows what to do next.
  if (!shop) redirect("/dashboard");
  refresh();
  return { message: o("Saved.") };
}
