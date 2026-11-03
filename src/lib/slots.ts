// The free-time finder: which start times can a customer pick on one day?
// Pure function (no database), so it is easy to test. The database checks
// the same rules again when a booking is made (book_appointment).

import { utcToZoned, zonedToUtc } from "./time";

export type OpeningBlock = { opens: string; closes: string }; // "HH:MM" or "HH:MM:SS", shop time
export type Busy = { start: Date; end: Date };

export type SlotInput = {
  /** The day, in the shop's time zone: "YYYY-MM-DD". */
  date: string;
  timezone: string;
  /** Opening blocks for that weekday. */
  hours: OpeningBlock[];
  durationMinutes: number;
  /** Bookings and days off that overlap the day. */
  busy: Busy[];
  now: Date;
  minNoticeMinutes: number;
  windowDays: number;
  stepMinutes: number;
};

export type Slot = { start: Date; label: string };

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function getFreeSlots(input: SlotInput): Slot[] {
  const earliest = input.now.getTime() + input.minNoticeMinutes * 60_000;
  const latest = input.now.getTime() + input.windowDays * 86_400_000;
  const slots: Slot[] = [];
  const seen = new Set<number>();

  const blocks = [...input.hours].sort((a, b) => toMinutes(a.opens) - toMinutes(b.opens));
  for (const block of blocks) {
    const opens = toMinutes(block.opens);
    const closes = toMinutes(block.closes);
    for (let t = opens; t + input.durationMinutes <= closes; t += input.stepMinutes) {
      const label = toHhmm(t);
      const start = zonedToUtc(input.date, label, input.timezone);
      // Skip wall-clock times that don't exist (the hour skipped when clocks go forward).
      if (utcToZoned(start, input.timezone).time !== label) continue;
      const end = new Date(start.getTime() + input.durationMinutes * 60_000);
      const startMs = start.getTime();
      if (startMs < earliest || startMs > latest || seen.has(startMs)) continue;
      if (input.busy.some((b) => start < b.end && b.start < end)) continue;
      seen.add(startMs);
      slots.push({ start, label });
    }
  }
  return slots;
}

/** "YYYY-MM-DD" + n days, as a calendar date (no time zone involved). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** A taken time that belongs to one worker, or to the whole shop (staffId null). */
export type StaffBusy = Busy & { staffId: string | null };

/**
 * Free times when the shop has several workers. With `staffId`, only that
 * worker's free times. Without it ("anyone"), a time is free when at least one
 * worker is free then. Whole-shop days off (staffId null) block everyone.
 */
export function getTeamFreeSlots(
  input: Omit<SlotInput, "busy">,
  busy: StaffBusy[],
  staffIds: string[],
  staffId?: string,
): Slot[] {
  const workers = staffId ? staffIds.filter((id) => id === staffId) : staffIds;
  const byStart = new Map<number, Slot>();
  for (const id of workers) {
    const mine = busy.filter((b) => b.staffId === null || b.staffId === id);
    for (const slot of getFreeSlots({ ...input, busy: mine })) byStart.set(slot.start.getTime(), slot);
  }
  return [...byStart.values()].sort((a, b) => a.start.getTime() - b.start.getTime());
}
