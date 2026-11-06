import type { Lang } from "./config";
import { OWNER_RO } from "./owner-ro";

// Words on the owner's screens. Here the English sentence itself is the key
// (the "gettext" way): code writes o("Saved.") and Romanian comes from
// owner-ro.ts. A test (owner.test.ts) scans the owner code and fails if a
// sentence has no Romanian version. Missing ones fall back to English.
//
// Names and numbers go in {braces}: o("Added {name}.", { name }).
// Counts use o.n(count, "{n} booking", "{n} bookings"); in owner-ro.ts the
// key is both forms joined by "|", and the value has three Romanian forms
// ("{n} programare|{n} programări|{n} de programări").

type Vars = Record<string, string | number>;

export type OwnerT = {
  (text: string, vars?: Vars): string;
  /** A count: "1 booking", "3 bookings" (Romanian: 1 programare, 3 programări, 20 de programări). */
  n: (count: number, one: string, many: string, vars?: Vars) => string;
  lang: Lang;
};

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all)) : text);

const roRules = new Intl.PluralRules("ro");

export function ownerT(lang: Lang): OwnerT {
  const o = ((text: string, vars?: Vars) => fill(lang === "ro" ? (OWNER_RO[text] ?? text) : text, vars)) as OwnerT;
  o.n = (count, one, many, vars) => {
    const all = { n: count, ...vars };
    if (lang !== "ro") return fill(count === 1 ? one : many, all);
    const forms = OWNER_RO[`${one}|${many}`]?.split("|");
    if (!forms) return fill(count === 1 ? one : many, all);
    const kind = roRules.select(count);
    return fill(kind === "one" ? forms[0] : kind === "few" ? forms[1] : (forms[2] ?? forms[1]), all);
  };
  o.lang = lang;
  return o;
}

/**
 * Marks a sentence for translation where it is written down but shown later
 * (like a form-check message passed to firstError). Returns it unchanged; the
 * owner.test.ts scan uses it to know the sentence needs Romanian.
 */
export const mark = (text: string) => text;
