// Plain-word versions of a shop's facts, used by both helpers (practice and AI)
// and by the AI's instructions. No database here, so it is easy to test.

import { dateLocale } from "../dates";
import type { Lang } from "../i18n/config";
import { formatDuration, formatPrice, WEEKDAYS } from "../format";
import type { ChatService, ShopFacts } from "./types";

type Service = ShopFacts["services"][number];

/** No-break space, so "30 min" and "25 lei" stay on one line. */
const NBSP = String.fromCharCode(160);
/** Plain spaces for the AI (it doesn't need no-break spaces). */
const plain = (s: string) => s.replaceAll(NBSP, " ");

export function serviceSummary(s: Service, currency: ShopFacts["currency"], lang: Lang = "en"): string {
  const price = formatPrice(s.price_cents, currency, lang);
  return `${s.name}, ${formatDuration(s.duration_minutes)}${price ? `, ${price}` : ""}`;
}

export function toChatService(s: Service, currency: ShopFacts["currency"], lang: Lang = "en"): ChatService {
  return { id: s.id, name: s.name, durationMinutes: s.duration_minutes, summary: serviceSummary(s, currency, lang) };
}

// Calendar dates as noon UTC, so formatting never slips to the day before.
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const capital = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

/** "2026-11-03" -> "Tue 3 Nov" (Romanian: "Mar 3 nov"). */
export function dayLabel(date: string, lang: Lang = "en"): string {
  const shortDay = new Intl.DateTimeFormat(dateLocale(lang), { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return capital(shortDay.format(asUtc(date)).replace(",", "").replaceAll(".", ""));
}

/** An exact moment -> "Tuesday 3 November, 10:30" in the shop's time zone (Romanian: "Marți, 3 noiembrie, 10:30"). */
export function whenLabel(iso: string, timezone: string, lang: Lang = "en"): string {
  const text = new Intl.DateTimeFormat(dateLocale(lang), {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .replace(" at ", ", ")
    .replace(" la ", ", ");
  return lang === "ro" ? capital(text) : text;
}

const WEEKDAYS_RO = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];

const hhmm = (t: string) => t.slice(0, 5);

/**
 * One line per weekday: "Monday: 09:00–13:00, 14:00–18:00" or "Sunday: closed".
 * Blocks that touch are joined, so 10:00–12:00 plus 12:00–14:00 reads "10:00–14:00".
 */
export function hoursLines(hours: ShopFacts["hours"], lang: Lang = "en"): string[] {
  return (lang === "ro" ? WEEKDAYS_RO : WEEKDAYS).map((name, i) => {
    const blocks: { opens: string; closes: string }[] = [];
    const sorted = hours.filter((h) => h.weekday === i + 1).sort((a, b) => a.opens.localeCompare(b.opens));
    for (const h of sorted) {
      const prev = blocks.at(-1);
      if (prev && hhmm(h.opens) <= prev.closes) prev.closes = hhmm(h.closes) > prev.closes ? hhmm(h.closes) : prev.closes;
      else blocks.push({ opens: hhmm(h.opens), closes: hhmm(h.closes) });
    }
    return `${name}: ${blocks.length ? blocks.map((b) => `${b.opens}–${b.closes}`).join(", ") : lang === "ro" ? "închis" : "closed"}`;
  });
}

/** "Europe/Bucharest" -> "Bucharest". */
export const cityOf = (tz: string) => (tz.split("/").pop() ?? tz).replaceAll("_", " ");

/**
 * The AI's instructions for one shop. It changes only when the owner edits
 * the shop or the day changes, so the AI service can reuse it (prompt caching).
 */
export function systemPrompt(f: ShopFacts): string {
  const services = f.services.length
    ? f.services.map((s) => `- ${plain(serviceSummary(s, f.currency))} (id: ${s.id})`).join("\n")
    : "(none yet: online booking is not open)";
  const notes = f.notes.length
    ? f.notes.map((n) => `<note>\nQ: ${n.question}\nA: ${n.answer}\n</note>`).join("\n")
    : "(none)";

  return `You are the friendly front-desk helper on the online booking page of ${f.name}. Customers ask you about the shop and you help them find a free time.

How to answer:
- Use only the shop facts below and what your tools return. If the answer is not there, say you don't know${f.phone ? ` and suggest calling the shop at ${f.phone}` : " and suggest contacting the shop"}. Never invent prices, services, policies or opening times.
- The owner's notes are the owner's own words. Repeat them faithfully; don't add to them.
- Keep answers short: one to three sentences, plain text, no markdown, no lists with symbols. Answer in the language the customer writes in.${f.lang === "ro" ? " The page is shown in Romanian, so when unsure, answer in Romanian." : ""}
- For free times, always call find_free_times. Never guess what is free. The customer sees the times as buttons under your answer, so mention a few, don't list them all.
- When the customer has chosen a service and a time, call propose_booking. That shows them a booking form; they type their name and email and tap Book themselves. You cannot finish a booking, and you must not ask for their name, email or phone in the chat. Never say a time is booked.
- If they want to change or cancel a booking they already have, ask them to contact the shop.
- Stay on the topic of this shop. Politely decline anything else.

Shop facts:
Name: ${f.name}
${f.about ? `About: ${f.about}\n` : ""}${f.address ? `Address: ${f.address}\n` : ""}${f.phone ? `Phone: ${f.phone}\n` : ""}Time zone: ${f.timezone} (all times are ${cityOf(f.timezone)} time)
Today is ${dayLabel(f.today)} (${f.today}). Bookings are possible up to ${f.lastDay}.

Services:
${services}

Opening hours:
${hoursLines(f.hours).join("\n")}

Owner's notes (questions and answers):
${notes}`;
}
