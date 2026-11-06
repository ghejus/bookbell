import { addDays, isoWeekday } from "./slots";

// The time ranges on the Stats page: a week (Monday to Sunday) or a calendar
// month, counted back from the one we're in. Dates are "YYYY-MM-DD" in the
// shop's own time zone; `to` is the day after the last day (exclusive).

export type PeriodKind = "week" | "month";
export type Period = { from: string; to: string; label: string };

const monthName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);

function addMonths(date: string, months: number): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
}

/** The week or month `offset` steps back from the one containing `today` (0 = this one). */
export function periodFor(kind: PeriodKind, today: string, offset = 0): Period {
  if (kind === "week") {
    const from = addDays(today, 1 - isoWeekday(today) - 7 * offset);
    const to = addDays(from, 7);
    const label = offset === 0 ? "This week" : offset === 1 ? "Last week" : dayMonth.formatRange(asUtc(from), asUtc(addDays(to, -1)));
    return { from, to, label };
  }
  const from = addMonths(today, -offset);
  const to = addMonths(from, 1);
  const label = offset === 0 ? "This month" : offset === 1 ? "Last month" : monthName.format(asUtc(from));
  return { from, to, label };
}

/** The dates a period covers, in plain words: "3 – 9 Nov" or "November 2026". */
export function periodRange(kind: PeriodKind, p: Period): string {
  return kind === "week" ? dayMonth.formatRange(asUtc(p.from), asUtc(addDays(p.to, -1))) : monthName.format(asUtc(p.from));
}

/**
 * What to compare a period with: the one before it. While a period is still
 * running, only the same stretch of the one before (Monday to Wednesday vs
 * Monday to Wednesday), so a half-done week isn't compared with a whole one.
 * Times are milliseconds; `fromMs`/`toMs` are where each period starts and ends.
 */
export function comparisonEnd(prevFromMs: number, prevToMs: number, fromMs: number, nowMs: number): number {
  return Math.min(prevToMs, prevFromMs + Math.max(0, nowMs - fromMs));
}

/** "+12%", "−5%", "same", or null when there's nothing to compare with. */
export function change(now: number, before: number): string | null {
  if (before === 0) return now === 0 ? "same" : null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return "same";
  return pct > 0 ? `+${pct}%` : `−${Math.abs(pct)}%`;
}
