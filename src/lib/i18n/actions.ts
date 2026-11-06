"use server";

import { cookies } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { isLang, LANG_COOKIE } from "./config";

/**
 * The EN · RO switch: remembers the visitor's choice for a year. A shop owner's
 * choice is also saved on their shop, so the emails they get match it.
 */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (!hasSupabaseEnv) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  // The database locks (RLS) only let owners change their own shop.
  if (userId) await supabase.from("shops").update({ lang }).eq("owner_id", userId);
}
