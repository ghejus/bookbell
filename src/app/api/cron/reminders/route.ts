import { NextResponse, type NextRequest } from "next/server";
import { sendReminderEmail, sendReviewAskEmail } from "@/lib/booking-emails";
import { isCronRequest } from "@/lib/cron";
import { isTestAddress } from "@/lib/email/addresses";
import { siteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

// The daily reminder emails. Vercel calls this once a day (see vercel.json)
// with "Authorization: Bearer <CRON_SECRET>"; anyone else gets turned away.
//
// It runs at 15:00 UTC (17:00 in Bucharest in winter), so "12 to 36 hours from
// now" covers all of tomorrow's opening hours. Each booking gets one reminder:
// reminder_sent_at is set before sending, so two runs at once can't both send.
//
// The same run sends "How was it?" for visits that ended 12 to 36 hours ago
// (yesterday's), once each (review_asked_at), only for online bookings that
// went ahead and have no review yet.

const HOUR = 3_600_000;

export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "SUPABASE_SECRET_KEY is not set." }, { status: 503 });

  const now = Date.now();
  const { data: due, error } = await admin
    .from("bookings")
    .select("id, customer_email")
    .eq("status", "booked")
    .is("reminder_sent_at", null)
    .gte("starts_at", new Date(now + 12 * HOUR).toISOString())
    .lt("starts_at", new Date(now + 36 * HOUR).toISOString())
    .order("starts_at")
    .limit(200)
    .returns<{ id: string; customer_email: string }[]>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const site = await siteUrl();
  const counts: Record<string, number> = {};
  for (const booking of due ?? []) {
    // Claim it first, so it is never reminded twice.
    const { data: claimed } = await admin
      .from("bookings")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", booking.id)
      .is("reminder_sent_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    let result: string;
    if (isTestAddress(booking.customer_email)) {
      result = "skipped";
    } else {
      const { data: token, error: tokenError } = await admin.rpc("issue_manage_token", { p_booking_id: booking.id });
      result = tokenError || typeof token !== "string" ? "failed" : await sendReminderEmail(token, site);
    }
    counts[result] = (counts[result] ?? 0) + 1;
  }
  const asks = await askForReviews(admin, site, now);
  return NextResponse.json({ checked: due?.length ?? 0, ...counts, reviewAsks: asks });
}

async function askForReviews(admin: NonNullable<ReturnType<typeof createAdminClient>>, site: string, now: number) {
  const { data: visits, error } = await admin
    .from("bookings")
    .select("id, customer_email, reviews(id)")
    .eq("status", "booked")
    .eq("source", "online")
    .is("review_asked_at", null)
    .neq("customer_email", "")
    .gte("ends_at", new Date(now - 36 * HOUR).toISOString())
    .lt("ends_at", new Date(now - 12 * HOUR).toISOString())
    .order("ends_at")
    .limit(200)
    .returns<{ id: string; customer_email: string; reviews: { id: string } | null }[]>();
  if (error) return { error: error.message };

  const counts: Record<string, number> = {};
  for (const visit of visits ?? []) {
    if (visit.reviews) continue;
    const { data: claimed } = await admin
      .from("bookings")
      .update({ review_asked_at: new Date().toISOString() })
      .eq("id", visit.id)
      .is("review_asked_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    let result: string;
    if (isTestAddress(visit.customer_email)) {
      result = "skipped";
    } else {
      const { data: token, error: tokenError } = await admin.rpc("issue_manage_token", { p_booking_id: visit.id });
      result = tokenError || typeof token !== "string" ? "failed" : await sendReviewAskEmail(token, site);
    }
    counts[result] = (counts[result] ?? 0) + 1;
  }
  return { checked: visits?.length ?? 0, ...counts };
}
