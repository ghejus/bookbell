import { addDays } from "./slots";

// Calendar-date helpers shared by the booking pages. Dates are "YYYY-MM-DD"
// strings; they are shown as noon UTC, so formatting never slips a day.

/** How many days the day picker shows at once. */
export const DAYS_SHOWN = 14;

export const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options });

/** "Mon" */
export const dayName = fmt({ weekday: "short" });
/** "9" */
export const dayNum = fmt({ day: "numeric" });
/** "Monday 9 November" */
export const longDay = fmt({ weekday: "long", day: "numeric", month: "long" });
/** "Nov 2026" (short, so a range fits beside a heading on small phones) */
const monthRange = fmt({ month: "short", year: "numeric" });

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
export function shownMonths(from: string, shown = DAYS_SHOWN): string {
  return monthRange.formatRange(asUtc(from), asUtc(addDays(from, shown - 1)));
}
