"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { sendBookingEmails } from "@/lib/booking-emails";
import { bookingError } from "@/lib/booking-errors";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";

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
});

export async function bookAppointment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const values = Object.fromEntries(
    [...formData.entries()].filter(([k]) => !k.startsWith("$")).map(([k, v]) => [k, String(v)]),
  );
  const parsed = bookingSchema.safeParse({ website: "", customer_phone: "", ...values });
  if (!parsed.success) {
    // Bots get the same calm answer as people, so they learn nothing.
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { error: "Please try again." };
    return { error: firstError(parsed.error) };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("book_appointment", {
      p_shop_id: d.shop_id,
      p_service_id: d.service_id,
      p_starts_at: d.starts_at,
      p_customer_name: d.customer_name,
      p_customer_email: d.customer_email,
      p_customer_phone: d.customer_phone,
      p_staff_id: d.staff_id || null,
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
