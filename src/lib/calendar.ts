// The owner calendar's arithmetic: which days to show, which hours, and where
// each booking sits. No database here, so it is easy to test.

import { addDays, isoWeekday } from "./slots";
import { utcToZoned } from "./time";

export type CalendarView = "day" | "week";

/** The Monday of the week a date is in. */
export function weekStart(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** The dates a view shows: one day, or Monday to Sunday. */
export function shownDays(view: CalendarView, date: string): string[] {
  if (view === "day") return [date];
  const monday = weekStart(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Where the arrows go: one day or one week earlier or later. */
export function stepDate(view: CalendarView, date: string, direction: -1 | 1): string {
  return addDays(date, direction * (view === "day" ? 1 : 7));
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/**
 * A moment as minutes after midnight on `day`, in the shop's time zone.
 * Moments on an earlier day count as 0, on a later day as 24 h, so a booking
 * or day off that crosses midnight is cut to the part on this day.
 */
export function minuteOfDay(iso: string, timezone: string, day: string): number {
  const local = utcToZoned(new Date(iso), timezone);
  if (local.date < day) return 0;
  if (local.date > day) return 24 * 60;
  return toMinutes(local.time);
}

/**
 * The hours the calendar shows: from the earliest opening (or booking) to the
 * latest closing (or booking end), on whole hours. 09:00–18:00 when there is nothing.
 */
export function visibleHours(
  hours: { weekday: number; opens: string; closes: string }[],
  days: string[],
  bookings: { start: number; end: number }[],
): { start: number; end: number } {
  const weekdays = new Set(days.map(isoWeekday));
  const starts = [...hours.filter((h) => weekdays.has(h.weekday)).map((h) => toMinutes(h.opens)), ...bookings.map((b) => b.start)];
  const ends = [...hours.filter((h) => weekdays.has(h.weekday)).map((h) => toMinutes(h.closes)), ...bookings.map((b) => b.end)];
  if (starts.length === 0) return { start: 9 * 60, end: 18 * 60 };
  const start = Math.floor(Math.min(...starts) / 60) * 60;
  const end = Math.min(24 * 60, Math.ceil(Math.max(...ends) / 60) * 60);
  return { start, end: Math.max(end, start + 60) };
}

/** "HH:MM" for minutes after midnight. */
export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Start times the owner can pick, every 15 minutes from 06:00 to 22:45. */
export const OWNER_TIMES = Array.from({ length: (23 - 6) * 4 }, (_, i) => hhmm(6 * 60 + i * 15));
