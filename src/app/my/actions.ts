"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendCustomerChangeEmails } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { flash } from "@/lib/flash";
import { requireUser } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { idSchema } from "@/lib/validation";

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
  const { error } = await supabase.rpc("cancel_booking_by_token", { p_token: token });
  if (error) {
    await flash("cancelled", "Could not cancel", bookingError(error.message));
    refresh();
    return;
  }
  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(token, "cancelled", site));
  await flash("cancelled", "Booking cancelled", "The time is free for others now.");
  refresh();
}
