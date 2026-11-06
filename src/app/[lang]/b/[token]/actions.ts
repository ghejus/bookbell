"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { bookingByToken, sendCustomerChangeEmails } from "@/lib/booking-emails";
import { errorText } from "@/lib/i18n/dict";
import { actionLang, getActionT } from "@/lib/i18n/server";
import { fields } from "@/lib/form-data";
import { reviewSchemaFor } from "@/lib/reviews";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { notifyWaitlist } from "@/lib/waitlist";

// The customer's private booking page: cancel, or move to a new time.
// The secret token in the link is the only "login"; the database checks it.

const token = z.string().regex(/^[0-9a-f]{48}$/);
const cancelSchema = z.object({ token });
const moveSchema = z.object({ token, starts_at: z.iso.datetime({ offset: true }) });

export async function cancelMyBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const lang = await actionLang();
  const parsed = cancelSchema.safeParse(fields(formData));
  if (!parsed.success) return { error: errorText(lang, "not_found") };
  const supabase = await createClient();
  const before = await bookingByToken(parsed.data.token);
  const { error } = await supabase.rpc("cancel_booking_by_token", { p_token: parsed.data.token });
  if (error) return { error: errorText(lang, error.message) };

  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(parsed.data.token, "cancelled", site));
  if (before) after(() => notifyWaitlist(before.shop_id, before.starts_at, site));
  redirect(`/b/${parsed.data.token}?done=cancelled`);
}

export async function moveMyBooking(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = moveSchema.safeParse(fields(formData));
  const lang = await actionLang();
  if (!parsed.success) return { error: (await getActionT()).manage.chooseNewTime };
  const supabase = await createClient();
  const before = await bookingByToken(parsed.data.token);
  const { error } = await supabase.rpc("reschedule_booking_by_token", {
    p_token: parsed.data.token,
    p_starts_at: parsed.data.starts_at,
  });
  if (error) return { error: errorText(lang, error.message, (await getActionT()).manage.moveFailed) };

  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(parsed.data.token, "moved", site));
  if (before) after(() => notifyWaitlist(before.shop_id, before.starts_at, site));
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
  const lang = await actionLang();
  const parsed = reviewSchemaFor(await getActionT()).safeParse(data);
  const link = token.safeParse(data.token);
  if (!link.success) return { error: errorText(lang, "not_found") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: { body: String(data.body ?? "") } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_review", {
    p_token: link.data,
    p_booking_id: null,
    p_stars: parsed.data.stars,
    p_body: parsed.data.body,
  });
  if (error) return { error: errorText(lang, error.message), values: { body: parsed.data.body } };
  redirect(`/b/${link.data}?done=reviewed`);
}
