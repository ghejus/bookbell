import { describe, expect, it } from "vitest";
import { asUtc, dayName, dayWindow, isDate, longDay, shownMonths } from "./dates";

describe("dayWindow", () => {
  const today = "2026-11-06";
  const lastDay = "2027-01-05"; // 60 days ahead

  it("starts today when nothing (or nonsense) is asked for", () => {
    expect(dayWindow(today, lastDay, undefined)).toEqual({ from: today, prevFrom: null, nextFrom: "2026-11-20" });
    expect(dayWindow(today, lastDay, "next tuesday").from).toBe(today);
  });

  it("never starts before today or after the last bookable day", () => {
    expect(dayWindow(today, lastDay, "2026-11-01").from).toBe(today);
    expect(dayWindow(today, lastDay, "2027-02-01").from).toBe(today);
  });

  it("goes back two weeks, but not past today", () => {
    expect(dayWindow(today, lastDay, "2026-11-20").prevFrom).toBe(today);
    expect(dayWindow(today, lastDay, "2026-11-30").prevFrom).toBe("2026-11-16");
  });

  it("has no later arrow when the next two weeks start past the last day", () => {
    expect(dayWindow(today, lastDay, "2026-12-25").nextFrom).toBeNull();
    expect(dayWindow(today, lastDay, "2026-12-20").nextFrom).toBe("2027-01-03");
  });
});

describe("date labels", () => {
  it("formats calendar dates without slipping a day", () => {
    expect(dayName.format(asUtc("2026-11-09"))).toBe("Mon");
    expect(longDay.format(asUtc("2026-11-09"))).toBe("Monday 9 November");
  });

  it("shows one month or a range", () => {
    expect(shownMonths("2026-11-02")).toBe("Nov 2026");
    expect(shownMonths("2026-11-20")).toMatch(/^Nov.+Dec 2026$/);
  });

  it("knows what a date looks like", () => {
    expect(isDate("2026-11-09")).toBe(true);
    expect(isDate("9 Nov")).toBe(false);
    expect(isDate(undefined)).toBe(false);
  });
});
