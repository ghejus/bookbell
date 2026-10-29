import { describe, expect, it } from "vitest";
import { isValidTimeZone, utcToZoned, zonedToUtc } from "./time";

describe("zonedToUtc", () => {
  it("converts winter time in Bucharest (UTC+2)", () => {
    expect(zonedToUtc("2026-11-02", "09:00", "Europe/Bucharest").toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("converts summer time in Bucharest (UTC+3)", () => {
    expect(zonedToUtc("2026-07-15", "09:00", "Europe/Bucharest").toISOString()).toBe("2026-07-15T06:00:00.000Z");
  });

  it("works for a zone behind UTC", () => {
    expect(zonedToUtc("2026-01-10", "18:30", "America/New_York").toISOString()).toBe("2026-01-10T23:30:00.000Z");
  });

  it("moves a time that doesn't exist (clocks jump forward) to a real time", () => {
    // 29 March 2026, 03:00 -> 04:00 in Bucharest, so 03:30 never happens.
    const result = zonedToUtc("2026-03-29", "03:30", "Europe/Bucharest");
    expect(utcToZoned(result, "Europe/Bucharest")).toEqual({ date: "2026-03-29", time: "04:30" });
  });

  it("round-trips with utcToZoned", () => {
    const moment = zonedToUtc("2026-12-31", "23:45", "Asia/Tokyo");
    expect(utcToZoned(moment, "Asia/Tokyo")).toEqual({ date: "2026-12-31", time: "23:45" });
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects made-up ones", () => {
    expect(isValidTimeZone("Europe/Bucharest")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});
