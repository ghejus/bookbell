import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarXIcon, CaretLeftIcon, CaretRightIcon } from "@/components/icons";
import { PageSkeleton } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { hhmm, minuteOfDay, shownDays, visibleHours, weekStart, type CalendarView } from "@/lib/calendar";
import { requireShop } from "@/lib/shop";
import { addDays, isoWeekday } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { OwnerHeader } from "../account";
import { BookingSheet, isBookingId } from "../booking-sheet";
import { NewBookingSheet } from "../new-booking";

export const metadata: Metadata = { title: "Calendar" };

/** Pixels per minute: one hour is 66px tall, like the design. */
const PX = 1.1;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

type Worker = { id: string; name: string; active: boolean };
type Hours = { weekday: number; opens: string; closes: string };
type Off = { id: string; starts_at: string; ends_at: string; staff_id: string | null };
type Booking = { id: string; status: "booked" | "no_show"; starts_at: string; ends_at: string; customer_name: string; staff_id: string };

const hatch = "bg-[repeating-linear-gradient(135deg,rgb(233_233_237/0.045)_0_6px,transparent_6px_12px)]";

async function CalendarContent({ searchParams }: PageProps<"/dashboard/calendar">) {
  const query = await searchParams;
  const { supabase, shop } = await requireShop();
  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);
  const view: CalendarView = query.view === "week" ? "week" : "day";
  const date = isDate(query.date) ? query.date : today;
  const days = shownDays(view, date);
  const monday = weekStart(date);
  const from = zonedToUtc(days[0], "00:00", tz);
  const to = zonedToUtc(addDays(days[days.length - 1], 1), "00:00", tz);

  const [{ data: staffData }, { data: hoursData }, { data: offData }, { data: bookingData }] = await Promise.all([
    supabase.from("staff").select("id, name, active").eq("shop_id", shop.id).order("created_at").returns<Worker[]>(),
    supabase.from("opening_hours").select("weekday, opens, closes").eq("shop_id", shop.id).returns<Hours[]>(),
    supabase
      .from("time_off")
      .select("id, starts_at, ends_at, staff_id")
      .eq("shop_id", shop.id)
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString())
      .returns<Off[]>(),
    supabase
      .from("bookings")
      .select("id, status, starts_at, ends_at, customer_name, staff_id")
      .eq("shop_id", shop.id)
      .in("status", ["booked", "no_show"])
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString())
      .order("starts_at")
      .returns<Booking[]>(),
  ]);
  const allStaff = staffData ?? [];
  const hours = hoursData ?? [];
  const offs = offData ?? [];
  const bookings = bookingData ?? [];

  // Columns: everyone taking bookings, plus anyone turned off who still has bookings here.
  const staff = allStaff.filter((w) => w.active || bookings.some((b) => b.staff_id === w.id));
  const openOn = (d: string) => hours.some((h) => h.weekday === isoWeekday(d));

  const window = visibleHours(
    hours,
    days,
    days.flatMap((d) =>
      bookings.map((b) => ({ start: minuteOfDay(b.starts_at, tz, d), end: minuteOfDay(b.ends_at, tz, d) })).filter((b) => b.end > b.start),
    ),
  );
  const height = (window.end - window.start) * PX;
  const top = (minute: number) => (Math.max(window.start, Math.min(window.end, minute)) - window.start) * PX;

  const link = (q: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const all = { view: view === "week" ? "week" : undefined, date: date === today ? undefined : date, ...q };
    for (const [k, v] of Object.entries(all)) if (v) p.set(k, v);
    return `/dashboard/calendar${p.size ? `?${p}` : ""}`;
  };
  const closeHref = link({});

  const dayTitle = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const month = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "long", year: "numeric" });
  const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
  const dayNum = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });
  const dayMonth = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
  const nowMinute = minuteOfDay(now.toISOString(), tz, today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  /** One person's column on one day. */
  function Lane({ day, worker, showName }: { day: string; worker: Worker; showName: boolean }) {
    const open = hours
      .filter((h) => h.weekday === isoWeekday(day))
      .map((h) => ({ s: toMinutes(h.opens), e: toMinutes(h.closes) }))
      .sort((a, b) => a.s - b.s);
    // Closed parts of the day are hatched.
    const closed: { s: number; e: number }[] = [];
    let cursor = window.start;
    for (const o of open) {
      if (o.s > cursor) closed.push({ s: cursor, e: o.s });
      cursor = Math.max(cursor, o.e);
    }
    if (cursor < window.end) closed.push({ s: cursor, e: window.end });
    const laneOffs = offs.filter((o) => o.staff_id === null || o.staff_id === worker.id);
    const laneBookings = bookings.filter((b) => b.staff_id === worker.id);
    const marks: number[] = [];
    for (let m = window.start; m < window.end; m += 30) marks.push(m);
    return (
      <div className="relative min-w-0 flex-1 rounded-lg shadow-[inset_0_0_0_1px_rgb(233_233_237/0.06)]" style={{ height }}>
        {marks.map((m) => (
          <div key={m} aria-hidden className={`absolute inset-x-0 border-t ${m % 60 === 0 ? "border-ink/7" : "border-ink/3"}`} style={{ top: top(m) }} />
        ))}
        {closed.map((c) => (
          <div key={c.s} aria-hidden className={`pointer-events-none absolute inset-x-0 ${hatch}`} style={{ top: top(c.s), height: top(c.e) - top(c.s) }} />
        ))}
        {/* Every half hour is a link that opens "New booking" there. */}
        {marks.map((m) => (
          <Link
            key={`add-${m}`}
            href={link({ date: day, add: "1", at: hhmm(m), staff: worker.id })}
            scroll={false}
            className="group absolute inset-x-0 rounded-md hover:bg-accent/10 focus-visible:z-10 focus-visible:bg-accent/10"
            style={{ top: top(m), height: 30 * PX }}
          >
            <span className="sr-only">
              Add a booking on {dayTitle.format(asUtc(day))} at {hhmm(m)}
              {staff.length > 1 ? ` with ${worker.name}` : ""}
            </span>
            <span aria-hidden className="hidden px-2 pt-0.5 text-[11px] font-medium text-accent-400 group-hover:block">
              + {hhmm(m)}
            </span>
          </Link>
        ))}
        {laneOffs.map((o) => {
          const s = minuteOfDay(o.starts_at, tz, day);
          const e = minuteOfDay(o.ends_at, tz, day);
          if (e <= window.start || s >= window.end || e <= s) return null;
          return (
            <div
              key={o.id}
              className={`pointer-events-none absolute inset-x-0 rounded-md bg-ink/4 ${hatch} px-2 pt-1 text-[11px] font-medium text-neutral-400`}
              style={{ top: top(s), height: top(e) - top(s) }}
            >
              {o.staff_id ? "Off" : "Closed"}
            </div>
          );
        })}
        {laneBookings.map((b) => {
          const s = minuteOfDay(b.starts_at, tz, day);
          const e = minuteOfDay(b.ends_at, tz, day);
          if (e <= s) return null;
          const h = Math.max(top(e) - top(s) - 2, 15);
          const past = Date.parse(b.ends_at) <= now.getTime();
          const active = b.id === query.b;
          const start = utcToZoned(new Date(b.starts_at), tz).time;
          const end = utcToZoned(new Date(b.ends_at), tz).time;
          return (
            <Link
              key={b.id}
              href={link({ b: b.id })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              title={`${start}–${end} ${b.customer_name}${staff.length > 1 ? `, with ${worker.name}` : ""}${b.status === "no_show" ? " (didn’t come)" : ""}`}
              className={`absolute inset-x-[3px] z-20 flex content-start items-center gap-x-1.5 overflow-hidden rounded-md text-xs leading-[14px] transition-colors duration-150 ${
                h < 30 ? "flex-nowrap px-[7px] py-px" : "flex-wrap px-[7px] py-[3px]"
              } ${
                active
                  ? "bg-accent-800 text-accent-100 shadow-[inset_0_0_0_1px_var(--color-accent)]"
                  : past
                    ? "bg-ink/5 text-neutral-400 shadow-[inset_0_0_0_1px_rgb(233_233_237/0.14)] hover:bg-ink/8"
                    : "bg-accent-900 text-accent-200 shadow-[inset_0_0_0_1px_rgb(145_132_217/0.75)] hover:bg-accent-800"
              }`}
              style={{ top: top(s) + 1, height: h }}
            >
              <span className={`min-w-0 shrink truncate font-medium ${b.status === "no_show" ? "line-through decoration-danger-text" : ""}`}>{b.customer_name}</span>
              {/* Narrow week columns keep short bookings to the name; the time is in the tooltip. */}
              {showName && h < 30 ? null : <span className="text-[11px] whitespace-nowrap opacity-75 tabular">{h < 30 ? start : `${start}–${end}`}</span>}
              {showName && h > 44 ? <span className="w-full truncate text-[11px] opacity-75">{worker.name}</span> : null}
            </Link>
          );
        })}
        {day === today && nowMinute > window.start && nowMinute < window.end ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-30 h-px bg-accent shadow-[0_0_6px_var(--color-accent)]" style={{ top: top(nowMinute) }}>
            <span className="absolute -top-[3.5px] -left-1 size-2 rounded-full bg-accent" />
          </div>
        ) : null}
      </div>
    );
  }

  const hourLabels: number[] = [];
  for (let m = window.start; m <= window.end; m += 60) hourLabels.push(m);

  const columns =
    view === "day"
      ? staff.map((w) => ({ key: w.id, label: w.name, count: bookings.filter((b) => b.staff_id === w.id).length, day: date, workers: [w] }))
      : days.map((d) => ({ key: d, label: `${shortDay.format(asUtc(d))} ${dayNum.format(asUtc(d))}`, count: 0, day: d, workers: staff }));
  const closedDay = view === "day" && !openOn(date) && bookings.length === 0;
  const thisWeek = week.includes(today);

  return (
    <div data-wide>
      <OwnerHeader title="Calendar" eyebrow={month.format(asUtc(date))} />

      <div className="flex items-center justify-between gap-2 pb-2 pl-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-neutral-400 tabular">
            {dayMonth.format(asUtc(week[0]))} – {dayMonth.format(asUtc(week[6]))}
          </span>
          {!thisWeek || date !== today ? (
            <Link href={link({ date: undefined })} scroll={false} className="rounded-md px-1.5 py-0.5 text-[13px] font-medium text-accent-400 hover:bg-accent/10">
              Today
            </Link>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <div role="group" aria-label="View" className="mr-1 hidden rounded-lg border border-line p-0.5 sm:flex">
            {(["day", "week"] as const).map((v) => (
              <Link
                key={v}
                href={`/dashboard/calendar?${new URLSearchParams({ ...(v === "week" ? { view: "week" } : {}), ...(date !== today ? { date } : {}) })}`}
                scroll={false}
                aria-current={view === v ? "true" : undefined}
                className={`rounded-md px-3 py-1 text-[13px] font-medium transition-colors duration-150 ${
                  view === v ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"
                }`}
              >
                {v === "day" ? "Day" : "Week"}
              </Link>
            ))}
          </div>
          <Link href={link({ date: addDays(date, -7) })} scroll={false} aria-label="Earlier week" className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-ink/7">
            <CaretLeftIcon aria-hidden className="size-[18px]" />
          </Link>
          <Link href={link({ date: addDays(date, 7) })} scroll={false} aria-label="Later week" className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-ink/7">
            <CaretRightIcon aria-hidden className="size-[18px]" />
          </Link>
        </div>
      </div>

      {/* The week: tap a day to see it. */}
      <div className="grid grid-cols-7 gap-[5px]">
        {week.map((d) => {
          const on = view === "day" && d === date;
          return (
            <Link
              key={d}
              href={`/dashboard/calendar${d === today ? "" : `?date=${d}`}`}
              scroll={false}
              aria-current={on ? "date" : undefined}
              aria-label={`${dayTitle.format(asUtc(d))}${openOn(d) ? "" : ", closed"}`}
              className={`flex h-[60px] flex-col items-center justify-center gap-px rounded-lg border font-medium transition-colors duration-150 ${on ? "chip-on" : openOn(d) ? "chip-off" : "chip-shut"}`}
            >
              <span className="text-[11px]">{shortDay.format(asUtc(d))}</span>
              <span className="text-[17px] leading-tight tabular">{dayNum.format(asUtc(d))}</span>
              <span aria-hidden className={`size-1 rounded-full ${d === today ? "bg-accent" : "bg-transparent"}`} />
            </Link>
          );
        })}
      </div>

      {closedDay ? (
        <div className="mt-5 flex flex-col items-center gap-1 rounded-lg bg-surface px-6 py-10 text-center shadow-card">
          <span className="mb-2 flex size-11 items-center justify-center rounded-full bg-neutral-800 text-neutral-300">
            <CalendarXIcon aria-hidden className="size-5" />
          </span>
          <p className="font-medium">Closed</p>
          <p className="text-sm text-neutral-400">There are no opening hours on this day. Tap + to add a booking anyway.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 overflow-x-auto pb-1">
            <div style={{ minWidth: view === "day" ? `${2.75 + Math.max(1, columns.length) * 7}rem` : `${2.75 + 7 * Math.max(5.5, staff.length * 3.5)}rem` }}>
              <div className="flex gap-1.5 pb-2 pl-11">
                {columns.map((c) => (
                  <div key={c.key} className="flex min-w-0 flex-1 items-baseline gap-1.5 pl-1">
                    {view === "week" ? (
                      <Link href={`/dashboard/calendar?date=${c.day}`} className={`truncate text-sm font-medium hover:underline ${c.day === today ? "text-accent-400" : ""}`}>
                        {c.label}
                      </Link>
                    ) : (
                      <span className="truncate text-sm font-medium">{c.label}</span>
                    )}
                    {c.count ? <span className="text-xs text-neutral-400 tabular">{c.count}</span> : null}
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                {/* Hour labels, kept in view while the columns scroll sideways. */}
                <div className="sticky left-0 z-30 w-[38px] shrink-0 bg-ground">
                  <div className="relative" style={{ height }}>
                    {hourLabels.map((m) => (
                      <span key={m} className="absolute right-1.5 -translate-y-1/2 text-[11px] text-neutral-600 tabular first:translate-y-0" style={{ top: top(m) }}>
                        {hhmm(m)}
                      </span>
                    ))}
                  </div>
                </div>
                {columns.map((c) => (
                  <div key={c.key} className="flex min-w-0 flex-1 gap-0.5">
                    {c.workers.map((w) => (
                      <Lane key={w.id} day={c.day} worker={w} showName={view === "week" && staff.length > 1} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-[13px] text-neutral-400">
            Tap an empty time to add a booking there.
            {view === "week" && staff.length > 1 ? ` Each day has one narrow column per person: ${staff.map((w) => w.name).join(", ")}.` : ""}
          </p>
        </>
      )}

      {isBookingId(query.b) ? (
        <BookingSheet id={query.b} closeHref={closeHref} view={view} />
      ) : query.add === "1" ? (
        <NewBookingSheet
          closeHref={closeHref}
          date={isDate(query.date) ? query.date : undefined}
          time={typeof query.at === "string" && /^\d{2}:\d{2}$/.test(query.at) ? query.at : undefined}
          staffId={isBookingId(query.staff) ? query.staff : undefined}
          view={view}
        />
      ) : null}
    </div>
  );
}

export default function CalendarPage(props: PageProps<"/dashboard/calendar">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CalendarContent {...props} />
    </Suspense>
  );
}
