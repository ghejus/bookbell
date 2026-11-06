import { describe, expect, it } from "vitest";
import {
  credentialsSchema,
  openingHoursSchema,
  safeNextPath,
  serviceSchema,
  shopSchema,
  slugify,
  timeOffSchema,
} from "./validation";

describe("credentialsSchema", () => {
  it("cleans up the email", () => {
    const r = credentialsSchema.parse({ email: "  Ana@Example.COM ", password: "longenough" });
    expect(r.email).toBe("ana@example.com");
  });
  it("rejects short passwords", () => {
    expect(credentialsSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("shopSchema", () => {
  const good = { name: "Bob's Barber", slug: "bobs-barber", timezone: "Europe/Bucharest", currency: "RON", about: "", address: "", phone: "" };
  it("accepts a normal shop", () => {
    expect(shopSchema.safeParse(good).success).toBe(true);
  });
  it("rejects bad web addresses", () => {
    for (const slug of ["ab", "Bob Barber", "bob--barber", "-bob", "bob_barber"]) {
      expect(shopSchema.safeParse({ ...good, slug }).success, slug).toBe(false);
    }
  });
  it("rejects unknown time zones", () => {
    expect(shopSchema.safeParse({ ...good, timezone: "Nowhere/City" }).success).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("turns prices into cents", () => {
    expect(serviceSchema.parse({ name: "Cut", duration_minutes: "30", price_cents: "25.50" }).price_cents).toBe(2550);
    expect(serviceSchema.parse({ name: "Cut", duration_minutes: "30", price_cents: "40,5" }).price_cents).toBe(4050);
    expect(serviceSchema.parse({ name: "Cut", duration_minutes: "30", price_cents: "" }).price_cents).toBeNull();
  });
  it("rejects silly prices and durations", () => {
    expect(serviceSchema.safeParse({ name: "Cut", duration_minutes: "30", price_cents: "-5" }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: "Cut", duration_minutes: "2", price_cents: "" }).success).toBe(false);
    expect(serviceSchema.safeParse({ name: "Cut", duration_minutes: "30.5", price_cents: "" }).success).toBe(false);
  });
});

describe("openingHoursSchema", () => {
  it("needs closing after opening", () => {
    expect(openingHoursSchema.safeParse({ weekday: "1", opens: "09:00", closes: "17:00" }).success).toBe(true);
    expect(openingHoursSchema.safeParse({ weekday: "1", opens: "17:00", closes: "09:00" }).success).toBe(false);
    expect(openingHoursSchema.safeParse({ weekday: "8", opens: "09:00", closes: "17:00" }).success).toBe(false);
  });
});

describe("timeOffSchema", () => {
  it("reads the times in the shop's time zone", () => {
    const r = timeOffSchema("Europe/Bucharest").parse({ starts_at: "2026-12-24T09:00", ends_at: "2026-12-26T18:00", reason: "" });
    expect(r.starts_at.toISOString()).toBe("2026-12-24T07:00:00.000Z");
  });
  it("rejects an end before the start", () => {
    const r = timeOffSchema("Europe/Bucharest").safeParse({ starts_at: "2026-12-24T09:00", ends_at: "2026-12-24T08:00", reason: "" });
    expect(r.success).toBe(false);
  });
});

describe("slugify", () => {
  it("makes a clean web address", () => {
    expect(slugify("Bob's Barber Shop!")).toBe("bobs-barber-shop");
    expect(slugify("  Frizerie Ștefan & Fiii ")).toBe("frizerie-stefan-fiii");
  });
});

describe("safeNextPath", () => {
  it("only allows pages on our own site", () => {
    expect(safeNextPath("/dashboard/services")).toBe("/dashboard/services");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.example")).toBe("/dashboard");
    expect(safeNextPath("/ok\\..\\evil")).toBe("/dashboard");
    expect(safeNextPath("/\t/evil.example")).toBe("/dashboard");
    expect(safeNextPath("/\n/evil.example")).toBe("/dashboard");
    expect(safeNextPath(null)).toBe("/dashboard");
  });
});

describe("form error sentences", () => {
  it("never shows zod's own English, and names the field", async () => {
    const { firstError, serviceSchema, shopSchema } = await import("./validation");
    const { ownerT } = await import("./i18n/owner");
    const empty = serviceSchema.safeParse({ name: "", duration_minutes: "30", price_cents: "" });
    expect(empty.success).toBe(false);
    if (empty.success) return;
    expect(firstError(empty.error)).toBe("Please fill in “Name”.");
    expect(firstError(empty.error, ownerT("ro"))).toBe("Te rugăm să completezi „Nume”.");

    const long = shopSchema.safeParse({ name: "Ana", slug: "ana", timezone: "Europe/Bucharest", currency: "RON", about: "", address: "x".repeat(201), phone: "" });
    expect(long.success).toBe(false);
    if (long.success) return;
    expect(firstError(long.error, ownerT("ro"))).toBe("„Adresă” poate avea cel mult 200 de caractere.");
  });
});
