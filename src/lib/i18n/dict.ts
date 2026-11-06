import type { Lang } from "./config";
import { en, type Dict } from "./en";
import { ro } from "./ro";

// Both word lists. Small enough to ship to the browser for the parts that run there.

const dicts: Record<Lang, Dict> = { en, ro };

export const dictFor = (lang: Lang): Dict => dicts[lang];

export type { Dict };

/** Plain words for a database error code, in the visitor's language. */
export function errorText(lang: Lang, code: string | undefined, fallback?: string): string {
  const d = dicts[lang];
  return (code && d.errors[code]) || fallback || d.common.somethingWrong;
}
