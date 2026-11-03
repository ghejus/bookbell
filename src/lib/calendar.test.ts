import { describe, expect, it } from "vitest";
import { hhmm, minuteOfDay, shownDays, stepDate, visibleHours, weekStart } from "./calendar";

const TZ = "Europe/Bucharest";

describe("calendar days", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-05")).toBe("2026-11-02"); // Thursday -> Monday
    expect(weekStart("2026-11-08")).toBe("2026-11-02"); // Sunday -> Monday
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });

  it("shows one day, or Monday to Sunday", () => {
    expect(shownDays("day", "2026-11-05")).toEqual(["2026-11-05"]);
    expect(shownDays("week", "2026-11-05")).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
  });

  it("steps by a day or a week, across months", () => {
    expect(stepDate("day", "2026-11-30", 1)).toBe("2026-12-01");
    expect(stepDate("week", "2026-11-05", -1)).toBe("2026-10-29");
  });
});

describe("minuteOfDay", () => {
  it("uses the shop's time zone", () => {
    expect(minuteOfDay("2026-11-05T08:30:00Z", TZ, "2026-11-05")).toBe(10 * 60 + 30); // 10:30 in Bucharest
  });
  it("cuts times on other days to the edges of this day", () => {
    expect(minuteOfDay("2026-11-04T20:00:00Z", TZ, "2026-11-05")).toBe(0);
    expect(minuteOfDay("2026-11-06T09:00:00Z", TZ, "2026-11-05")).toBe(24 * 60);
  });
});

describe("visibleHours", () => {
  const hours = [
    { weekday: 4, opens: "09:00", closes: "13:00" },
    { weekday: 4, opens: "14:00", closes: "18:30" },
    { weekday: 6, opens: "07:00", closes: "12:00" },
  ];
  it("runs from the first opening to the last closing, on whole hours", () => {
    expect(visibleHours(hours, ["2026-11-05"], [])).toEqual({ start: 9 * 60, end: 19 * 60 });
  });
  it("only looks at the days shown", () => {
    expect(visibleHours(hours, ["2026-11-05", "2026-11-07"], []).start).toBe(7 * 60);
  });
  it("stretches to fit a booking outside opening hours", () => {
    expect(visibleHours(hours, ["2026-11-05"], [{ start: 19 * 60 + 30, end: 20 * 60 + 15 }]).end).toBe(21 * 60);
  });
  it("falls back to 09:00–18:00 on a closed day with no bookings", () => {
    expect(visibleHours(hours, ["2026-11-08"], [])).toEqual({ start: 9 * 60, end: 18 * 60 });
  });
  it("formats minutes as a clock time", () => {
    expect(hhmm(9 * 60 + 5)).toBe("09:05");
  });
});
