import { describe, expect, it } from "vitest";
import { addDays, getFreeSlots, isoWeekday, type SlotInput } from "./slots";
import { zonedToUtc } from "./time";

const TZ = "Europe/Bucharest";
// A Monday in winter (UTC+2). "now" is the Friday before, so notice rules don't interfere.
const base: SlotInput = {
  date: "2026-11-02",
  timezone: TZ,
  hours: [{ opens: "09:00", closes: "12:00" }],
  durationMinutes: 30,
  busy: [],
  now: new Date("2026-10-30T08:00:00Z"),
  minNoticeMinutes: 120,
  windowDays: 60,
  stepMinutes: 15,
};
const labels = (input: Partial<SlotInput>) => getFreeSlots({ ...base, ...input }).map((s) => s.label);

describe("getFreeSlots", () => {
  it("offers every step that fits before closing", () => {
    expect(labels({})).toEqual([
      "09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30",
      "10:45", "11:00", "11:15", "11:30",
    ]);
  });

  it("returns the real moment in the shop's time zone", () => {
    expect(getFreeSlots(base)[0].start.toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("offers nothing on a closed day", () => {
    expect(labels({ hours: [] })).toEqual([]);
  });

  it("respects a lunch break (two blocks)", () => {
    const got = labels({ hours: [{ opens: "14:00", closes: "15:00" }, { opens: "09:00", closes: "10:00" }], durationMinutes: 45 });
    expect(got).toEqual(["09:00", "09:15", "14:00", "14:15"]);
  });

  it("never offers a service longer than the block", () => {
    expect(labels({ durationMinutes: 240 })).toEqual([]);
  });

  it("skips times that overlap a booking, but allows touching ones", () => {
    const busy = [{ start: zonedToUtc("2026-11-02", "10:00", TZ), end: zonedToUtc("2026-11-02", "10:30", TZ) }];
    const got = labels({ busy });
    expect(got).toContain("09:30"); // ends exactly at 10:00
    expect(got).not.toContain("09:45"); // would run into the booking
    expect(got).not.toContain("10:00");
    expect(got).not.toContain("10:15");
    expect(got).toContain("10:30"); // starts exactly when the booking ends
  });

  it("skips a whole day off", () => {
    const busy = [{ start: new Date("2026-11-01T22:00:00Z"), end: new Date("2026-11-02T22:00:00Z") }];
    expect(labels({ busy })).toEqual([]);
  });

  it("needs the minimum notice", () => {
    // It's 09:10 in the shop on that Monday; with 2 hours notice the first slot is 11:15.
    const now = zonedToUtc("2026-11-02", "09:10", TZ);
    expect(labels({ now })).toEqual(["11:15", "11:30"]);
  });

  it("stops at the booking window", () => {
    expect(labels({ windowDays: 1 })).toEqual([]);
  });

  it("uses the shop's step", () => {
    expect(labels({ stepMinutes: 60 })).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("skips the hour that doesn't exist when clocks go forward", () => {
    // Sunday 28 March 2027: in Bucharest 03:00 jumps to 04:00.
    const got = labels({
      date: "2027-03-28",
      hours: [{ opens: "02:00", closes: "05:00" }],
      durationMinutes: 60,
      stepMinutes: 60,
      now: new Date("2027-03-20T00:00:00Z"),
    });
    expect(got).not.toContain("03:00");
    expect(got).toEqual(["02:00", "04:00"]);
  });

  it("accepts database time strings with seconds", () => {
    expect(labels({ hours: [{ opens: "09:00:00", closes: "10:00:00" }], stepMinutes: 30 })).toEqual(["09:00", "09:30"]);
  });
});

describe("calendar helpers", () => {
  it("adds days across months and years", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("knows the weekday", () => {
    expect(isoWeekday("2026-11-02")).toBe(1); // Monday
    expect(isoWeekday("2026-11-08")).toBe(7); // Sunday
  });
});
