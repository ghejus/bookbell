"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { sendShopChangeEmail, type OwnerBookingRow } from "@/lib/booking-emails";
import { emailMode } from "@/lib/email/send";
import { flash } from "@/lib/flash";
import { siteUrl } from "@/lib/site";
import { requireShop } from "@/lib/shop";
import { idSchema } from "@/lib/validation";

// Cancelling a booking, and marking a visit as "didn't come".
// Every action checks who is logged in and which shop they own. The database
// locks (RLS) check again, so a trick request still can't touch another shop.

/** Where to go after cancelling: only a dashboard page of this site. */
const backTo = (v: FormDataEntryValue | null) =>
  typeof v === "string" && /^\/dashboard(\/[a-z]+)?(\?[\w=&%.-]*)?$/.test(v) ? v : null;

export async function cancelBooking(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const back = backTo(formData.get("back"));
  const { supabase, shop } = await requireShop();
  // Only a live booking changes, and we get it back to tell the customer.
  const { data: booking } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .eq("status", "booked")
    .select("id, starts_at, ends_at, customer_name, customer_email, services(name, price_cents), staff(name)")
    .maybeSingle<OwnerBookingRow>();
  if (booking) {
    const when = new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    await flash("cancelled", "Booking cancelled", `${booking.customer_name}, ${when.format(new Date(booking.starts_at))}.${booking.customer_email && emailMode() === "gmail" ? " We emailed them." : " Please let them know."}`);
  }
  if (booking && Date.parse(booking.starts_at) >= Date.now()) {
    const [{ count: teamSize }, site] = await Promise.all([
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
      siteUrl(),
    ]);
    after(() => sendShopChangeEmail("cancelled", booking, shop, teamSize ?? 1, site));
  }
  if (back) redirect(back);
  refresh();
}

/** "Didn't come": only for a live booking that has already started. */
export async function markNoShow(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const back = backTo(formData.get("back"));
  const { supabase, shop } = await requireShop();
  const { data: booking } = await supabase
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .eq("status", "booked")
    .lte("starts_at", new Date().toISOString())
    .select("customer_name")
    .maybeSingle<{ customer_name: string }>();
  if (booking) await flash("saved", "Marked as didn’t come", `${booking.customer_name}. You’ll see it in their visits.`);
  if (back) redirect(back);
  refresh();
}

/** Undo "didn't come": the booking counts as a visit again. */
export async function undoNoShow(formData: FormData) {
  const id = idSchema.parse(formData.get("id"));
  const back = backTo(formData.get("back"));
  const { supabase, shop } = await requireShop();
  const { data: booking, error } = await supabase
    .from("bookings")
    .update({ status: "booked" })
    .eq("id", id)
    .eq("shop_id", shop.id)
    .eq("status", "no_show")
    .select("customer_name")
    .maybeSingle<{ customer_name: string }>();
  if (error?.code === "23P01") {
    // Someone else was put in that time since.
    await flash("cancelled", "Couldn’t undo", "Another booking now sits at that time with the same person.");
  } else if (booking) {
    await flash("saved", "Counted as a visit again", booking.customer_name);
  }
  if (back) redirect(back);
  refresh();
}
