"use server";

import { refresh } from "next/cache";
import { flash } from "@/lib/flash";
import { requireShop } from "@/lib/shop";
import { idSchema } from "@/lib/validation";
import { getActionOwnerT } from "@/lib/i18n/server";

// The owner takes someone off the waitlist (for example after calling them).
// The database only lets owners remove their own shop's wishes.

export async function removeFromWaitlist(formData: FormData) {
  const o = await getActionOwnerT();
  const id = idSchema.parse(formData.get("id"));
  const { supabase, shop } = await requireShop();
  const { data } = await supabase.from("waitlist").delete().eq("id", id).eq("shop_id", shop.id).select("name").maybeSingle<{ name: string }>();
  if (data) await flash("cancelled", o("Removed from the waitlist"), data.name || "");
  refresh();
}
