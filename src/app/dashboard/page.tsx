import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarBlankIcon, CaretRightIcon, EnvelopeSimpleIcon, PhoneIcon } from "@/components/icons";
import { Card, CardSection, EmptyState, PageSkeleton, buttonClass } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { formatDuration } from "@/lib/format";
import { getMyShop } from "@/lib/shop";
import { addDays } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { DemoNotice, OwnerHeader } from "./account";
import { BookingSheet, isBookingId } from "./booking-sheet";
import { SetupChecklist, setupSteps } from "./setup-checklist";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Today" };

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  staff_id: string;
  services: { name: string; duration_minutes: number } | null;
  staff: { name: string } | null;
};

const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

/** The owner's home screen: who is next, and the whole day at a glance. */
async function TodayContent({ searchParams }: PageProps<"/dashboard">) {
  const query = await searchParams;
  const { supabase, shop, email } = await getMyShop();

  // A new owner makes their shop first.
  if (!shop) {
    return (
      <>
        <OwnerHeader
          title="Set up your shop"
          description={`Signed in as ${email}. This takes about two minutes, and you can change everything later.`}
        />
        <CardSection title="Shop details" description="Customers see these on your booking page.">
          <ShopForm shop={null} timezones={Intl.supportedValuesOf("timeZone")} />
        </CardSection>
      </>
    );
  }

  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);
  const from = zonedToUtc(today, "00:00", tz);
  const to = zonedToUtc(addDays(today, 1), "00:00", tz);

  const [{ data }, { count: teamSize }, steps] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, starts_at, ends_at, customer_name, customer_email, customer_phone, staff_id, services(name, duration_minutes), staff(name)")
      .eq("shop_id", shop.id)
      .eq("status", "booked")
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at")
      .returns<Booking[]>(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("active", true),
    setupSteps({ supabase, shop }),
  ]);
  const bookings = data ?? [];
  const showWho = (teamSize ?? 0) >= 2;
  const time = (iso: string) => utcToZoned(new Date(iso), tz).time;
  const nowMs = now.getTime();

  const next = bookings.find((b) => Date.parse(b.starts_at) >= nowMs);
  const left = bookings.filter((b) => Date.parse(b.starts_at) >= nowMs).length;
  const nowIndex = next ? bookings.indexOf(next) : bookings.length;
  const href = (id: string) => `/dashboard?b=${id}`;

  let nextCard: React.ReactNode = null;
  if (next) {
    const minutes = Math.round((Date.parse(next.starts_at) - nowMs) / 60_000);
    const alsoThen = bookings.filter((b) => b !== next && b.starts_at === next.starts_at);
    const contact = "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium transition-colors duration-150 hover:bg-ink/7";
    nextCard = (
      <section
        aria-label="Next booking"
        className="flex flex-col gap-3.5 rounded-lg bg-surface p-[18px] shadow-[0_0_0_1px_var(--color-accent-800),0_0_40px_rgb(145_132_217/0.08)]"
      >
        <p className="flex items-center gap-2 text-[13px] text-accent-300">
          <span aria-hidden className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          Next up, {minutes < 60 ? `in ${minutes} min` : `at ${time(next.starts_at)}`}
        </p>
        <div>
          <p className="text-[22px] leading-tight font-medium tracking-tight wrap-anywhere">{next.customer_name}</p>
          <p className="mt-0.5 text-sm text-neutral-400">
            {next.services?.name ?? "Booking"}
            {next.services ? `, ${formatDuration(next.services.duration_minutes)}` : ""}
            {showWho && next.staff ? ` · with ${next.staff.name}` : ""}
          </p>
          <p className="mt-1 text-base font-medium tabular">
            {time(next.starts_at)}–{time(next.ends_at)}
          </p>
        </div>
        {alsoThen.length ? (
          <p className="text-[13px] text-neutral-400">
            Also at {time(next.starts_at)}: {alsoThen.map((o) => (showWho && o.staff ? `${o.customer_name} with ${o.staff.name}` : o.customer_name)).join(", ")}.
          </p>
        ) : null}
        <div className="flex gap-2">
          {next.customer_phone ? (
            <a href={`tel:${next.customer_phone.replace(/[^\d+]/g, "")}`} className={contact}>
              <PhoneIcon aria-hidden className="size-[17px]" />
              Call
            </a>
          ) : null}
          {next.customer_email ? (
            <a href={`mailto:${next.customer_email}`} className={contact}>
              <EnvelopeSimpleIcon aria-hidden className="size-[17px]" />
              Email
            </a>
          ) : null}
          <Link href={href(next.id)} scroll={false} className={`${buttonClass("primary")} h-10 flex-1 shadow-none`}>
            Details
          </Link>
        </div>
      </section>
    );
  }

  const nowLine = (
    <li aria-hidden key="now" className="flex items-center gap-3 px-4 py-1">
      <span className="min-w-12 text-xs font-medium whitespace-nowrap text-accent-400 tabular">Now {utcToZoned(now, tz).time}</span>
      <span className="h-px flex-1 bg-linear-to-r from-accent to-transparent shadow-[0_0_6px_rgb(145_132_217/0.6)]" />
    </li>
  );

  return (
    <>
      <OwnerHeader title="Today" eyebrow={longDay.format(new Date(`${today}T12:00:00Z`))} />
      <div className="space-y-6">
        <SetupChecklist steps={steps} />
        {nextCard}

        <section aria-labelledby="all-today" className="space-y-2.5">
          <div className="flex items-baseline justify-between px-1">
            <h2 id="all-today" className="text-[15px] font-medium">
              All of today
            </h2>
            {bookings.length ? (
              <span className="text-[13px] text-neutral-400 tabular">
                {bookings.length} {bookings.length === 1 ? "booking" : "bookings"} · {left} to go
              </span>
            ) : null}
          </div>
          {bookings.length === 0 ? (
            <Card>
              <EmptyState icon={CalendarBlankIcon} title="Nothing booked today">
                New bookings show up here right away. Add a walk-in with the + button.
              </EmptyState>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul>
                {bookings.flatMap((b, i) => {
                  const done = Date.parse(b.ends_at) <= nowMs;
                  const row = (
                    <li key={b.id}>
                      <Link
                        href={href(b.id)}
                        scroll={false}
                        className={`rule-top grid grid-cols-[48px_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-3 transition-colors duration-150 hover:bg-ink/4 ${done ? "opacity-55" : ""}`}
                      >
                        <time dateTime={b.starts_at} className="pt-px text-sm font-medium tabular">
                          {time(b.starts_at)}
                        </time>
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-[15px] font-medium wrap-anywhere">{b.customer_name}</span>
                          <span className="text-[13px] text-neutral-400">
                            {b.services?.name ?? "Booking"} · until&nbsp;{time(b.ends_at)}
                            {showWho && b.staff ? ` · ${b.staff.name}` : ""}
                          </span>
                        </span>
                        {done ? (
                          <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-200">Done</span>
                        ) : (
                          <CaretRightIcon aria-hidden className="mt-[3px] size-4 text-neutral-600" />
                        )}
                      </Link>
                    </li>
                  );
                  return i === nowIndex ? [nowLine, row] : [row];
                })}
                {nowIndex === bookings.length ? nowLine : null}
              </ul>
            </Card>
          )}
        </section>

        <Suspense>
          <DemoNotice />
        </Suspense>
      </div>

      {isBookingId(query.b) ? <BookingSheet id={query.b} closeHref="/dashboard" /> : null}
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function TodayPage(props: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TodayContent {...props} />
    </Suspense>
  );
}
