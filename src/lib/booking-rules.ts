import { z } from "zod";
import { mark, ownerT, type OwnerT } from "./i18n/owner";

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

const EN = ownerT("en");

export function minutesLabel(m: number, o: OwnerT = EN): string {
  if (m === 0) return o("None");
  if (m % 1440 === 0) return o.n(m / 1440, "{n} day", "{n} days");
  if (m % 60 === 0) return o.n(m / 60, "{n} hour", "{n} hours");
  return `${m} min`;
}

export function hoursLabel(h: number, o: OwnerT = EN): string {
  if (h === 0) return o("Any time before");
  if (h % 24 === 0) return o.n(h / 24, "{n} day before", "{n} days before");
  return o.n(h, "{n} hour before", "{n} hours before");
}

export function daysLabel(d: number, o: OwnerT = EN): string {
  if (d % 7 === 0 && d < 365) return o.n(d / 7, "{n} week", "{n} weeks");
  if (d === 365) return o("1 year");
  return o.n(d, "{n} day", "{n} days");
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
  booking_window_days: whole(1, 365, mark("Pick how far ahead people can book.")),
  min_notice_minutes: whole(0, 10080, mark("Pick how much notice you need.")),
  slot_step_minutes: z.coerce.number().refine((n) => [5, 10, 15, 20, 30, 60].includes(n), mark("Pick how often a time starts.")),
  buffer_minutes: whole(0, 120, mark("Pick a gap between bookings.")).refine((n) => n % 5 === 0, mark("Pick a gap between bookings.")),
  cancel_deadline_hours: whole(0, 168, mark("Pick when online changes close.")),
});

/** One short line for the shop page: "2 hours notice · 10 min gap". */
export function rulesSummary(r: BookingRules, o: OwnerT = EN): string {
  const parts = [r.min_notice_minutes ? o("{time} notice", { time: minutesLabel(r.min_notice_minutes, o) }) : o("No notice needed")];
  if (r.buffer_minutes) parts.push(o("{minutes} min gap", { minutes: r.buffer_minutes }));
  return parts.join(" · ");
}
