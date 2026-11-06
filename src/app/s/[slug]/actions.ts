"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { sendBookingEmails } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { fields } from "@/lib/form-data";
import { getCurrentUser } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstError } from "@/lib/validation";
import { checkBookingTicket, clientIp, visitorKey } from "@/lib/visitor";

const bookingSchema = z.object({
  shop_id: z.uuid(),
  service_id: z.uuid(),
  // Empty means "anyone".
  staff_id: z.union([z.uuid(), z.literal("")]).optional(),
  starts_at: z.iso.datetime({ offset: true, error: "Pick a time first." }),
  customer_name: z.string().trim().min(1, "Type your name.").max(80),
  customer_email: z.string().trim().toLowerCase().pipe(z.email("Type a valid email address.")),
  customer_phone: z.string().trim().max(40),
  // A hidden field people never see. Bots that fill in every field get stopped here.
  website: z.string().max(0),
  // When the page was made, signed by the server (see form-guard.ts).
  ticket: z.string().max(100),
});

const TRY_AGAIN = "Please try again.";

export async function bookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = bookingSchema.safeParse({ website: "", customer_phone: "", ticket: "", ...fields(formData) });
  if (!parsed.success) {
    // Bots get the same calm answer as people, so they learn nothing.
    if (parsed.error.issues.some((i) => i.path[0] === "website" || i.path[0] === "ticket")) return { error: TRY_AGAIN };
    return { error: firstError(parsed.error) };
  }
  const d = parsed.data;

  // Robots send the form back the moment the page loads; people take longer.
  const ticket = checkBookingTicket(d.shop_id, d.ticket);
  if (ticket === "too_fast") return { error: "That was very quick. Please check your details and press the button again." };
  if (ticket === "expired") return { error: "This page has been open a long time. Please reload it and try again." };
  if (ticket !== "ok") return { error: TRY_AGAIN };

  // Only the server may book (the database refuses everyone else), so the
  // checks above can't be skipped.
  const admin = createAdminClient();
  if (!admin) {
    console.error("bookAppointment: SUPABASE_SECRET_KEY is not set");
    return { error: "Booking isn’t working right now. Please call the shop." };
  }

  // A limit on tries per visitor, so one person (or robot) can't fill the calendar.
  const visitor = visitorKey(clientIp(await headers()));
  const { data: turn, error: turnError } = await admin.rpc("take_booking_turn", { p_shop_id: d.shop_id, p_visitor: visitor });
  if (turnError) {
    console.error("take_booking_turn failed:", turnError.message);
    return { error: TRY_AGAIN };
  }
  if (turn !== "ok") return { error: bookingError(turn, TRY_AGAIN) };

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
    return { error: bookingError(error?.message, "Could not book that time. Please try again.") };
  }

  // The emails go out after the answer, so the customer never waits for them.
  const site = await siteUrl();
  after(() => sendBookingEmails(data.manage_token, site));

  refresh();
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
