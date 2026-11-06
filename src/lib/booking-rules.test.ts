import { describe, expect, it } from "vitest";
import { bookingRulesSchema, choicesFor, daysLabel, hoursLabel, minutesLabel, RULE_DEFAULTS, rulesSummary } from "./booking-rules";

describe("booking rule labels", () => {
  it("says minutes, hours and days in plain words", () => {
    expect(minutesLabel(0)).toBe("None");
    expect(minutesLabel(30)).toBe("30 min");
    expect(minutesLabel(60)).toBe("1 hour");
    expect(minutesLabel(120)).toBe("2 hours");
    expect(minutesLabel(1440)).toBe("1 day");
    expect(hoursLabel(0)).toBe("Any time before");
    expect(hoursLabel(2)).toBe("2 hours before");
    expect(hoursLabel(48)).toBe("2 days before");
    expect(daysLabel(14)).toBe("2 weeks");
    expect(daysLabel(60)).toBe("60 days");
    expect(daysLabel(365)).toBe("1 year");
  });

  it("sums the rules up in one line", () => {
    expect(rulesSummary(RULE_DEFAULTS)).toBe("2 hours notice");
    expect(rulesSummary({ ...RULE_DEFAULTS, min_notice_minutes: 0, buffer_minutes: 10 })).toBe("No notice needed · 10 min gap");
  });
});

describe("booking rule choices", () => {
  it("always offers the shop's current value, even an unusual one", () => {
    expect(choicesFor("booking_window_days", 60)).toContain(60);
    expect(choicesFor("booking_window_days", 45)).toEqual([7, 14, 30, 45, 60, 90, 180, 365]);
  });
});

describe("bookingRulesSchema", () => {
  const form = { booking_window_days: "60", min_notice_minutes: "120", slot_step_minutes: "15", buffer_minutes: "10", cancel_deadline_hours: "24" };

  it("accepts the form's values as numbers", () => {
    expect(bookingRulesSchema.parse(form)).toEqual({
      booking_window_days: 60,
      min_notice_minutes: 120,
      slot_step_minutes: 15,
      buffer_minutes: 10,
      cancel_deadline_hours: 24,
    });
  });

  it("refuses values the database would refuse", () => {
    expect(bookingRulesSchema.safeParse({ ...form, slot_step_minutes: "7" }).success).toBe(false);
    expect(bookingRulesSchema.safeParse({ ...form, buffer_minutes: "7" }).success).toBe(false);
    expect(bookingRulesSchema.safeParse({ ...form, buffer_minutes: "125" }).success).toBe(false);
    expect(bookingRulesSchema.safeParse({ ...form, booking_window_days: "0" }).success).toBe(false);
    expect(bookingRulesSchema.safeParse({ ...form, cancel_deadline_hours: "200" }).success).toBe(false);
    expect(bookingRulesSchema.safeParse({ ...form, min_notice_minutes: "abc" }).success).toBe(false);
  });
});
