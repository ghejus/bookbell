"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { sendBookingEmails } from "@/lib/booking-emails";
import { actionLang } from "@/lib/i18n/server";
import { dictFor, errorText, type Dict } from "@/lib/i18n/dict";
import { fields } from "@/lib/form-data";
import { getCurrentUser } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ownerT } from "@/lib/i18n/owner";
import { firstError } from "@/lib/validation";
import { checkBookingTicket, clientIp, visitorKey } from "@/lib/visitor";

const bookingSchema = (t: Dict) =>
  z.object({
  shop_id: z.uuid(),
  service_id: z.uuid(),
  // Empty means "anyone".
  staff_id: z.union([z.uuid(), z.literal("")]).optional(),
  starts_at: z.iso.datetime({ offset: true, error: t.book.errors.pickTime }),
  customer_name: z.string().trim().min(1, t.book.errors.typeName).max(80),
  customer_email: z.string().trim().toLowerCase().pipe(z.email(t.book.errors.validEmail)),
  customer_phone: z.string().trim().max(40),
  // A hidden field people never see. Bots that fill in every field get stopped here.
  website: z.string().max(0),
  // When the page was made, signed by the server (see form-guard.ts).
  ticket: z.string().max(100),
});

export async function bookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const lang = await actionLang();
  const t = dictFor(lang);
  const TRY_AGAIN = t.book.errors.again;
  const parsed = bookingSchema(t).safeParse({ website: "", customer_phone: "", ticket: "", ...fields(formData) });
  if (!parsed.success) {
    // Bots get the same calm answer as people, so they learn nothing.
    if (parsed.error.issues.some((i) => i.path[0] === "website" || i.path[0] === "ticket")) return { error: TRY_AGAIN };
    return { error: firstError(parsed.error, ownerT(lang)) };
  }
  const d = parsed.data;

  // Robots send the form back the moment the page loads; people take longer.
  const ticket = checkBookingTicket(d.shop_id, d.ticket);
  if (ticket === "too_fast") return { error: t.book.errors.tooFast };
  if (ticket === "expired") return { error: t.book.errors.expired };
  if (ticket !== "ok") return { error: TRY_AGAIN };

  // Only the server may book (the database refuses everyone else), so the
  // checks above can't be skipped.
  const admin = createAdminClient();
  if (!admin) {
    console.error("bookAppointment: SUPABASE_SECRET_KEY is not set");
    return { error: t.book.errors.notWorking };
  }

  // A limit on tries per visitor, so one person (or robot) can't fill the calendar.
  const visitor = visitorKey(clientIp(await headers()));
  const { data: turn, error: turnError } = await admin.rpc("take_booking_turn", { p_shop_id: d.shop_id, p_visitor: visitor });
  if (turnError) {
    console.error("take_booking_turn failed:", turnError.message);
    return { error: TRY_AGAIN };
  }
  if (turn !== "ok") return { error: errorText(lang, turn, TRY_AGAIN) };

  const user = await getCurrentUser();
  const { data, error } = await admin
    .rpc("book_appointment", {
      p_shop_id: d.shop_id,
      p_service_id: d.service_id,
      p_starts_at: d.starts_at,
      p_customer_name: d.customer_name,
      p_customer_email: d.customer_email,
      p_customer_phone: d.customer_phone,
      p_staff_id: d.staff_id || null,
      p_customer_id: user?.userId ?? null,
    })
    .single<{ booking_id: string; manage_token: string }>();

  if (error || !data) {
    refresh(); // show the latest free times next to the message
    return { error: errorText(lang, error?.message, t.book.errors.tryAgain) };
  }

  // Emails about this booking go out in the customer's language.
  await admin.from("bookings").update({ lang }).eq("id", data.booking_id);

  // The emails go out after the answer, so the customer never waits for them.
  const site = await siteUrl();
  after(() => sendBookingEmails(data.manage_token, site));

  // No refresh here: the receipt lives in the booking form, and a fresh page
  // could drop that form (when this was the day's last free time). "Book
  // another time" loads fresh times anyway.
  return {
    message: "booked",
    values: {
      starts_at: d.starts_at,
      customer_email: d.customer_email,
      service_id: d.service_id,
      manage_path: `/b/${data.manage_token}`,
    },
  };
}

const waitSchema = (t: Dict) =>
  z.object({
  service_id: z.uuid(),
  staff_id: z.union([z.uuid(), z.literal("")]).optional(),
  day: z.iso.date(),
  phone: z.string().trim().max(40, t.waitlist.phoneTooLong).optional().default(""),
});

/** "Tell me if a time opens": puts the signed-in customer on the waitlist for that day. */
export async function joinWaitlist(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = fields(formData);
  const lang = await actionLang();
  const t = dictFor(lang);
  const parsed = waitSchema(t).safeParse(values);
  if (!parsed.success) return { error: firstError(parsed.error, ownerT(lang)), values };
  const user = await getCurrentUser();
  if (!user) return { error: errorText(lang, "not_signed_in"), values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_waitlist", {
    p_service_id: parsed.data.service_id,
    p_staff_id: parsed.data.staff_id || null,
    p_day: parsed.data.day,
    p_phone: parsed.data.phone,
    p_lang: lang,
  });
  if (error) return { error: errorText(lang, error.message), values };
  refresh();
  return { message: t.waitlist.joined };
}

/** Leaves the waitlist (the database only lets people remove their own wishes). */
export async function leaveWaitlist(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("waitlist").delete().eq("id", id.data);
  refresh();
}
