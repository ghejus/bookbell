import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoWeekday } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";

// "Try a demo shop": every visitor gets their own sample shop under a
// no-email (anonymous) Supabase account, so nobody sees anyone else's changes.
// It is made with the visitor's own login, so the usual database locks apply.

const TZ = "Europe/Bucharest";

const SERVICES = [
  { name: "Haircut", duration_minutes: 30, price_cents: 2500 },
  { name: "Haircut and beard", duration_minutes: 45, price_cents: 3500 },
  { name: "Kids haircut (under 12)", duration_minutes: 20, price_cents: 1500 },
  { name: "Beard trim", duration_minutes: 15, price_cents: 1200 },
];

const NOTES = [
  { question: "Is there parking?", answer: "Yes, free parking behind the shop for 30 minutes." },
  { question: "Can I pay by card?", answer: "Yes, cash and card are both fine." },
  { question: "Do you cut kids' hair?", answer: "Yes, for children of any age. Under 12s book the Kids haircut." },
  { question: "Can I walk in without booking?", answer: "If a chair is free, yes. Booking online is the surest way to get a time." },
];

const CUSTOMERS = [
  { name: "Ana Popescu", email: "ana.popescu@example.com", phone: "+40 700 111 222", service: 0, time: "10:00" },
  { name: "Mihai Ionescu", email: "mihai@example.com", phone: "", service: 1, time: "15:30" },
  { name: "Elena Dumitru", email: "elena.d@example.com", phone: "+40 700 333 444", service: 2, time: "11:00" },
];

/** Makes the sample shop for this demo visitor, unless they already have a shop. */
export async function createDemoShop(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  if (existing) return;

  const { data: shop, error } = await supabase
    .from("shops")
    .insert({
      name: "Demo Barber Shop",
      slug: `demo-${randomBytes(4).toString("hex")}`,
      timezone: TZ,
      currency: "EUR",
      about: "This is your own demo shop. Change anything you like, try booking a time, or ask the chat helper a question. Nobody else sees your changes.",
      address: "Strada Exemplu 1, București",
      phone: "+40 700 000 000",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not make the demo shop: ${error.message}`);

  const shopId = shop.id as string;
  const { data: services } = await supabase
    .from("services")
    .insert(SERVICES.map((s) => ({ ...s, shop_id: shopId })))
    .select("id, name");

  // Monday to Friday with a lunch break, and Saturday mornings.
  const hours = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { shop_id: shopId, weekday, opens: "09:00", closes: "13:00" },
    { shop_id: shopId, weekday, opens: "14:00", closes: "18:00" },
  ]);
  hours.push({ shop_id: shopId, weekday: 6, opens: "10:00", closes: "14:00" });
  await Promise.all([
    supabase.from("opening_hours").insert(hours),
    supabase.from("shop_info").insert(NOTES.map((n) => ({ ...n, shop_id: shopId }))),
  ]);

  // A few bookings on the next weekdays, made through the same checks as real ones.
  const ids = (services ?? []).map((s) => s.id as string);
  let day = addDays(utcToZoned(new Date(), TZ).date, 1);
  for (const c of CUSTOMERS) {
    while (isoWeekday(day) > 5) day = addDays(day, 1);
    await supabase.rpc("book_appointment", {
      p_shop_id: shopId,
      p_service_id: ids[c.service],
      p_starts_at: zonedToUtc(day, c.time, TZ).toISOString(),
      p_customer_name: c.name,
      p_customer_email: c.email,
      p_customer_phone: c.phone,
    });
    day = addDays(day, 1);
  }
}
