import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import type { Currency } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type Shop = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: Currency;
  about: string;
  address: string;
  phone: string;
};

/**
 * The signed-in owner, or a trip to the log-in page. Checks the login token for real.
 * Wrapped in cache() so the menu, sidebar and page share one check per request.
 */
export const requireUser = cache(async () => {
  // Always decide per visit, never once at build time.
  await connection();
  // Before Supabase is connected, the home page shows setup help instead.
  if (!hasSupabaseEnv) redirect("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  return { supabase, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

/** The owner's shop, or null if they haven't made one yet. */
export const getMyShop = cache(async () => {
  const { supabase, userId, email } = await requireUser();
  const { data: shop, error } = await supabase
    .from("shops")
    .select("id, owner_id, name, slug, timezone, currency, about, address, phone")
    .eq("owner_id", userId)
    .maybeSingle<Shop>();
  if (error) throw new Error(`Could not load your shop: ${error.message}`);
  return { supabase, userId, email, shop };
});

/** Like getMyShop, but sends people without a shop back to the dashboard to make one. */
export async function requireShop() {
  const result = await getMyShop();
  if (!result.shop) redirect("/dashboard");
  return { ...result, shop: result.shop };
}
