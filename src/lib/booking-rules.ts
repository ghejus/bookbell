import { z } from "zod";

// The owner's booking rules (the "Booking rules" page): the choices offered,
// their plain-words labels, and the form check. The database has the same
// limits, so a hand-made request can't save anything else.

export type BookingRules = {
  booking_window_days: number;
  min_notice_minutes: number;
  slot_step_minutes: number;
  buffer_minutes: number;
  cancel_deadline_hours: number;
};

export const RULE_DEFAULTS: BookingRules = {
  booking_window_days: 60,
  min_notice_minutes: 120,
  slot_step_minutes: 15,
  buffer_minutes: 0,
  cancel_deadline_hours: 0,
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function minutesLabel(m: number): string {
  if (m === 0) return "None";
  if (m % 1440 === 0) return plural(m / 1440, "day");
  if (m % 60 === 0) return plural(m / 60, "hour");
  return `${m} min`;
}

export function hoursLabel(h: number): string {
  if (h === 0) return "Any time before";
  if (h % 24 === 0) return `${plural(h / 24, "day")} before`;
  return `${plural(h, "hour")} before`;
}

export function daysLabel(d: number): string {
  if (d % 7 === 0 && d < 365) return plural(d / 7, "week");
  if (d === 365) return "1 year";
  return plural(d, "day");
}

export const RULE_CHOICES = {
  booking_window_days: [7, 14, 30, 60, 90, 180, 365],
  min_notice_minutes: [0, 30, 60, 120, 240, 720, 1440, 2880],
  slot_step_minutes: [5, 10, 15, 20, 30, 60],
  buffer_minutes: [0, 5, 10, 15, 20, 30, 45, 60],
  cancel_deadline_hours: [0, 1, 2, 6, 12, 24, 48],
} satisfies Record<keyof BookingRules, number[]>;

/** The choices for one rule, always including the shop's current value. */
export function choicesFor(rule: keyof BookingRules, current: number): number[] {
  const list = RULE_CHOICES[rule];
  return list.includes(current) ? list : [...list, current].sort((a, b) => a - b);
}

const whole = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

export const bookingRulesSchema = z.object({
  booking_window_days: whole(1, 365, "Pick how far ahead people can book."),
  min_notice_minutes: whole(0, 10080, "Pick how much notice you need."),
  slot_step_minutes: z.coerce.number().refine((n) => [5, 10, 15, 20, 30, 60].includes(n), "Pick how often a time starts."),
  buffer_minutes: whole(0, 120, "Pick a gap between bookings.").refine((n) => n % 5 === 0, "Pick a gap between bookings."),
  cancel_deadline_hours: whole(0, 168, "Pick when online changes close."),
});

/** One short line for the shop page: "2 hours notice · 10 min gap". */
export function rulesSummary(r: BookingRules): string {
  const parts = [r.min_notice_minutes ? `${minutesLabel(r.min_notice_minutes)} notice` : "No notice needed"];
  if (r.buffer_minutes) parts.push(`${r.buffer_minutes} min gap`);
  return parts.join(" · ");
}
