"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/server";
import { firstError } from "@/lib/validation";

const bookingSchema = z.object({
  shop_id: z.uuid(),
  service_id: z.uuid(),
  starts_at: z.iso.datetime({ offset: true, error: "Pick a time first." }),
  customer_name: z.string().trim().min(1, "Type your name.").max(80),
  customer_email: z.string().trim().toLowerCase().pipe(z.email("Type a valid email address.")),
  customer_phone: z.string().trim().max(40),
  // A hidden field people never see. Bots that fill in every field get stopped here.
  website: z.string().max(0),
});

/** Plain words for the reasons the database can refuse a booking. */
const reasons: Record<string, string> = {
  slot_taken: "Someone just booked that time. Please pick another one.",
  too_soon: "That time is too soon to book online. Please pick a later time.",
  too_far: "That date is too far ahead to book yet.",
  outside_hours: "The shop isn’t open at that time. Please pick another one.",
  closed_then: "The shop is closed then. Please pick another day.",
  too_many: "You already have 3 upcoming bookings here. Please call the shop to book more.",
  service_not_found: "That service isn’t available any more. Please pick another one.",
  shop_not_found: "This shop isn’t taking bookings right now.",
  invalid_details: "Please check your name and email.",
};

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
  const { error } = await supabase.rpc("book_appointment", {
    p_shop_id: d.shop_id,
    p_service_id: d.service_id,
    p_starts_at: d.starts_at,
    p_customer_name: d.customer_name,
    p_customer_email: d.customer_email,
    p_customer_phone: d.customer_phone,
  });

  if (error) {
    refresh(); // show the latest free times next to the message
    return { error: reasons[error.message] ?? "Could not book that time. Please try again." };
  }

  refresh();
  return {
    message: "booked",
    values: { starts_at: d.starts_at, customer_email: d.customer_email, service_id: d.service_id },
  };
}
