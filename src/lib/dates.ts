import type { Lang } from "./i18n/config";
import { addDays } from "./slots";

// Calendar-date helpers shared by the booking pages. Dates are "YYYY-MM-DD"
// strings; they are shown as noon UTC, so formatting never slips a day.

/** How many days the day picker shows at once. */
export const DAYS_SHOWN = 14;

export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);

/** The date style for each language: British English, or Romanian. */
export const dateLocale = (lang: Lang) => (lang === "ro" ? "ro-RO" : "en-GB");

/** Romanian writes weekdays in lower case; at the start of a label they get a capital. */
export const capital = (text: string) => text.charAt(0).toLocaleUpperCase() + text.slice(1);

type Formatter = { format: (d: Date) => string };

function makeDates(lang: Lang) {
  const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dateLocale(lang), { timeZone: "UTC", ...options });
  const short = fmt({ weekday: "short" });
  const long = fmt({ weekday: "long", day: "numeric", month: "long" });
  return {
    /** "Mon" / "Lun" */
    dayName: { format: (d: Date) => capital(short.format(d)).replace(".", "") } as Formatter,
    /** "9" */
    dayNum: fmt({ day: "numeric" }) as Formatter,
    /** "Monday 9 November" / "Luni, 9 noiembrie" */
    longDay: { format: (d: Date) => capital(long.format(d)) } as Formatter,
    /** "Nov 2026" (short, so a range fits beside a heading on small phones) */
    monthRange: fmt({ month: "short", year: "numeric" }),
  };
}

const byLang = { en: makeDates("en"), ro: makeDates("ro") };

/** The day formats for one language. */
export const datesFor = (lang: Lang) => byLang[lang];

// English, for screens that don't speak Romanian yet.
export const { dayName, dayNum, longDay } = byLang.en;

/**
 * Which days the picker shows: starting at `wanted` (if it is a real date
 * inside today … lastDay), else today. Also where the arrows go.
 */
export function dayWindow(today: string, lastDay: string, wanted: unknown, shown = DAYS_SHOWN) {
  const from = isDate(wanted) && wanted > today && wanted <= lastDay ? wanted : today;
  const back = addDays(from, -shown);
  const prevFrom = from > today ? (back < today ? today : back) : null;
  const nextFrom = addDays(from, shown) <= lastDay ? addDays(from, shown) : null;
  return { from, prevFrom, nextFrom };
}

/** "Nov 2026", or "Oct – Nov 2026" when the shown days cross a month. */
export function shownMonths(from: string, shown = DAYS_SHOWN, lang: Lang = "en"): string {
  return byLang[lang].monthRange.formatRange(asUtc(from), asUtc(addDays(from, shown - 1)));
}
