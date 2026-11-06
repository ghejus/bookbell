import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// The front door after logging in, and where the home-screen app opens:
// shop owners go to their shop, everyone else to My bookings.
export async function GET(request: NextRequest) {
  const to = (path: string) => NextResponse.redirect(new URL(path, request.nextUrl.origin));
  if (!hasSupabaseEnv) return to("/");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return to("/login");
  const { data: shop } = await supabase.from("shops").select("id").eq("owner_id", userId).maybeSingle();
  return to(shop ? "/dashboard" : "/my");
}
