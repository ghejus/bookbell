import { describe, expect, it } from "vitest";
import { langFor, pickLang, splitLangPath } from "./config";
import { en } from "./en";
import { ro, roCount } from "./ro";

/** Every key path in a word list, with what kind of thing it is ("string", "function", …). */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((v, i) => shape(v, `${path}[${i}]`))];
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => shape(v, path ? `${path}.${k}` : k));
  return [`${path}:${typeof value}`];
}

/** Every plain string in a word list. */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("word lists", () => {
  it("English and Romanian have exactly the same entries", () => {
    expect(shape(ro).sort()).toEqual(shape(en).sort());
  });

  it("have no empty words", () => {
    expect(strings(en).filter((s) => !s.trim())).toEqual([]);
    expect(strings(ro).filter((s) => !s.trim())).toEqual([]);
  });

  it("Romanian functions give the same kind of answers", () => {
    expect(ro.common.bookAt("10:30")).toContain("10:30");
    expect(ro.days.free("Luni", 3)).toBe("Luni, 3 ore libere");
    expect(ro.reviews.count(23)).toBe("23 de recenzii");
  });
});

describe("Romanian counting", () => {
  it("adds 'de' from 20 on", () => {
    expect(roCount(1, "recenzie", "recenzii")).toBe("1 recenzie");
    expect(roCount(2, "recenzie", "recenzii")).toBe("2 recenzii");
    expect(roCount(19, "recenzie", "recenzii")).toBe("19 recenzii");
    expect(roCount(20, "recenzie", "recenzii")).toBe("20 de recenzii");
    expect(roCount(101, "recenzie", "recenzii")).toBe("101 recenzii");
    expect(roCount(0, "recenzie", "recenzii")).toBe("0 recenzii");
  });
});

describe("picking the language", () => {
  it("follows the phone's list, highest weight first", () => {
    expect(pickLang("ro-RO,ro;q=0.9,en;q=0.8")).toBe("ro");
    expect(pickLang("en-GB,en;q=0.9,ro;q=0.8")).toBe("en");
    expect(pickLang("de-DE,ro;q=0.7,en;q=0.5")).toBe("ro");
    expect(pickLang("en;q=0.3,ro;q=0.9")).toBe("ro");
  });

  it("falls back to English", () => {
    expect(pickLang(null)).toBe("en");
    expect(pickLang("")).toBe("en");
    expect(pickLang("fr-FR,de;q=0.5")).toBe("en");
    expect(pickLang("ro;q=0")).toBe("en");
  });

  it("puts the visitor's own choice first", () => {
    expect(langFor("en", "ro-RO")).toBe("en");
    expect(langFor("ro", "en-US")).toBe("ro");
    expect(langFor("xx", "ro-RO")).toBe("ro");
    expect(langFor(undefined, undefined as unknown as null)).toBe("en");
  });

  it("reads a language at the start of an address", () => {
    expect(splitLangPath("/ro/s/shop")).toEqual({ lang: "ro", rest: "/s/shop" });
    expect(splitLangPath("/en")).toEqual({ lang: "en", rest: "/" });
    expect(splitLangPath("/s/romania")).toEqual({ lang: null, rest: "/s/romania" });
    expect(splitLangPath("/rome")).toEqual({ lang: null, rest: "/rome" });
  });
});
