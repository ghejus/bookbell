"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { bookingByToken, sendCustomerChangeEmails } from "@/lib/booking-emails";
import type { ActionState } from "@/lib/action-state";
import { bookingError } from "@/lib/booking-errors";
import { flash } from "@/lib/flash";
import { fields } from "@/lib/form-data";
import { reviewSchema } from "@/lib/reviews";
import { requireUser } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { idSchema } from "@/lib/validation";
import { notifyWaitlist } from "@/lib/waitlist";

// My bookings: "Change time" and "Cancel". Both get a fresh secret link for
// the customer's own booking (the database checks it is theirs), then use the
// same rules, page and emails as the link in the confirmation email.

async function linkFor(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase } = await requireUser();
  const { data: token, error } = await supabase.rpc("my_booking_link", { p_booking_id: id });
  if (error || typeof token !== "string") throw new Error(bookingError(error?.message ?? "not_found"));
  return { supabase, token };
}

/** Opens the booking's own page, where the customer picks a new time. */
export async function changeMyBooking(formData: FormData) {
  const { token } = await linkFor(formData);
  redirect(`/b/${token}?move=1`);
}

export async function cancelFromMyBookings(formData: FormData) {
  const { supabase, token } = await linkFor(formData);
  const before = await bookingByToken(token);
  const { error } = await supabase.rpc("cancel_booking_by_token", { p_token: token });
  if (error) {
    await flash("cancelled", "Could not cancel", bookingError(error.message));
    refresh();
    return;
  }
  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(token, "cancelled", site));
  if (before) after(() => notifyWaitlist(before.shop_id, before.starts_at, site));
  await flash("cancelled", "Booking cancelled", "The time is free for others now.");
  refresh();
}

/** "How was it?" from the Past list: writes or changes the review of one of your own visits. */
export async function leaveMyReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = fields(formData);
  const id = idSchema.safeParse(data.id);
  const parsed = reviewSchema.safeParse(data);
  if (!id.success) return { error: bookingError("not_found") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: { body: data.body ?? "" } };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_review", {
    p_token: null,
    p_booking_id: id.data,
    p_stars: parsed.data.stars,
    p_body: parsed.data.body,
  });
  if (error) return { error: bookingError(error.message), values: { body: parsed.data.body } };
  await flash("saved", "Thank you!", "Your review is on the shop’s page now.");
  redirect("/my");
}

/** Leaves one waitlist (the database only lets people remove their own). */
export async function leaveMyWait(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase } = await requireUser();
  await supabase.from("waitlist").delete().eq("id", id);
  await flash("cancelled", "Left the waitlist");
  refresh();
}
