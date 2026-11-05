import "server-only";
import type { Currency } from "@/lib/format";
import { requireUser } from "@/lib/shop";

export type MyBooking = {
  booking_id: string;
  status: "booked" | "cancelled";
  starts_at: string;
  ends_at: string;
  service_name: string;
  price_cents: number | null;
  staff_name: string;
  team_size: number;
  shop_slug: string;
  shop_name: string;
  shop_address: string;
  shop_timezone: string;
  shop_currency: Currency;
};

/** The signed-in person's bookings at every shop, oldest first. */
export async function myBookings() {
  const { supabase, userId } = await requireUser();
  const { data, error } = await supabase.rpc("my_bookings");
  if (error) throw new Error(`Could not load your bookings: ${error.message}`);
  return { supabase, userId, bookings: (data ?? []) as MyBooking[] };
}
