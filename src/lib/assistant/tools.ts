import "server-only";
import { getAvailability, type getPublicShop } from "@/lib/booking";
import { addDays } from "@/lib/slots";
import { cityOf, dayLabel, toChatService, whenLabel } from "./facts";
import type { ShopFacts, Toolbox } from "./types";

type ShopData = NonNullable<Awaited<ReturnType<typeof getPublicShop>>>;

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v: unknown): v is string => typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** Days with free times the chat box shows as buttons (the AI can see more). */
const DAYS_SHOWN = 3;

/**
 * The helper's two tools for one shop. Whatever the AI sends in is treated
 * as untrusted: ids, dates and times are checked here, and the free times
 * come from the same finder the booking page uses.
 */
export function makeToolbox(data: ShopData, facts: ShopFacts, now: Date): Toolbox {
  const serviceById = (id: string) => data.services.find((s) => s.id === id);
  const unknownService = "Unknown service_id. Use one of the ids from the services list.";

  return {
    async findFreeTimes({ serviceId, fromDate, days = 7 }) {
      const service = serviceById(serviceId);
      if (!service) return { ok: false, text: unknownService };
      const from = isDate(fromDate) && fromDate > facts.today && fromDate <= facts.lastDay ? fromDate : facts.today;
      const count = Math.min(14, Math.max(1, Math.round(Number(days) || 7)));

      const found = (await getAvailability(data, service, from, count, now)).filter((d) => d.slots.length > 0);
      const until = addDays(from, count - 1);
      const chatService = toChatService(service, facts.currency);

      if (found.length === 0) {
        const more = until < facts.lastDay ? ` Try again with from_date ${addDays(until, 1)}.` : "";
        return { ok: true, value: { service: chatService, days: [] }, text: `No free times for ${service.name} from ${from} to ${until}.${more}` };
      }

      const lines = found.map((d) => `${d.date} (${dayLabel(d.date)}): ${d.slots.map((s) => s.label).join(", ")}`);
      return {
        ok: true,
        value: {
          service: chatService,
          days: found.slice(0, DAYS_SHOWN).map((d) => ({ date: d.date, label: dayLabel(d.date), slots: d.slots })),
        },
        text: `Free start times for ${service.name} (${cityOf(facts.timezone)} time), ${from} to ${until}:\n${lines.join("\n")}\nThe customer sees the first ${Math.min(DAYS_SHOWN, found.length)} of these days as buttons.`,
      };
    },

    async proposeBooking({ serviceId, date, time }) {
      const service = serviceById(serviceId);
      if (!service) return { ok: false, text: unknownService };
      if (!isDate(date) || !isTime(time)) return { ok: false, text: "date must be YYYY-MM-DD and time must be HH:MM (24-hour, shop time)." };
      if (date < facts.today || date > facts.lastDay) return { ok: false, text: `That date can't be booked. Bookable dates are ${facts.today} to ${facts.lastDay}.` };

      // Is it free right now? (The database checks again when the customer taps Book.)
      const [day] = await getAvailability(data, service, date, 1, now);
      const slot = day.slots.find((s) => s.label === time);
      if (!slot) {
        const free = day.slots.map((s) => s.label).join(", ");
        return { ok: false, text: `${time} on ${date} is not free for ${service.name}. ${free ? `Free times that day: ${free}.` : "Nothing is free that day."}` };
      }
      return {
        ok: true,
        value: { service: toChatService(service, facts.currency), startsAt: slot.iso, whenLabel: whenLabel(slot.iso, facts.timezone) },
        text: `A booking form for ${service.name} on ${dayLabel(date)} at ${time} is now shown under your answer. Nothing is booked yet: the customer must type their name and email and tap Book. Tell them that briefly.`,
      };
    },
  };
}
