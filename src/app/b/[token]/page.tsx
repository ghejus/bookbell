import { CalendarCheck, CalendarX, ChevronLeft, ChevronRight, CircleCheck, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, buttonClass, Card, EmptyState, Logo, PageSkeleton } from "@/components/ui";
import { whenLabel } from "@/lib/assistant/facts";
import { getAvailability, getPublicShop, shopToday } from "@/lib/booking";
import { bookingByToken, toBookingInfo } from "@/lib/booking-emails";
import { serviceLine } from "@/lib/email/templates";
import { addDays } from "@/lib/slots";
import { CancelForm, MoveForm } from "./manage-forms";

// The customer's private booking page, reached from the link in their emails
// and on the booking receipt. The secret token in the address is the only key.

export const metadata: Metadata = {
  title: "Your booking",
  // Private pages never belong in search results.
  robots: { index: false, follow: false },
};

const DAYS_SHOWN = 14;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
const dayNum = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });
const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function BrokenLink() {
  return (
    <Card>
      <EmptyState icon={CalendarX} title="This link doesn’t work" as="h1">
        It may be mistyped or very old. Please check the newest email about your booking, or call the shop.
      </EmptyState>
    </Card>
  );
}

async function ManageBooking({ params, searchParams }: PageProps<"/b/[token]">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  // The booking can change at any moment, so this always reads it fresh.
  await connection();
  if (!/^[0-9a-f]{48}$/.test(token)) return <BrokenLink />;
  const row = await bookingByToken(token);
  if (!row) return <BrokenLink />;

  const info = toBookingInfo(row);
  const now = new Date();
  const live = row.status === "booked" && Date.parse(row.starts_at) > now.getTime();
  const done = query.done === "moved" || query.done === "cancelled" ? query.done : null;
  const moving = live && query.move === "1";
  const base = `/b/${token}`;

  // The "pick a new time" part: same worker, same service, the shop's normal rules.
  let picker: React.ReactNode = null;
  if (moving) {
    const data = await getPublicShop(row.shop_slug);
    if (data) {
      const today = shopToday(row.shop_timezone, now);
      const lastDay = addDays(today, data.shop.booking_window_days);
      const from = isDate(query.from) && query.from > today && query.from <= lastDay ? query.from : today;
      const prevFrom = from > today ? (addDays(from, -DAYS_SHOWN) < today ? today : addDays(from, -DAYS_SHOWN)) : null;
      const nextFrom = addDays(from, DAYS_SHOWN) <= lastDay ? addDays(from, DAYS_SHOWN) : null;
      const service = { id: row.service_id, name: row.service_name, duration_minutes: row.duration_minutes, price_cents: row.price_cents };
      const days = await getAvailability(data, service, from, DAYS_SHOWN, now, row.staff_id, {
        staffId: row.staff_id,
        startsAt: row.starts_at,
      });
      const chosen =
        (isDate(query.date) ? days.find((d) => d.date === query.date && d.slots.length > 0) : undefined) ??
        days.find((d) => d.slots.length > 0);
      const link = (q: Record<string, string | null | undefined>) => {
        const p = new URLSearchParams({ move: "1" });
        for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
        return `${base}?${p}`;
      };

      picker = (
        <section aria-labelledby="move-title" className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="move-title" className="text-base font-semibold text-gray-900">
              Pick a new time
            </h2>
            <div className="flex items-center gap-1">
              {prevFrom ? (
                <Link href={link({ from: prevFrom === today ? null : prevFrom })} scroll={false} aria-label="Earlier days" className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
                  <ChevronLeft aria-hidden className="size-4.5" />
                </Link>
              ) : null}
              {nextFrom ? (
                <Link href={link({ from: nextFrom })} scroll={false} aria-label="Later days" className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
                  <ChevronRight aria-hidden className="size-4.5" />
                </Link>
              ) : null}
            </div>
          </div>
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
            {days.map((d) => {
              const open = d.slots.length > 0;
              const active = d.date === chosen?.date;
              const inner = (
                <>
                  <span className="text-xs font-medium">{dayName.format(asUtc(d.date))}</span>
                  <span className="text-lg font-semibold tabular">{dayNum.format(asUtc(d.date))}</span>
                </>
              );
              return (
                <li key={d.date} className="shrink-0">
                  {open ? (
                    <Link
                      href={link({ from: from === today ? null : from, date: d.date })}
                      scroll={false}
                      aria-current={active ? "date" : undefined}
                      aria-label={`${longDay.format(asUtc(d.date))}, ${d.slots.length} free times`}
                      className={`flex h-16 w-14 flex-col items-center justify-center rounded-lg border transition-colors duration-150 sm:w-full ${
                        active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-900 hover:border-gray-400"
                      }`}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span
                      aria-label={`${longDay.format(asUtc(d.date))}, no free times`}
                      className="flex h-16 w-14 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-600 sm:w-full"
                    >
                      {inner}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {chosen ? (
            <Card className="p-5 sm:p-6">
              <MoveForm key={chosen.date} token={token} slots={chosen.slots} dayLabel={longDay.format(asUtc(chosen.date))} />
            </Card>
          ) : (
            <Card>
              <EmptyState icon={CalendarX} title="No free times in these two weeks">
                {nextFrom ? "Try the later days with the arrow above." : "Please call the shop to find a time."}
              </EmptyState>
            </Card>
          )}
          <Link href={base} className="inline-block text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline">
            Keep the current time
          </Link>
        </section>
      );
    }
  }

  return (
    <div className="space-y-6">
      {done ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-900 ring-1 ring-green-200 ring-inset">
          <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
          {done === "moved" ? "Done: your booking has its new time." : "Done: your booking is cancelled."}
        </p>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-600">Your booking at</p>
            <h1 className="text-xl font-bold tracking-tight wrap-anywhere text-gray-900">{row.shop_name}</h1>
          </div>
          {row.status === "cancelled" ? <Badge tone="warning">Cancelled</Badge> : live ? <Badge tone="success">Booked</Badge> : <Badge>Past</Badge>}
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-gray-600">When</dt>
            <dd className={`font-semibold tabular ${row.status === "cancelled" ? "text-gray-600 line-through" : "text-gray-900"}`}>
              {whenLabel(row.starts_at, row.shop_timezone)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">What</dt>
            <dd className="font-semibold wrap-anywhere text-gray-900">{serviceLine(info)}</dd>
          </div>
          <div>
            <dt className="text-gray-600">Booked for</dt>
            <dd className="wrap-anywhere text-gray-900">
              {row.customer_name}, {row.customer_email}
            </dd>
          </div>
        </dl>

        {row.shop_address || row.shop_phone ? (
          <ul className="mt-5 space-y-1.5 border-t border-gray-100 pt-4 text-sm text-gray-700">
            {row.shop_address ? (
              <li className="flex items-start gap-1.5">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                {row.shop_address}
              </li>
            ) : null}
            {row.shop_phone ? (
              <li>
                <a href={`tel:${row.shop_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                  <Phone aria-hidden className="size-4" />
                  Call {row.shop_phone}
                </a>
              </li>
            ) : null}
          </ul>
        ) : null}

        {live && !moving ? (
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-start">
            <Link href={`${base}?move=1`} className={buttonClass("primary", { full: true })}>
              <CalendarCheck aria-hidden className="size-4" />
              Change time
            </Link>
            <div className="sm:ml-auto">
              <CancelForm token={token} />
            </div>
          </div>
        ) : null}
        {!live ? (
          <div className="mt-6">
            <Link href={`/s/${row.shop_slug}`} className={buttonClass("secondary", { full: true })}>
              Book another time
            </Link>
          </div>
        ) : null}
      </Card>

      {picker}
    </div>
  );
}

export default function Page(props: PageProps<"/b/[token]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<PageSkeleton />}>
          <ManageBooking {...props} />
        </Suspense>
      </main>
      <footer className="pt-6 pb-10 text-center text-sm text-gray-600">
        Booking by{" "}
        <Link href="/" className="font-medium text-gray-900 hover:underline">
          <Logo className="text-sm" />
        </Link>
      </footer>
    </div>
  );
}
