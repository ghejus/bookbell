import "server-only";
import { createClient } from "@supabase/supabase-js";

// The server's own Supabase key (SUPABASE_SECRET_KEY). It skips the row locks,
// so it is only used for jobs no visitor can trigger with their own data:
// the daily reminder emails, the daily email limit, and looking up a shop
// owner's email address. Never import this into code that runs in the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
