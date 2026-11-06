"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { sendCustomerChangeEmails } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { fields } from "@/lib/form-data";
import { reviewSchema } from "@/lib/reviews";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

// The customer's private booking page: cancel, or move to a new time.
// The secret token in the link is the only "login"; the database checks it.

const token = z.string().regex(/^[0-9a-f]{48}$/);
const cancelSchema = z.object({ token });
const moveSchema = z.object({ token, starts_at: z.iso.datetime({ offset: true, error: "Pick a new time first." }) });

export async function cancelMyBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = cancelSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: bookingError("not_found") };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_booking_by_token", { p_token: parsed.data.token });
  if (error) return { error: bookingError(error.message) };

  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(parsed.data.token, "cancelled", site));
  redirect(`/b/${parsed.data.token}?done=cancelled`);
}

export async function moveMyBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = moveSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a new time first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_booking_by_token", {
    p_token: parsed.data.token,
    p_starts_at: parsed.data.starts_at,
  });
  if (error) return { error: bookingError(error.message, "Could not move the booking. Please try again.") };

  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(parsed.data.token, "moved", site));
  redirect(`/b/${parsed.data.token}?done=moved`);
}

/** "Add to My bookings": links this booking to the signed-in account. The secret link is the proof. */
export async function saveToMyBookings(formData: FormData) {
  const parsed = cancelSchema.safeParse(fields(formData));
  if (!parsed.success) redirect("/my");
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_booking_by_token", { p_token: parsed.data.token });
  redirect(`/b/${parsed.data.token}?done=${error ? "not-saved" : "saved"}`);
}

/** "How was it?": writes or changes the review. The secret link is the proof. */
export async function leaveReviewByToken(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = fields(formData);
  const parsed = reviewSchema.safeParse(data);
  const link = token.safeParse(data.token);
  if (!link.success) return { error: bookingError("not_found") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: { body: String(data.body ?? "") } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_review", {
    p_token: link.data,
    p_booking_id: null,
    p_stars: parsed.data.stars,
    p_body: parsed.data.body,
  });
  if (error) return { error: bookingError(error.message), values: { body: parsed.data.body } };
  redirect(`/b/${link.data}?done=reviewed`);
}
