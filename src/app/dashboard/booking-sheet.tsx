import { ConfirmDelete } from "@/components/form";
import {
  CalendarBlankIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  PhoneIcon,
  ScissorsIcon,
  UserIcon,
  XIcon,
  type Icon,
} from "@/components/icons";
import { Sheet, SheetHeader } from "@/components/sheet";
import { Badge } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { emailMode } from "@/lib/email/send";
import { formatDuration, formatPrice } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { utcToZoned } from "@/lib/time";
import { cancelBooking } from "./actions";
import { MoveBookingForm } from "./calendar/panel-forms";

export const isBookingId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);

type Row = {
  id: string;
  status: "booked" | "cancelled";
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  staff_id: string;
  source: "online" | "owner";
  services: { name: string; price_cents: number | null } | null;
};

const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/**
 * One booking's details in a sheet: when, what, who, how to reach them, and
 * Move or Cancel. Opened by `?b=<id>` on Today, Calendar and Bookings.
 */
export async function BookingSheet({ id, closeHref, view = "day" }: { id: string; closeHref: string; view?: string }) {
  const { supabase, shop } = await requireShop();
  const [{ data: b }, { data: team }] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, status, starts_at, ends_at, customer_name, customer_email, customer_phone, staff_id, source, services(name, price_cents)")
      .eq("id", id)
      .eq("shop_id", shop.id)
      .maybeSingle<Row>(),
    supabase.from("staff").select("id, name, active").eq("shop_id", shop.id).order("created_at").returns<{ id: string; name: string; active: boolean }[]>(),
  ]);
  if (!b) return null;

  const tz = shop.timezone;
  const start = utcToZoned(new Date(b.starts_at), tz);
  const end = utcToZoned(new Date(b.ends_at), tz);
  const minutes = Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000);
  const today = shopToday(tz, new Date());
  const live = b.status === "booked";
  const upcoming = live && Date.parse(b.starts_at) > new Date().getTime();
  const staff = team ?? [];
  const worker = staff.find((w) => w.id === b.staff_id);
  const price = b.services ? formatPrice(b.services.price_cents, shop.currency) : "";

  const rows: { icon: Icon; text: string }[] = [
    { icon: CalendarBlankIcon, text: `${start.date === today ? "Today, " : ""}${longDay.format(asUtc(start.date))}` },
    { icon: ClockIcon, text: `${start.time}–${end.time}` },
    { icon: ScissorsIcon, text: [b.services?.name ?? "Booking", formatDuration(minutes), price].filter(Boolean).join(", ") },
    ...(staff.length > 1 && worker ? [{ icon: UserIcon, text: `With ${worker.name}` }] : []),
    ...(b.customer_email ? [{ icon: EnvelopeSimpleIcon, text: b.customer_email }] : []),
    ...(b.customer_phone ? [{ icon: PhoneIcon, text: b.customer_phone }] : []),
  ];
  const contact = "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium transition-colors duration-150 hover:bg-ink/7";
  const active = staff.filter((w) => w.active);

  return (
    <Sheet label={`Booking: ${b.customer_name}`} closeHref={closeHref}>
      <SheetHeader title={b.customer_name} closeHref={closeHref}>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={b.source === "owner" ? "neutral" : "brand"}>{b.source === "owner" ? "Added by you" : "Booked online"}</Badge>
          {!live ? <Badge tone="warning">Cancelled</Badge> : null}
        </span>
      </SheetHeader>
      <div className="space-y-4">
        <ul>
          {rows.map((r) => (
            <li key={r.text} className="rule-top flex items-center gap-3 py-[11px] text-[15px]">
              <r.icon aria-hidden className="size-[18px] shrink-0 text-neutral-500" />
              <span className="min-w-0 tabular wrap-anywhere">{r.text}</span>
            </li>
          ))}
        </ul>

        {b.customer_phone || b.customer_email ? (
          <div className="flex gap-2">
            {b.customer_phone ? (
              <a href={`tel:${b.customer_phone.replace(/[^\d+]/g, "")}`} className={contact}>
                <PhoneIcon aria-hidden className="size-[17px]" />
                Call
              </a>
            ) : null}
            {b.customer_email ? (
              <a href={`mailto:${b.customer_email}`} className={contact}>
                <EnvelopeSimpleIcon aria-hidden className="size-[17px]" />
                Email
              </a>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-neutral-400">No contact details for this booking.</p>
        )}

        {live ? (
          <div className="rule-top pt-4">
            <h3 className="mb-3 text-sm font-medium">Move</h3>
            <MoveBookingForm
              key={`${b.id}-${b.starts_at}-${b.staff_id}`}
              bookingId={b.id}
              staff={active.length ? active : staff}
              date={start.date}
              time={start.time}
              staffId={b.staff_id}
              view={view}
            />
          </div>
        ) : null}

        {upcoming ? (
          <form action={cancelBooking} className="rule-top space-y-2 pt-4">
            <input type="hidden" name="id" value={b.id} />
            <input type="hidden" name="back" value={closeHref} />
            <ConfirmDelete wide label={`Cancel ${b.customer_name}’s booking`} confirmText="Cancel? Tap again to confirm" busyText="Cancelling…">
              <XIcon aria-hidden className="size-4" />
              Cancel booking
            </ConfirmDelete>
            <p className="text-[13px] text-neutral-400">
              {b.customer_email && emailMode() === "gmail"
                ? "Cancelling frees the time for others and emails the customer."
                : "Cancelling frees the time for others. Please let the customer know."}
            </p>
          </form>
        ) : null}
      </div>
    </Sheet>
  );
}
