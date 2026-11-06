// Practice mode: a simple helper that works with no AI key.
// It spots words like "price", "open" or "book" and answers from the shop's
// facts, the owner's notes and the real free-time finder. No AI is involved,
// so it costs nothing, but it only understands simple questions.

import { addDays, isoWeekday } from "../slots";
import { formatDuration, formatPrice } from "../format";
import { hoursLines, serviceSummary } from "./facts";
import type { ChatReply, ChatTurn, ShopFacts, Toolbox } from "./types";

/** Lower case, no accents: "Tunsoare Bărbați" -> "tunsoare barbati". */
const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
const words = (s: string): string[] => normalize(s).match(/[\p{L}\p{N}]+/gu) ?? [];

// Small words that say nothing about the topic.
const STOP = new Set(
  (
    "a an and are at be can could do does for from have how i in is it me my of on or please the there this to we what when where which who will with would you your yes no hi hello " +
    // Romanian small words (without accents, like normalize() makes them)
    "si sau la de pe cu ce cand cat cate este e sunt sunteti aveti ai am un o in din pentru va vreau imi mi ma se ne nu da rog unde care cum cine"
  ).split(" "),
);
const contentWords = (s: string) => words(s).filter((w) => w.length > 2 && !STOP.has(w));

/** "haircut" matches "haircuts", "kid" matches "kids". */
const sameWord = (a: string, b: string) => a === b || (Math.min(a.length, b.length) >= 3 && (a.startsWith(b) || b.startsWith(a)));
const overlap = (a: string[], b: string[]) => a.filter((x) => b.some((y) => sameWord(x, y))).length;

const has = (text: string, list: string[]) => {
  const w = words(text);
  const n = ` ${w.join(" ")} `;
  return list.some((k) => (k.includes(" ") ? n.includes(` ${k} `) : w.includes(k)));
};

const DAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_NAMES_RO = ["luni", "marti", "miercuri", "joi", "vineri", "sambata", "duminica"];
// Clear booking words, and weaker ones that only count when the question isn't about opening hours
// ("What time do you open?" is about hours, "Any time tomorrow?" is about booking).
const BOOK_WORDS = [
  "book", "booking", "appointment", "reserve", "free", "available", "availability", "slot", "slots", "come in", "get in",
  "programare", "programez", "programa", "programari", "rezerv", "rezervare", "liber", "libera", "libere", "disponibil", "loc",
];
const WHEN_WORDS = [
  "time", "times", "today", "tomorrow", "when can", "next week", ...DAY_NAMES,
  "ora", "ore", "azi", "astazi", "maine", "saptamana viitoare", "cand pot", ...DAY_NAMES_RO,
];
const PRICE_WORDS = [
  "price", "prices", "cost", "costs", "how much", "pay", "services", "service", "menu", "offer", "list",
  "pret", "pretul", "preturi", "preturile", "costa", "cat costa", "costuri", "costurile", "tarif", "tarife", "tarifele",
  "servicii", "serviciile", "serviciu", "oferta", "oferiti", "lista", "plata",
];
const HOURS_WORDS = ["open", "opening", "hours", "close", "closing", "closed", "deschis", "deschideti", "program", "programul", "orar", "orarul", "inchis", "inchideti"];
const WHERE_WORDS = [
  "where", "address", "located", "location", "directions", "phone", "call", "number", "contact",
  "unde", "adresa", "adresa", "locatie", "locatia", "telefon", "telefonul", "sun", "suna", "numar", "numarul",
];
const HELLO_WORDS = ["hi", "hello", "hey", "salut", "buna", "buna ziua", "good morning", "good afternoon", "good evening"];
const THANKS_WORDS = ["thanks", "thank", "multumesc", "mersi", "great", "perfect", "super", "ok", "okay", "bye", "pa"];

type Service = ShopFacts["services"][number];

const WHICH_SERVICE = { en: "Sure. Which service would you like?", ro: "Sigur. Ce serviciu dorești?" };

/** The service the text talks about most clearly, if any. */
export function findService(text: string, services: Service[]): Service | undefined {
  const said = contentWords(text);
  let best: { s: Service; score: number } | undefined;
  for (const s of services) {
    const name = contentWords(s.name);
    const hits = overlap(name, said);
    // More matching words wins ("vopsit rădăcini" picks the long colouring service over plain "Vopsit");
    // on a tie, the name the customer said more completely wins.
    const score = name.length && hits ? hits + hits / name.length / 2 : 0;
    if (score > 0 && (!best || score > best.score)) best = { s, score };
  }
  return best?.s;
}

/** The owner's note that best matches the question, if it matches well enough. */
export function findNote(text: string, notes: ShopFacts["notes"]) {
  const said = contentWords(text);
  if (said.length === 0) return undefined;
  let best: { note: ShopFacts["notes"][number]; score: number } | undefined;
  for (const note of notes) {
    const q = contentWords(note.question);
    if (q.length === 0) continue;
    const hits = overlap(q, said);
    // More than half the note's question words, or two clear words, must appear.
    if (hits === 0 || (hits / q.length <= 0.5 && hits < 2)) continue;
    const score = hits / q.length + hits / 100;
    if (!best || score > best.score) best = { note, score };
  }
  return best?.note;
}

/** "tomorrow", "friday" ... -> the calendar date it means (today or later). */
export function findDay(text: string, today: string): string | undefined {
  const w = words(text);
  if (w.includes("today") || w.includes("azi") || w.includes("astazi")) return today;
  if (w.includes("tomorrow") || w.includes("maine")) return addDays(today, 1);
  if (has(text, ["next week", "saptamana viitoare"])) return addDays(today, 8 - isoWeekday(today));
  let i = DAY_NAMES.findIndex((d) => w.includes(d));
  if (i < 0) i = DAY_NAMES_RO.findIndex((d) => w.includes(d));
  if (i < 0) return undefined;
  return addDays(today, (i + 1 - isoWeekday(today) + 7) % 7);
}

/** Everything the practice helper says, in English and Romanian. */
const SAY = {
  en: {
    call: (phone: string) => ` You can also call the shop at ${phone}.`,
    notBooking: (shop: string) => `${shop} isn’t taking online bookings yet.`,
    weOffer: (names: string) => ` We offer: ${names}.`,
    lookupFailed: "Sorry, I couldn’t look up free times just now.",
    noneThen: (service: string) => `I couldn’t find a free time for ${service} then. Try another day, or use the booking steps on this page.`,
    hereAre: (lead: "same" | "full" | "next", service: string) =>
      `${lead === "full" ? "That day is full, but here are" : "Here are"} the next free times for ${service}. Tap one to book it.`,
    takes: (service: string, duration: string, price: string, free: boolean) =>
      `${service} takes ${duration}${free ? " and is free" : price ? ` and costs ${price}` : ""}. Want me to find a free time? Just ask “When is ${service} free?”`,
    noServices: "The shop hasn’t listed its services yet.",
    offer: (list: string) => `Here’s what we offer: ${list}.`,
    noHours: "The shop hasn’t set its opening hours yet.",
    hours: (lines: string) => `Our opening hours:\n${lines}`,
    at: (address: string) => `We’re at ${address}.`,
    phoneIs: (phone: string) => `Our phone number is ${phone}.`,
    noContact: "The shop hasn’t added an address or phone number yet.",
    hello: (shop: string) => `Hello! I can tell you about prices, opening hours and free times at ${shop}. What would you like to know?`,
    welcome: "You’re welcome! Anything else I can help with?",
    lost: "Sorry, I’m a simple practice helper, so I didn’t understand that. I can answer about prices, opening hours, free times and the shop’s own notes.",
  },
  ro: {
    call: (phone: string) => ` Poți suna și la salon, la ${phone}.`,
    notBooking: (shop: string) => `${shop} nu primește încă programări online.`,
    weOffer: (names: string) => ` Avem: ${names}.`,
    lookupFailed: "Îmi pare rău, nu am putut căuta orele libere acum.",
    noneThen: (service: string) => `Nu am găsit o oră liberă pentru ${service} atunci. Încearcă altă zi sau folosește pașii de programare de pe pagină.`,
    hereAre: (lead: "same" | "full" | "next", service: string) =>
      `${lead === "full" ? "Ziua aceea e plină, dar iată" : "Iată"} următoarele ore libere pentru ${service}. Apasă pe una ca să te programezi.`,
    takes: (service: string, duration: string, price: string, free: boolean) =>
      `${service} durează ${duration}${free ? " și e gratuit" : price ? ` și costă ${price}` : ""}. Vrei să-ți caut o oră liberă? Întreabă doar „Când e liber pentru ${service}?”`,
    noServices: "Salonul nu și-a trecut încă serviciile.",
    offer: (list: string) => `Iată ce oferim: ${list}.`,
    noHours: "Salonul nu și-a setat încă programul.",
    hours: (lines: string) => `Programul nostru:\n${lines}`,
    at: (address: string) => `Ne găsești la ${address}.`,
    phoneIs: (phone: string) => `Numărul nostru de telefon este ${phone}.`,
    noContact: "Salonul nu a adăugat încă o adresă sau un număr de telefon.",
    hello: (shop: string) => `Salut! Îți pot spune despre prețuri, program și ore libere la ${shop}. Ce vrei să afli?`,
    welcome: "Cu plăcere! Te mai pot ajuta cu ceva?",
    lost: "Îmi pare rău, sunt un asistent simplu de probă și nu am înțeles. Pot răspunde despre prețuri, program, ore libere și notițele salonului.",
  },
};

function callLine(f: ShopFacts) {
  return f.phone ? SAY[f.lang ?? "en"].call(f.phone) : "";
}

export async function practiceReply(f: ShopFacts, history: ChatTurn[], tools: Toolbox): Promise<ChatReply> {
  const lang = f.lang ?? "en";
  const say = SAY[lang];
  const last = [...history].reverse().find((t) => t.role === "user")?.text ?? "";
  const earlier = history.filter((t) => t.role === "user").map((t) => t.text).reverse();

  // 1. The owner's own answer, when the question matches one of their notes.
  const note = findNote(last, f.notes);
  if (note) return { reply: note.answer };

  // 2. Free times. Also when the helper just asked "Which service?" and the customer named one.
  const lastHelper = [...history].reverse().find((t) => t.role === "assistant")?.text ?? "";
  const answeringWhich = (lastHelper.startsWith(WHICH_SERVICE.en) || lastHelper.startsWith(WHICH_SERVICE.ro)) && Boolean(findService(last, f.services));
  if (answeringWhich || has(last, BOOK_WORDS) || (has(last, WHEN_WORDS) && !has(last, HOURS_WORDS))) {
    if (f.services.length === 0) {
      return { reply: `${say.notBooking(f.name)}${callLine(f)}` };
    }
    // The service from this message, or from an earlier one, or the only one there is.
    const service =
      findService(last, f.services) ??
      earlier.map((t) => findService(t, f.services)).find(Boolean) ??
      (f.services.length === 1 ? f.services[0] : undefined);
    if (!service) {
      const names = f.services.map((s) => s.name).join(", ");
      return { reply: `${WHICH_SERVICE[lang]}${say.weOffer(names)}` };
    }
    const fromDate = findDay(last, f.today);
    const result = await tools.findFreeTimes({ serviceId: service.id, fromDate, days: fromDate ? 7 : 14 });
    if (!result.ok) return { reply: `${say.lookupFailed}${callLine(f)}` };
    if (result.value.days.length === 0) {
      return { reply: `${say.noneThen(service.name)}${callLine(f)}` };
    }
    const first = result.value.days[0];
    const sameDay = fromDate && first.date === fromDate;
    return {
      reply: say.hereAre(sameDay ? "same" : fromDate ? "full" : "next", service.name),
      times: result.value,
    };
  }

  // 3. A service on its own, or prices.
  const service = findService(last, f.services);
  if (service) {
    const price = formatPrice(service.price_cents, f.currency, lang);
    return { reply: say.takes(service.name, formatDuration(service.duration_minutes), price, service.price_cents === 0) };
  }
  if (has(last, PRICE_WORDS)) {
    if (f.services.length === 0) return { reply: `${say.noServices}${callLine(f)}` };
    const list = f.services.map((s) => serviceSummary(s, f.currency, lang)).join("; ");
    return { reply: say.offer(list) };
  }

  // 4. Opening hours.
  if (has(last, HOURS_WORDS)) {
    if (f.hours.length === 0) return { reply: `${say.noHours}${callLine(f)}` };
    return { reply: say.hours(hoursLines(f.hours, lang).join("\n")) };
  }

  // 5. Where and how to reach the shop.
  if (has(last, WHERE_WORDS)) {
    const parts = [f.address ? say.at(f.address) : "", f.phone ? say.phoneIs(f.phone) : ""].filter(Boolean);
    return { reply: parts.length ? parts.join(" ") : say.noContact };
  }

  // 6. Small talk.
  if (has(last, HELLO_WORDS)) {
    return { reply: say.hello(f.name) };
  }
  if (has(last, THANKS_WORDS)) return { reply: say.welcome };

  // 7. Anything else.
  return {
    reply: `${say.lost}${callLine(f)}`,
  };
}
