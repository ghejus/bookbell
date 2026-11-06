import { describe, expect, it } from "vitest";
import { formatDuration, formatMoney, formatPrice } from "./format";

// nb is a no-break space, so a number never wraps away from its unit.
const nb = String.fromCharCode(160);

describe("formatPrice", () => {
  it("writes euro before the amount and lei after it", () => {
    expect(formatPrice(2500, "EUR")).toBe("€25");
    expect(formatPrice(0, "RON")).toBe("Free");
    expect(formatPrice(2550, "EUR")).toBe("€25.50");
    expect(formatPrice(6000, "RON")).toBe(`60${nb}lei`);
    expect(formatPrice(4050, "RON")).toBe(`40.50${nb}lei`);
  });
  it("adds thousands separators", () => {
    expect(formatPrice(125000, "RON")).toBe(`1,250${nb}lei`);
  });
  it("shows nothing when there is no price", () => {
    expect(formatPrice(null, "EUR")).toBe("");
  });
});

describe("formatDuration", () => {
  it("reads like a person would say it", () => {
    expect(formatDuration(45)).toBe(`45${nb}min`);
    expect(formatDuration(60)).toBe(`1${nb}h`);
    expect(formatDuration(90)).toBe(`1${nb}h 30${nb}min`);
  });
});

describe("formatMoney", () => {
  it("shows zero as an amount, not as free", () => {
    expect(formatMoney(0, "EUR")).toBe("€0");
    expect(formatMoney(0, "RON")).toBe("0 lei");
    expect(formatMoney(4250, "EUR")).toBe("€42.50");
  });
});

describe("money in Romanian", () => {
  it("puts the euro sign after the amount and uses a decimal comma", () => {
    expect(formatPrice(33100, "EUR", "ro")).toBe(`331${nb}€`);
    expect(formatPrice(2550, "EUR", "ro")).toBe(`25,50${nb}€`);
    expect(formatPrice(4050, "RON", "ro")).toBe(`40,50${nb}lei`);
    expect(formatPrice(0, "EUR", "ro")).toBe("Gratuit");
    expect(formatMoney(0, "EUR", "ro")).toBe(`0${nb}€`);
  });
});
