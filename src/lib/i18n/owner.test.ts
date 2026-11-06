import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ownerT } from "./owner";
import { OWNER_RO } from "./owner-ro";

// Every sentence the owner screens wrap in o("…"), o.n(…) or mark("…") must
// have a Romanian version in owner-ro.ts.

const ROOTS = ["src/app/[lang]/dashboard", "src/lib", "src/components"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const str = String.raw`"((?:[^"\\]|\\.)*)"`;
function sentences(source: string): string[] {
  const found: string[] = [];
  // o("…"), mark("…"), and page titles like (await getOwnerT())("…")
  for (const m of source.matchAll(new RegExp(String.raw`(?:\bo|\bmark|OwnerT\(\)\))\(\s*${str}`, "g"))) found.push(m[1]);
  for (const m of source.matchAll(new RegExp(String.raw`\bo\.n\(\s*[^,]+,\s*${str},\s*${str}`, "g"))) found.push(`${m[1]}|${m[2]}`);
  return found.map((s) => s.replace(/\\"/g, '"'));
}

const used = [...new Set(ROOTS.flatMap(files).flatMap((f) => sentences(readFileSync(f, "utf8"))))];

describe("owner screens in Romanian", () => {
  it("finds the sentences to check", () => {
    expect(used.length).toBeGreaterThan(50);
  });

  it("has a Romanian version of every sentence", () => {
    expect(used.filter((s) => !(s in OWNER_RO))).toEqual([]);
  });

  it("keeps the {names} in every Romanian sentence", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const broken = Object.entries(OWNER_RO).filter(([en, ro]) => ro.split("|").some((form) => names(form).join() !== [...new Set(names(en.split("|")[0]))].join()));
    expect(broken).toEqual([]);
  });

  it("counts in Romanian", () => {
    const o = ownerT("ro");
    const key = "{n} booking|{n} bookings";
    if (key in OWNER_RO) {
      expect(o.n(1, "{n} booking", "{n} bookings")).toBe("1 programare");
      expect(o.n(20, "{n} booking", "{n} bookings")).toBe("20 de programări");
    }
    expect(ownerT("en").n(2, "{n} booking", "{n} bookings")).toBe("2 bookings");
  });
});
