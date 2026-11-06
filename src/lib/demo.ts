import "server-only";
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, isoWeekday } from "@/lib/slots";
import { reviewAuthor } from "@/lib/reviews";
import { createAdminClient } from "@/lib/supabase/admin";
import { utcToZoned, zonedToUtc } from "@/lib/time";

// "Try a demo shop": every visitor gets their own sample shop under a
// no-email (anonymous) Supabase account, so nobody sees anyone else's changes.
// It is made with the visitor's own login, so the usual database locks apply.
// Only the online bookings go through the server's key, because only the
// server may call book_appointment; they still pass all its checks.

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

// Two barbers. The shop's first worker ("Me") becomes Andrei, then Maria is added.
const TEAM = ["Andrei", "Maria"];

// `day` counts weekdays from tomorrow; `staff` points into TEAM. Ana and Radu
// share a time with different barbers, to show two people booked at once.
const CUSTOMERS = [
  { name: "Ana Popescu", email: "ana.popescu@example.com", phone: "+40 700 111 222", service: 0, time: "10:00", day: 0, staff: 0 },
  { name: "Radu Marin", email: "radu.marin@example.com", phone: "", service: 3, time: "10:00", day: 0, staff: 1 },
  { name: "Mihai Ionescu", email: "mihai@example.com", phone: "", service: 1, time: "15:30", day: 1, staff: 0 },
  { name: "Elena Dumitru", email: "elena.d@example.com", phone: "+40 700 333 444", service: 2, time: "11:00", day: 2, staff: 1 },
];

// Regular customers for the visits that already happened, so the calendar,
// the "Past" list and the Customers page have a real history to show.
const REGULARS = [
  { name: "Ioana Stan", email: "ioana.stan@example.com", phone: "" },
  { name: "George Vasile", email: "george.v@example.com", phone: "+40 700 555 666" },
  { name: "Ana Popescu", email: "ana.popescu@example.com", phone: "+40 700 111 222" },
  { name: "Daria Munteanu", email: "daria.m@example.com", phone: "+40 700 888 999" },
  { name: "Mihai Ionescu", email: "mihai@example.com", phone: "" },
  { name: "Victor Enache", email: "victor.enache@example.com", phone: "" },
  { name: "Bianca Rusu", email: "bianca.rusu@example.com", phone: "+40 700 123 456" },
];
const HISTORY_DAYS = 25; // weekdays back from yesterday, about five weeks
const HISTORY_TIMES = ["09:30", "11:00", "13:30", "15:00", "16:30"];
// Which visits in the history the customer missed (by day).
const MISSED_ON_DAY = [4, 13];

// The demo pictures, in the shared "demo/" folder of the shop-media bucket.
const DEMO_LOGO = "demo/logo.webp";
const DEMO_PHOTOS = ["demo/storefront.webp", "demo/interior.webp", "demo/haircut.webp", "demo/tools.webp"];

// The owner's private notes about two regulars.
const CUSTOMER_NOTES = [
  { email: "ioana.stan@example.com", note: "Likes it short on the sides, longer on top." },
  { email: "george.v@example.com", note: "Prefers Andrei. Pays by card." },
];

// Reviews of past visits (newest visit first), so the shop page, the Reviews
// page and the Shop screen have something to show. One gets a reply.
const DEMO_REVIEWS = [
  { stars: 5, body: "Quick, friendly and exactly what I asked for. Booking took ten seconds." },
  { stars: 5, body: "Really know what they’re doing. Will be back.", reply: "Thank you, see you next time!" },
  { stars: 4, body: "Good work. I waited about five minutes, but the coffee helped." },
  { stars: 5, body: "" },
  { stars: 3, body: "The cut was fine, but it felt a bit rushed at the end.", reply: "Sorry about that. Next time tell us and we’ll take our time." },
  { stars: 5, body: "Best barber in the area. Easy to book a time online." },
  { stars: 4, body: "Nice place, good music, fair price." },
  { stars: 5, body: "Always on time. Love that I can move my booking myself." },
];

// Today's visits, so the Today screen has a "Next up" and a full day to show.
// Depending on the time of the visit, some are already done.
const TODAY = [
  { name: "Sofia Ilie", email: "sofia.ilie@example.com", phone: "+40 700 222 333", service: 0, time: "09:30", staff: 0 },
  { name: "Walk-in", email: "", phone: "", service: 3, time: "10:00", staff: 1 },
  { name: "Matei Pavel", email: "matei.pavel@example.com", phone: "+40 700 444 555", service: 1, time: "11:00", staff: 0 },
  { name: "Clara Neagu", email: "clara.neagu@example.com", phone: "", service: 2, time: "12:00", staff: 1 },
  { name: "Paul Dragomir", email: "paul.d@example.com", phone: "+40 700 666 777", service: 0, time: "14:30", staff: 0 },
  { name: "Irina Costea", email: "irina.costea@example.com", phone: "", service: 1, time: "16:00", staff: 1 },
  { name: "Luca Barbu", email: "luca.barbu@example.com", phone: "", service: 0, time: "17:00", staff: 0 },
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

  // The team: the database already added a first worker, which gets a real name.
  const { data: first } = await supabase.from("staff").select("id").eq("shop_id", shopId).limit(1).single();
  if (first) await supabase.from("staff").update({ name: TEAM[0] }).eq("id", first.id);
  const { data: second } = await supabase.from("staff").insert({ shop_id: shopId, name: TEAM[1] }).select("id").single();
  const staffIds = [first?.id, second?.id] as (string | undefined)[];

  // The next weekdays, starting tomorrow.
  const weekdays: string[] = [];
  for (let day = addDays(utcToZoned(new Date(), TZ).date, 1); weekdays.length < 3; day = addDays(day, 1)) {
    if (isoWeekday(day) <= 5) weekdays.push(day);
  }

  // A few bookings, made through the same checks as real ones. They are other
  // people's, so they stay out of the demo visitor's own My bookings.
  const ids = (services ?? []).map((s) => s.id as string);
  const admin = createAdminClient();
  for (const c of CUSTOMERS) {
    if (!admin) break;
    await admin.rpc("book_appointment", {
      p_shop_id: shopId,
      p_service_id: ids[c.service],
      p_starts_at: zonedToUtc(weekdays[c.day], c.time, TZ).toISOString(),
      p_customer_name: c.name,
      p_customer_email: c.email,
      p_customer_phone: c.phone,
      p_staff_id: staffIds[c.staff] ?? null,
    });
  }

  // One booking that is the visitor's own, for trying "Customer" mode: it shows
  // in My bookings, where it can be moved or cancelled.
  await admin?.rpc("book_appointment", {
    p_shop_id: shopId,
    p_service_id: ids[0],
    p_starts_at: zonedToUtc(weekdays[2], "16:30", TZ).toISOString(),
    p_customer_name: "Alex Pop (you)",
    p_customer_email: "alex.pop@example.com",
    p_customer_phone: "",
    p_staff_id: staffIds[0] ?? null,
    p_customer_id: userId,
  });

  // Two people waiting for a time on the first coming weekday, so the
  // Waitlist page has something to show. Only the server may add these.
  await admin?.from("waitlist").insert([
    { shop_id: shopId, service_id: ids[0], staff_id: null, day: weekdays[0], name: "Elena Marin", email: "elena.marin@example.com", phone: "+40 700 321 654" },
    { shop_id: shopId, service_id: ids[1], staff_id: staffIds[0] ?? null, day: weekdays[0], name: "Radu Toma", email: "radu.toma@example.com", phone: "" },
  ]);

  // Today's visits and past visits, added the way the owner adds walk-ins
  // (that door allows any time, even one that already passed).
  const today = utcToZoned(new Date(), TZ).date;
  for (const t of TODAY) {
    const staffId = staffIds[t.staff];
    if (!staffId) continue;
    await supabase.rpc("owner_add_booking", {
      p_service_id: ids[t.service],
      p_staff_id: staffId,
      p_starts_at: zonedToUtc(today, t.time, TZ).toISOString(),
      p_customer_name: t.name,
      p_customer_email: t.email,
      p_customer_phone: t.phone,
    });
  }

  const pastDays: string[] = [];
  for (let day = addDays(today, -1); pastDays.length < HISTORY_DAYS; day = addDays(day, -1)) {
    if (isoWeekday(day) <= 5) pastDays.push(day);
  }
  // One or two visits a day, regulars taking turns. Added in parallel (each
  // is a different time or barber), so the demo still starts quickly.
  const history = pastDays.flatMap((day, i) => {
    const first = { who: REGULARS[(i * 3) % REGULARS.length], day, time: HISTORY_TIMES[i % HISTORY_TIMES.length], staff: i % 2, service: (i * 7) % 4, missed: MISSED_ON_DAY.includes(i) };
    const second = { who: REGULARS[(i * 5 + 2) % REGULARS.length], day, time: "17:30", staff: (i + 1) % 2, service: (i + 1) % 4, missed: false };
    return i % 3 === 0 ? [first, second] : [first];
  });
  const walkIn = { who: { name: "Walk-in", email: "", phone: "" }, day: pastDays[0], time: "12:00", staff: 1, service: 3, missed: false };
  const made = await Promise.all(
    [...history, walkIn].map(async (v) => {
      const staffId = staffIds[v.staff];
      if (!staffId) return null;
      const { data } = await supabase
        .rpc("owner_add_booking", {
          p_service_id: ids[v.service],
          p_staff_id: staffId,
          p_starts_at: zonedToUtc(v.day, v.time, TZ).toISOString(),
          p_customer_name: v.who.name,
          p_customer_email: v.who.email,
          p_customer_phone: v.who.phone,
        })
        .single<{ booking_id: string }>();
      return data?.booking_id ? { id: data.booking_id, v } : null;
    }),
  );
  const missed = made.flatMap((m) => (m?.v.missed ? [m.id] : []));
  // The newest kept visits by regulars get the sample reviews, the day after.
  const reviewed = made
    .filter((m): m is NonNullable<typeof m> => Boolean(m && !m.v.missed && m.v.who.email))
    .sort((x, y) => (x.v.day === y.v.day ? x.v.time.localeCompare(y.v.time) : y.v.day.localeCompare(x.v.day)))
    .slice(0, DEMO_REVIEWS.length);
  await Promise.all([
    missed.length ? supabase.from("bookings").update({ status: "no_show" }).in("id", missed) : null,
    supabase.from("customer_notes").insert(CUSTOMER_NOTES.map((n) => ({ shop_id: shopId, customer_key: `e:${n.email}`, note: n.note }))),
    // Pictures shared by every demo shop (uploaded once by scripts/upload-demo-media.mjs).
    supabase.from("shops").update({ logo_path: DEMO_LOGO }).eq("id", shopId),
    supabase.from("shop_photos").insert(DEMO_PHOTOS.map((path, position) => ({ shop_id: shopId, path, position }))),
    admin ? addDemoReviews(admin, shopId, reviewed) : null,
  ]);
}

/**
 * Only the server may write reviews directly (customers go through
 * leave_review). The reviewed visits count as booked online, like real ones.
 */
async function addDemoReviews(
  admin: SupabaseClient,
  shopId: string,
  visits: { id: string; v: { who: { name: string }; day: string; time: string } }[],
) {
  if (!visits.length) return;
  await admin.from("bookings").update({ source: "online" }).in("id", visits.map((m) => m.id));
  await admin.from("reviews").insert(
    visits.map((m, i) => {
      const r = DEMO_REVIEWS[i];
      const at = zonedToUtc(addDays(m.v.day, 1), "10:00", TZ).toISOString();
      return {
        booking_id: m.id,
        shop_id: shopId,
        stars: r.stars,
        body: r.body,
        author: reviewAuthor(m.v.who.name),
        created_at: at,
        updated_at: at,
        reply: r.reply ?? null,
        replied_at: r.reply ? at : null,
      };
    }),
  );
}
