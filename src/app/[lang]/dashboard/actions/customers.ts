"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { mark } from "@/lib/i18n/owner";
import { firstError } from "@/lib/validation";
import { getActionOwnerT } from "@/lib/i18n/server";

// The owner's private note about a customer.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

const noteSchema = z.object({
  customer_key: z.string().min(3).max(220).regex(/^[enp]:/),
  note: z.string().trim().max(2000, mark("Notes can be up to 2000 characters.")),
});

export async function saveCustomerNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const o = await getActionOwnerT();
  const values = fields(formData);
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error, o), values };
  const { customer_key, note } = parsed.data;

  const { supabase, shop } = await requireShop();
  const { error } = note
    ? await supabase
        .from("customer_notes")
        .upsert({ shop_id: shop.id, customer_key, note, updated_at: new Date().toISOString() }, { onConflict: "shop_id,customer_key" })
    : await supabase.from("customer_notes").delete().eq("shop_id", shop.id).eq("customer_key", customer_key);
  if (error) return { error: o("Could not save the note. Please try again."), values };
  refresh();
  return { message: note ? o("Note saved.") : o("Note removed.") };
}
