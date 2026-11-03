import "server-only";
import { createClient as createPlainClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Currency } from "@/lib/format";
import { buildIcs } from "@/lib/ics";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "./email/send";
import {
  cancelledEmail,
  confirmationEmail,
  movedEmail,
  ownerNoteEmail,
  reminderEmail,
  type BookingInfo,
} from "./email/templates";

// Which emails go out when something happens to a booking. Every function here
// is safe to run after the page has answered (inside next/server's after()):
// it never throws, and a failed email never undoes a booking.

/** What get_booking_by_token returns. */
export type TokenRow = {
  booking_id: string;
  status: "booked" | "cancelled";
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  service_id: string;
  service_name: string;
  duration_minutes: number;
  price_cents: number | null;
  staff_id: string;
  staff_name: string;
  team_size: number;
  shop_id: string;
  shop_slug: string;
  shop_name: string;
  shop_address: string;
  shop_phone: string;
  shop_timezone: string;
  shop_currency: Currency;
};

/** A database client with no login, for the public token functions. */
function publicClient() {
  return createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** One booking, read with its secret link token. Null for an unknown token. */
export async function bookingByToken(token: string, db: SupabaseClient = publicClient()) {
  const { data } = await db.rpc("get_booking_by_token", { p_token: token }).maybeSingle<TokenRow>();
  return data ?? null;
}

export function toBookingInfo(row: TokenRow, manageUrl?: string): BookingInfo {
  return {
    bookingId: row.booking_id,
    customerName: row.customer_name,
    serviceName: row.service_name,
    durationMinutes: row.duration_minutes,
    priceCents: row.price_cents,
    currency: row.shop_currency,
    staffName: row.team_size > 1 ? row.staff_name : null,
    startsAt: row.starts_at,
    timezone: row.shop_timezone,
    shopName: row.shop_name,
    shopAddress: row.shop_address,
    shopPhone: row.shop_phone,
    manageUrl,
  };
}

/** The shop owner's email, or null (no server key, or a demo shop with no email). */
export async function ownerEmail(shopId: string): Promise<string | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: shop } = await admin.from("shops").select("owner_id").eq("id", shopId).maybeSingle<{ owner_id: string }>();
  if (!shop) return null;
  const { data } = await admin.auth.admin.getUserById(shop.owner_id);
  const user = data?.user;
  return user && !user.is_anonymous && user.email ? user.email : null;
}

function calendarFile(info: BookingInfo) {
  return {
    filename: "booking.ics",
    contentType: "text/calendar; charset=utf-8",
    content: buildIcs({
      start: info.startsAt,
      minutes: info.durationMinutes,
      title: info.serviceName,
      location: info.shopAddress,
      shopName: info.shopName,
      uid: info.bookingId,
    }),
  };
}

/**
 * After a new booking: "you're booked" to the customer, and a note to the owner
 * (unless the owner made the booking themselves).
 */
export async function sendBookingEmails(token: string, site: string, { notifyOwner = true } = {}) {
  try {
    const row = await bookingByToken(token);
    if (!row) return;
    const info = toBookingInfo(row, `${site}/b/${token}`);
    const owner = await ownerEmail(row.shop_id);
    const mail = confirmationEmail(info);
    await Promise.all([
      sendEmail({ to: row.customer_email, ...mail, replyTo: owner ?? undefined, attachments: [calendarFile(info)] }),
      owner && notifyOwner
        ? sendEmail({ to: owner, ...ownerNoteEmail(info, "new", { email: row.customer_email, phone: row.customer_phone }, `${site}/dashboard/bookings`) })
        : null,
    ]);
  } catch (error) {
    console.error("[email] booking emails failed:", error instanceof Error ? error.message : error);
  }
}

/** After the customer moved or cancelled through their link: tell them, and tell the owner. */
export async function sendCustomerChangeEmails(token: string, what: "moved" | "cancelled", site: string) {
  try {
    const row = await bookingByToken(token);
    if (!row) return;
    const info = toBookingInfo(row, what === "moved" ? `${site}/b/${token}` : undefined);
    const owner = await ownerEmail(row.shop_id);
    const mail = what === "moved" ? movedEmail(info) : cancelledEmail(info, "customer", `${site}/s/${row.shop_slug}`);
    await Promise.all([
      sendEmail({
        to: row.customer_email,
        ...mail,
        replyTo: owner ?? undefined,
        attachments: what === "moved" ? [calendarFile(info)] : undefined,
      }),
      owner
        ? sendEmail({ to: owner, ...ownerNoteEmail(info, what, { email: row.customer_email, phone: row.customer_phone }, `${site}/dashboard/bookings`) })
        : null,
    ]);
  } catch (error) {
    console.error("[email] change emails failed:", error instanceof Error ? error.message : error);
  }
}

/** A booking as the owner's dashboard reads it (row locks allow the owner to). */
export type OwnerBookingRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  services: { name: string; price_cents: number | null } | null;
  staff: { name: string } | null;
};

/** After the shop cancelled or moved a booking: tell the customer. */
export async function sendShopChangeEmail(
  what: "cancelled" | "moved",
  b: OwnerBookingRow,
  shop: { id: string; name: string; slug: string; address: string; phone: string; timezone: string; currency: Currency },
  teamSize: number,
  site: string,
) {
  try {
    const info: BookingInfo = {
      bookingId: b.id,
      customerName: b.customer_name,
      serviceName: b.services?.name ?? "Booking",
      durationMinutes: Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000),
      priceCents: b.services?.price_cents ?? null,
      currency: shop.currency,
      staffName: teamSize > 1 ? (b.staff?.name ?? null) : null,
      startsAt: b.starts_at,
      timezone: shop.timezone,
      shopName: shop.name,
      shopAddress: shop.address,
      shopPhone: shop.phone,
    };
    const owner = await ownerEmail(shop.id);
    const mail = what === "moved" ? movedEmail(info) : cancelledEmail(info, "shop", `${site}/s/${shop.slug}`);
    await sendEmail({
      to: b.customer_email,
      ...mail,
      replyTo: owner ?? undefined,
      attachments: what === "moved" ? [calendarFile(info)] : undefined,
    });
  } catch (error) {
    console.error("[email] shop-change email failed:", error instanceof Error ? error.message : error);
  }
}

/** The daily reminder email for one booking, with a fresh private link. */
export async function sendReminderEmail(token: string, site: string) {
  const row = await bookingByToken(token);
  if (!row || row.status !== "booked") return "skipped" as const;
  const info = toBookingInfo(row, `${site}/b/${token}`);
  const owner = await ownerEmail(row.shop_id);
  return sendEmail({ to: row.customer_email, ...reminderEmail(info), replyTo: owner ?? undefined });
}
