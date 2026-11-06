// Fills a test shop with the realistic worst case: the longest values the
// database accepts, names in many scripts, emoji, many services, split days,
// and a full day of bookings. Used to stress-test the screens.
//
//   node scripts/seed-worst-case.mjs
//
// Then compare /s/frizeria-stefan-fiii (normal demo) with /s/<WORST_SLUG> (worst case).
// The owner is break-ui@randul-test.dev, with the TEST_OWNER_PASSWORD from .env.local.
// Safe to run again: it refreshes the shop and its bookings.

import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const password = process.env.TEST_OWNER_PASSWORD;
if (!url || !key || !password) throw new Error("Needs the Supabase keys and TEST_OWNER_PASSWORD in .env.local.");

const EMAIL = "break-ui@randul-test.dev";
export const WORST_SLUG = "atelier-infrumusetare-wisniewska-kowalcz"; // 40 characters, the limit
const TZ = "America/Argentina/Buenos_Aires"; // fixed UTC-3, long city name
const OFFSET = "-03:00";

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const owner = createClient(url, key, options);
// Online bookings can only be made by the server (book_appointment is server-only).
const stranger = createClient(url, process.env.SUPABASE_SECRET_KEY, options);

const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

// 1. The owner (signs up the first time).
let auth = await owner.auth.signInWithPassword({ email: EMAIL, password });
if (auth.error) {
  must(await owner.auth.signUp({ email: EMAIL, password }), "sign up");
  auth = await owner.auth.signInWithPassword({ email: EMAIL, password });
}
const userId = must(auth, "sign in").user.id;

// 2. The shop: every text at or near its limit.
const shopFields = {
  name: "Atelier de Înfrumusețare Aleksandra Wiśniewska-Kowalczyk & Fiicele (Ștefan cel Mare)".slice(0, 80),
  slug: WORST_SLUG,
  timezone: TZ,
  currency: "RON",
  about: [
    "Salon de familie din 1987. Coafură, manichiură, cosmetică și tratamente pentru păr deteriorat.",
    "Programările se fac cu cel puțin 2 ore înainte; pentru vopsit vă rugăm să veniți cu părul nespălat de o zi.",
    "Detalii despre prețuri și pachete: https://example.com/atelier-infrumusetare/preturi-si-pachete-actualizate-octombrie-2026?utm_source=bookbell&utm_medium=booking-page",
    "Parcare gratuită în curtea interioară (intrarea pe lângă farmacie). Accesibil cu scaun cu rotile, lift până la etajul 7. Plata cu cardul sau numerar. Bonuri de cadou disponibile la recepție. Nu lucrăm în zilele de sărbătoare legală. Animalele de companie mici sunt binevenite. Wi-Fi gratuit pentru clienți.",
  ]
    .join("\n\n")
    .padEnd(990, " Vă așteptăm cu drag!")
    .slice(0, 1000),
  address:
    "Bulevardul Regina Elisabeta nr. 32, Bloc B2, Scara 3, Etaj 7, Apartament 154, Interfon 154C, Sector 5, București 050017, România (intrarea prin curtea interioară, lângă farmacie)".slice(0, 200),
  phone: "+40 (0) 721 234 567 / +40 31 405 66 77".slice(0, 40),
};
const existing = must(await owner.from("shops").select("id").eq("owner_id", userId).maybeSingle(), "find shop");
const shopId = existing
  ? (must(await owner.from("shops").update(shopFields).eq("id", existing.id), "update shop"), existing.id)
  : must(await owner.from("shops").insert(shopFields).select("id").single(), "create shop").id;

// 3. Services (only the first time: services with bookings can't be deleted).
const haveServices = must(await owner.from("services").select("id").eq("shop_id", shopId), "services");
if (haveServices.length === 0) {
  must(
    await owner.from("services").insert(
      [
        ["Vopsit rădăcini + tuns + coafat de ocazie (păr lung, peste umeri) cu Olaplex", 480, 1250050],
        ["Tuns", 5, 3000],
        ["Haarverlängerungsberatungsgespräch", 45, null],
        ["Manichiură semipermanentă cu model pictat manual și întreținere", 75, 18050],
        ["Pensat", 10, 2500],
        ["Coafat", 30, 9000],
        ["Tratament keratină", 150, 65000],
        ["Spălat", 15, null],
        ["Vopsit", 120, 32000],
        ["Machiaj mireasă (include probă)", 90, 120000],
        ["Barbă", 20, 4000],
        ["Consultație gratuită", 15, 0],
      ].map(([name, duration_minutes, price_cents]) => ({ shop_id: shopId, name, duration_minutes, price_cents })),
    ),
    "add services",
  );
}

// 4. Hours: open every day, with split days and a day of four short blocks.
must(await owner.from("opening_hours").delete().eq("shop_id", shopId), "clear hours");
const hours = [];
for (const weekday of [1, 2, 3, 4, 5]) hours.push({ weekday, opens: "08:00", closes: "12:30" }, { weekday, opens: "13:30", closes: "21:00" });
hours.push(
  { weekday: 6, opens: "07:00", closes: "09:00" },
  { weekday: 6, opens: "09:30", closes: "11:00" },
  { weekday: 6, opens: "11:15", closes: "13:00" },
  { weekday: 6, opens: "14:00", closes: "23:45" },
  { weekday: 7, opens: "10:00", closes: "12:00" },
  { weekday: 7, opens: "12:00", closes: "14:00" },
);
must(await owner.from("opening_hours").insert(hours.map((h) => ({ ...h, shop_id: shopId }))), "add hours");

// 5. Notes for the helper: the longest question and answer, escaping, line breaks.
must(await owner.from("shop_info").delete().eq("shop_id", shopId), "clear notes");
must(
  await owner.from("shop_info").insert(
    [
      [
        "Pot să vin cu copilul, cu un cățel mic sau cu o prietenă care așteaptă, și aveți loc unde să stea cât timp mă tund și mă vopsesc (durează câteva ore)?".slice(0, 200),
        ("Da! Avem o canapea și reviste.\nCopiii sub 12 ani stau cu un adult.\nCățeii mici sunt bineveniți în brațe sau în cușcă. " +
          "Dacă programarea durează peste 3 ore, vă oferim cafea și apă. ").padEnd(1000, "Vă rugăm să ne anunțați dinainte. "),
      ],
      ["Do you take cards?", "Yes."],
      ["<script>alert(1)</script> **bold** &amp;", "This answer has <b>tags</b> and **stars** that must show as plain text."],
      ["Parking?", "Free parking in the courtyard: https://example.com/maps/atelier-infrumusetare-wisniewska-kowalczyk-curte-interioara-intrare-farmacie"],
    ].map(([question, answer]) => ({ shop_id: shopId, question, answer: answer.slice(0, 1000) })),
  ),
  "add notes",
);

// 6. A day off with the longest reason (only the owner sees it).
must(await owner.from("time_off").delete().eq("shop_id", shopId), "clear time off");
const day = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
must(
  await owner.from("time_off").insert({
    shop_id: shopId,
    starts_at: `${day(20)}T00:00:00${OFFSET}`,
    ends_at: `${day(23)}T00:00:00${OFFSET}`,
    reason: "Concediu de odihnă + curs de perfecționare la Viena (Haarverlängerungsberatungsgespräch-Zertifikat), revenim joi; urgențele la +40 721 234 567".slice(0, 200),
  }),
  "add time off",
);

// 7. Bookings, made the way the website makes them (server key, same checks), on the next weekday 3+ days ahead.
must(await owner.from("bookings").update({ status: "cancelled" }).eq("shop_id", shopId).eq("status", "booked"), "cancel old bookings");
let bookDay = 3;
while ([0, 6].includes(new Date(`${day(bookDay)}T12:00:00Z`).getUTCDay())) bookDay++;
const services = must(await owner.from("services").select("id, name, duration_minutes").eq("shop_id", shopId), "services");
const byName = (start) => services.find((s) => s.name.startsWith(start));
const customers = [
  ["Aleksandra Wiśniewska-Kowalczyk", "bartholomew.fitzgerald@northwind-industries-holdings.example.com", "+48 600 700 800 (după ora 17, WhatsApp)", "Manichiură"],
  ["Jo", "a@b.co", "", "Tuns"],
  ["王秀英", "wang.xiuying@example.com", "+86 138 0013 8000", "Coafat"],
  ["🦊 Fox", "first.last+billing-notifications@example.com", "", "Pensat"],
  ["نور الهدى عبد الرحمن", "noor@example.com", "+971 50 123 4567", "Barbă"],
  ["Christopher Alexander Montgomery III", "ops@sub.department.region.example.co.uk", "+44 20 7946 0958", "Haarverlängerungsberatungsgespräch"],
  ["Đặng Thị Ngọc Hân", "ngoc.han@example.com", "", "Consultație"],
];
let minutes = 8 * 60;
for (const [name, email, phone, service] of customers) {
  const s = byName(service);
  if (minutes + s.duration_minutes > 12 * 60 + 30) minutes = 13 * 60 + 30; // after the lunch break
  const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  const res = await stranger.rpc("book_appointment", {
    p_shop_id: shopId,
    p_service_id: s.id,
    p_starts_at: `${day(bookDay)}T${hhmm}:00${OFFSET}`,
    p_customer_name: name,
    p_customer_email: email,
    p_customer_phone: phone,
  });
  if (res.error) console.log(`  could not book ${name} at ${hhmm}: ${res.error.message}`);
  minutes += s.duration_minutes;
}
// The 8-hour service on the next Saturday (the only day long enough), so the list spans days.
let saturday = 3;
while (new Date(`${day(saturday)}T12:00:00Z`).getUTCDay() !== 6) saturday++;
const long = byName("Vopsit rădăcini");
const longRes = await stranger.rpc("book_appointment", {
  p_shop_id: shopId,
  p_service_id: long.id,
  p_starts_at: `${day(saturday)}T14:00:00${OFFSET}`,
  p_customer_name: "María José de la Cruz y Fernández",
  p_customer_email: "maria.jose@example.org",
  p_customer_phone: "",
});
if (longRes.error) console.log(`  could not book the long service: ${longRes.error.message}`);

console.log(`Worst-case shop ready: /s/${WORST_SLUG} (owner ${EMAIL}), bookings on ${day(bookDay)} and ${day(saturday)}.`);
