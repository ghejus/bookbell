import { describe, expect, it } from "vitest";
import { change, comparisonEnd, periodFor, periodRange } from "./periods";

describe("periodFor", () => {
  // Friday 6 November 2026
  const today = "2026-11-06";

  it("finds this week, Monday to Sunday", () => {
    expect(periodFor("week", today)).toEqual({ from: "2026-11-02", to: "2026-11-09", label: "This week" });
    expect(periodFor("week", "2026-11-02").from).toBe("2026-11-02"); // a Monday
    expect(periodFor("week", "2026-11-08").from).toBe("2026-11-02"); // a Sunday
  });

  it("steps back whole weeks", () => {
    expect(periodFor("week", today, 1)).toEqual({ from: "2026-10-26", to: "2026-11-02", label: "Last week" });
    expect(periodFor("week", today, 2).label).toMatch(/^19.+25 Oct$/);
  });

  it("finds months, across the new year too", () => {
    expect(periodFor("month", today)).toEqual({ from: "2026-11-01", to: "2026-12-01", label: "This month" });
    expect(periodFor("month", today, 1).label).toBe("Last month");
    expect(periodFor("month", "2027-01-15", 2)).toEqual({ from: "2026-11-01", to: "2026-12-01", label: "November 2026" });
  });

  it("says which dates a period covers", () => {
    expect(periodRange("week", periodFor("week", today))).toMatch(/^2.+8 Nov$/);
    expect(periodRange("month", periodFor("month", today))).toBe("November 2026");
  });
});

describe("comparisons", () => {
  const day = 86_400_000;

  it("compares a running week with the same stretch of the week before", () => {
    const from = 7 * day;
    const prevFrom = 0;
    expect(comparisonEnd(prevFrom, 7 * day, from, from + 3 * day)).toBe(3 * day);
    expect(comparisonEnd(prevFrom, 7 * day, from, from + 30 * day)).toBe(7 * day);
  });

  it("puts the change in plain words", () => {
    expect(change(112, 100)).toBe("+12%");
    expect(change(95, 100)).toBe("−5%");
    expect(change(100, 100)).toBe("same");
    expect(change(0, 0)).toBe("same");
    expect(change(5, 0)).toBeNull();
  });
});
