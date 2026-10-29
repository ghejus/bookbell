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
  "a an and are at be can could do does for from have how i in is it me my of on or please the there this to we what when where which who will with would you your yes no hi hello".split(" "),
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
// Clear booking words, and weaker ones that only count when the question isn't about opening hours
// ("What time do you open?" is about hours, "Any time tomorrow?" is about booking).
const BOOK_WORDS = ["book", "booking", "appointment", "reserve", "free", "available", "availability", "slot", "slots", "come in", "get in"];
const WHEN_WORDS = ["time", "times", "today", "tomorrow", "when can", "next week", ...DAY_NAMES];
const PRICE_WORDS = ["price", "prices", "cost", "costs", "how much", "pay", "services", "service", "menu", "offer", "list"];
const HOURS_WORDS = ["open", "opening", "hours", "close", "closing", "closed"];
const WHERE_WORDS = ["where", "address", "located", "location", "directions", "phone", "call", "number", "contact"];
const HELLO_WORDS = ["hi", "hello", "hey", "salut", "buna", "good morning", "good afternoon", "good evening"];
const THANKS_WORDS = ["thanks", "thank", "multumesc", "great", "perfect", "ok", "okay", "bye"];

type Service = ShopFacts["services"][number];

const WHICH_SERVICE = "Sure. Which service would you like?";

/** The service the text talks about most clearly, if any. */
export function findService(text: string, services: Service[]): Service | undefined {
  const said = contentWords(text);
  let best: { s: Service; score: number } | undefined;
  for (const s of services) {
    const name = contentWords(s.name);
    const score = name.length ? overlap(name, said) / name.length : 0;
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
  if (w.includes("today")) return today;
  if (w.includes("tomorrow")) return addDays(today, 1);
  if (has(text, ["next week"])) return addDays(today, 8 - isoWeekday(today));
  const i = DAY_NAMES.findIndex((d) => w.includes(d));
  if (i < 0) return undefined;
  return addDays(today, (i + 1 - isoWeekday(today) + 7) % 7);
}

function callLine(f: ShopFacts) {
  return f.phone ? ` You can also call the shop at ${f.phone}.` : "";
}

export async function practiceReply(f: ShopFacts, history: ChatTurn[], tools: Toolbox): Promise<ChatReply> {
  const last = [...history].reverse().find((t) => t.role === "user")?.text ?? "";
  const earlier = history.filter((t) => t.role === "user").map((t) => t.text).reverse();

  // 1. The owner's own answer, when the question matches one of their notes.
  const note = findNote(last, f.notes);
  if (note) return { reply: note.answer };

  // 2. Free times. Also when the helper just asked "Which service?" and the customer named one.
  const lastHelper = [...history].reverse().find((t) => t.role === "assistant")?.text ?? "";
  const answeringWhich = lastHelper.startsWith(WHICH_SERVICE) && Boolean(findService(last, f.services));
  if (answeringWhich || has(last, BOOK_WORDS) || (has(last, WHEN_WORDS) && !has(last, HOURS_WORDS))) {
    if (f.services.length === 0) {
      return { reply: `${f.name} isn’t taking online bookings yet.${callLine(f)}` };
    }
    // The service from this message, or from an earlier one, or the only one there is.
    const service =
      findService(last, f.services) ??
      earlier.map((t) => findService(t, f.services)).find(Boolean) ??
      (f.services.length === 1 ? f.services[0] : undefined);
    if (!service) {
      const names = f.services.map((s) => s.name).join(", ");
      return { reply: `${WHICH_SERVICE} We offer: ${names}.` };
    }
    const fromDate = findDay(last, f.today);
    const result = await tools.findFreeTimes({ serviceId: service.id, fromDate, days: fromDate ? 7 : 14 });
    if (!result.ok) return { reply: `Sorry, I couldn’t look up free times just now.${callLine(f)}` };
    if (result.value.days.length === 0) {
      return { reply: `I couldn’t find a free time for ${service.name} then. Try another day, or use the booking steps on this page.${callLine(f)}` };
    }
    const first = result.value.days[0];
    const sameDay = fromDate && first.date === fromDate;
    return {
      reply: `${sameDay ? "Here are" : fromDate ? "That day is full, but here are" : "Here are"} the next free times for ${service.name}. Tap one to book it.`,
      times: result.value,
    };
  }

  // 3. A service on its own, or prices.
  const service = findService(last, f.services);
  if (service) {
    const price = formatPrice(service.price_cents, f.currency);
    return {
      reply: `${service.name} takes ${formatDuration(service.duration_minutes)}${price ? ` and costs ${price}` : ""}. Want me to find a free time? Just ask “When is ${service.name} free?”`,
    };
  }
  if (has(last, PRICE_WORDS)) {
    if (f.services.length === 0) return { reply: `The shop hasn’t listed its services yet.${callLine(f)}` };
    const list = f.services.map((s) => serviceSummary(s, f.currency)).join("; ");
    return { reply: `Here’s what we offer: ${list}.` };
  }

  // 4. Opening hours.
  if (has(last, HOURS_WORDS)) {
    if (f.hours.length === 0) return { reply: `The shop hasn’t set its opening hours yet.${callLine(f)}` };
    return { reply: `Our opening hours:\n${hoursLines(f.hours).join("\n")}` };
  }

  // 5. Where and how to reach the shop.
  if (has(last, WHERE_WORDS)) {
    const parts = [f.address ? `We’re at ${f.address}.` : "", f.phone ? `Our phone number is ${f.phone}.` : ""].filter(Boolean);
    return { reply: parts.length ? parts.join(" ") : "The shop hasn’t added an address or phone number yet." };
  }

  // 6. Small talk.
  if (has(last, HELLO_WORDS)) {
    return { reply: `Hello! I can tell you about prices, opening hours and free times at ${f.name}. What would you like to know?` };
  }
  if (has(last, THANKS_WORDS)) return { reply: "You’re welcome! Anything else I can help with?" };

  // 7. Anything else.
  return {
    reply: `Sorry, I’m a simple practice helper, so I didn’t understand that. I can answer about prices, opening hours, free times and the shop’s own notes.${callLine(f)}`,
  };
}
