"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { bookingRulesSchema } from "@/lib/booking-rules";
import { fields } from "@/lib/form-data";
import { requireShop } from "@/lib/shop";
import { firstError } from "@/lib/validation";

// Saving the shop's booking rules.
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

export async function saveBookingRules(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const parsed = bookingRulesSchema.safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error), values };

  const { supabase, shop } = await requireShop();
  const { error } = await supabase.from("shops").update(parsed.data).eq("id", shop.id);
  if (error) return { error: "Could not save. Please try again.", values };
  refresh();
  return { message: "Saved. New bookings follow these rules now." };
}
