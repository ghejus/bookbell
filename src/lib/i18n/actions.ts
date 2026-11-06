"use server";

import { cookies } from "next/headers";
import { translateDemoShop } from "@/lib/demo";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { FIRST_WORKER, isLang, LANG_COOKIE, LANGS } from "./config";

/**
 * The EN · RO switch: remembers the visitor's choice for a year. A shop owner's
 * choice is also saved on their shop, so the emails they get match it. Words
 * the app saved for them (a demo shop's samples, the first worker "Me") switch
 * language too; words the owner typed themselves stay as they are.
 */
export async function setLanguage(lang: string) {
  if (!isLang(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (!hasSupabaseEnv) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return;
  // The database locks (RLS) only let owners change their own shop.
  const { data: shop } = await supabase.from("shops").update({ lang }).eq("owner_id", userId).select("id").maybeSingle();
  if (!shop) return;
  const other = LANGS.find((l) => l !== lang) ?? lang;
  await Promise.all([
    supabase.from("staff").update({ name: FIRST_WORKER[lang] }).eq("shop_id", shop.id).eq("name", FIRST_WORKER[other]),
    data.claims.is_anonymous === true ? translateDemoShop(userId, lang).catch((e) => console.error(e)) : null,
  ]);
}
