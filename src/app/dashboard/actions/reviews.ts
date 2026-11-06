"use server";

import { refresh } from "next/cache";
import type { ActionState } from "@/lib/action-state";
import { bookingError } from "@/lib/booking-errors";
import { fields } from "@/lib/form-data";
import { replySchema } from "@/lib/reviews";
import { requireShop } from "@/lib/shop";

// The owner's public reply under a review. Owners can't delete or hide reviews.
// The database checks the review belongs to the owner's own shop.

export async function replyToReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const parsed = replySchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please try again.", values };
  const { supabase } = await requireShop();
  const { error } = await supabase.rpc("reply_to_review", { p_review_id: parsed.data.id, p_reply: parsed.data.reply });
  if (error) return { error: bookingError(error.message, "Could not save the reply. Please try again."), values };
  refresh();
  return { message: parsed.data.reply ? "Reply posted. Everyone can see it under the review." : "Reply removed." };
}
