import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

// The daily cleanup. Every "Try a demo shop" visitor gets their own account
// and sample shop; after 3 days nobody comes back to it, so it is deleted.
// Deleting the account deletes the shop, and the shop takes its services,
// hours, workers, bookings and links with it. Vercel calls this once a day
// (see vercel.json).
//
// It also removes waitlist wishes for days that have passed. (A day counts as
// passed once it is over everywhere: older than yesterday in UTC.)

const DAYS = 3;
const PER_RUN = 200;
const BUCKET = "shop-media"; // shop pictures (added in a later step)

export async function GET(request: Request) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set." }, { status: 503 });

  const { data, error } = await admin.rpc("old_demo_accounts", { p_days: DAYS, p_limit: PER_RUN });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const old = data as { user_id: string; shop_id: string | null }[] | null;

  let deleted = 0;
  let failed = 0;
  for (const { user_id, shop_id } of old ?? []) {
    // The shop's own pictures first (files are not removed with the rows).
    if (shop_id) {
      const { data: files } = await admin.storage.from(BUCKET).list(shop_id, { limit: 100 });
      if (files?.length) await admin.storage.from(BUCKET).remove(files.map((f) => `${shop_id}/${f.name}`));
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error(`cleanup: could not delete demo account ${user_id}:`, deleteError.message);
      failed += 1;
    } else {
      deleted += 1;
    }
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const { count: oldWishes } = await admin.from("waitlist").delete({ count: "exact" }).lt("day", yesterday);
  return NextResponse.json({ found: old?.length ?? 0, deleted, failed, oldWishes: oldWishes ?? 0 });
}
