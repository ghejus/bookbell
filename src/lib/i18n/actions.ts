"use server";

import { cookies } from "next/headers";
import { isLang, LANG_COOKIE } from "./config";

/** The EN · RO switch: remembers the visitor's choice for a year. */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
