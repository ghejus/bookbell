// The languages Bookbell speaks, and how a visitor's language is picked.
// No server-only code here: the proxy, server pages and browser code all use it.

export const LANGS = ["en", "ro"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "en";

/** The visitor's own choice, set by the EN · RO switch. */
export const LANG_COOKIE = "lang";
/** The proxy passes the picked language to server code in this request header. */
export const LANG_HEADER = "x-bookbell-lang";

export const LANG_NAMES: Record<Lang, string> = { en: "English", ro: "Română" };

export const isLang = (v: unknown): v is Lang => typeof v === "string" && (LANGS as readonly string[]).includes(v);

/**
 * The best language from the browser's list, e.g. "ro-RO,ro;q=0.9,en;q=0.8" -> "ro".
 * Highest weight wins; on a tie, the one listed first. Nothing we speak -> English.
 */
export function pickLang(acceptLanguage: string | null | undefined): Lang {
  if (!acceptLanguage) return DEFAULT_LANG;
  const wanted = acceptLanguage
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const weight = q ? Number.parseFloat(q.slice(2)) : 1;
      return { base: tag.split("-")[0], weight: Number.isFinite(weight) ? weight : 0, i };
    })
    .filter((w) => w.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.i - b.i);
  return wanted.map((w) => w.base).find(isLang) ?? DEFAULT_LANG;
}

/** The language for a request: the visitor's own choice first, then their browser's list. */
export function langFor(cookieValue: string | undefined, acceptLanguage: string | null): Lang {
  return isLang(cookieValue) ? cookieValue : pickLang(acceptLanguage);
}

/** Splits "/ro/s/shop" into "ro" and "/s/shop"; plain paths have no language. */
export function splitLangPath(path: string): { lang: Lang | null; rest: string } {
  const first = path.split("/")[1];
  if (isLang(first)) return { lang: first, rest: path.slice(first.length + 1) || "/" };
  return { lang: null, rest: path };
}
