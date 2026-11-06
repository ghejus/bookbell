"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { bookingByToken, sendCustomerChangeEmails } from "@/lib/booking-emails";
import type { ActionState } from "@/lib/action-state";
import { errorText } from "@/lib/i18n/dict";
import { actionLang, getActionT } from "@/lib/i18n/server";
import { flash } from "@/lib/flash";
import { fields } from "@/lib/form-data";
import { reviewSchemaFor } from "@/lib/reviews";
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
  if (error || typeof token !== "string") throw new Error(errorText(await actionLang(), error?.message ?? "not_found"));
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
  const lang = await actionLang();
  const t = await getActionT();
  const { error } = await supabase.rpc("cancel_booking_by_token", { p_token: token });
  if (error) {
    await flash("cancelled", t.my.couldNotCancel, errorText(lang, error.message));
    refresh();
    return;
  }
  const site = await siteUrl();
  after(() => sendCustomerChangeEmails(token, "cancelled", site));
  if (before) after(() => notifyWaitlist(before.shop_id, before.starts_at, site));
  await flash("cancelled", t.my.cancelledTitle, t.my.cancelledText);
  refresh();
}

/** "How was it?" from the Past list: writes or changes the review of one of your own visits. */
export async function leaveMyReview(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const data = fields(formData);
  const lang = await actionLang();
  const t = await getActionT();
  const id = idSchema.safeParse(data.id);
  const parsed = reviewSchemaFor(t).safeParse(data);
  if (!id.success) return { error: errorText(lang, "not_found") };
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, values: { body: data.body ?? "" } };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_review", {
    p_token: null,
    p_booking_id: id.data,
    p_stars: parsed.data.stars,
    p_body: parsed.data.body,
  });
  if (error) return { error: errorText(lang, error.message), values: { body: parsed.data.body } };
  await flash("saved", t.reviews.thanks, t.reviews.thanksText);
  redirect("/my");
}

/** Leaves one waitlist (the database only lets people remove their own). */
export async function leaveMyWait(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const { supabase } = await requireUser();
  await supabase.from("waitlist").delete().eq("id", id);
  await flash("cancelled", (await getActionT()).waitlist.left);
  refresh();
}
