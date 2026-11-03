import { CalendarPlus, ChevronLeft, ChevronRight, Mail, Phone, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDelete } from "@/components/form";
import { Badge, buttonClass, Card, PageSkeleton } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { hhmm, minuteOfDay, shownDays, stepDate, visibleHours, type CalendarView } from "@/lib/calendar";
import { formatDuration } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { addDays, isoWeekday } from "@/lib/slots";
import { utcToZoned, zonedToUtc } from "@/lib/time";
import { cancelBooking } from "../actions";
import { AddBookingForm, MoveBookingForm } from "./panel-forms";

export const metadata: Metadata = { title: "Calendar" };

/** Pixels per minute: one hour is 84px tall. */
const PX = 1.4;
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/.test(v);
const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);

type Worker = { id: string; name: string; active: boolean };
type Service = { id: string; name: string; duration_minutes: number; active: boolean };
type Hours = { weekday: number; opens: string; closes: string };
type Off = { id: string; starts_at: string; ends_at: string; staff_id: string | null };
type Booking = {
  id: string;
  status: "booked" | "cancelled";
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  staff_id: string;
  services: { name: string } | null;
};

const BOOKING_FIELDS = "id, status, starts_at, ends_at, customer_name, customer_email, customer_phone, staff_id, services(name)";

async function CalendarContent({ searchParams }: PageProps<"/dashboard/calendar">) {
  const query = await searchParams;
  const { supabase, shop } = await requireShop();
  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);
  const view: CalendarView = query.view === "week" ? "week" : "day";
  const date = isDate(query.date) ? query.date : today;
  const days = shownDays(view, date);
  const from = zonedToUtc(days[0], "00:00", tz);
  const to = zonedToUtc(addDays(days[days.length - 1], 1), "00:00", tz);

  const [{ data: staffData }, { data: serviceData }, { data: hoursData }, { data: offData }, { data: bookingData }] =
    await Promise.all([
      supabase.from("staff").select("id, name, active").eq("shop_id", shop.id).order("created_at").returns<Worker[]>(),
      supabase.from("services").select("id, name, duration_minutes, active").eq("shop_id", shop.id).order("created_at").returns<Service[]>(),
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
        .select(BOOKING_FIELDS)
        .eq("shop_id", shop.id)
        .eq("status", "booked")
        .lt("starts_at", to.toISOString())
        .gt("ends_at", from.toISOString())
        .order("starts_at")
        .returns<Booking[]>(),
    ]);
  const allStaff = staffData ?? [];
  const services = serviceData ?? [];
  const hours = hoursData ?? [];
  const offs = offData ?? [];
  const bookings = bookingData ?? [];

  // Columns: everyone taking bookings, plus anyone turned off who still has bookings here.
  const staff = allStaff.filter((w) => w.active || bookings.some((b) => b.staff_id === w.id));
  const team = allStaff.filter((w) => w.active);
  const nameOf = new Map(allStaff.map((w) => [w.id, w.name]));

  // The booking whose details are open (it may be outside these days, or cancelled).
  const selectedId = isId(query.b) ? query.b : null;
  let selected = selectedId ? bookings.find((b) => b.id === selectedId) : undefined;
  if (selectedId && !selected) {
    const { data } = await supabase.from("bookings").select(BOOKING_FIELDS).eq("id", selectedId).eq("shop_id", shop.id).maybeSingle<Booking>();
    selected = data ?? undefined;
  }
  const adding = query.add === "1" && !selected;

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

  const dayTitle = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shortDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric" });
  const range = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
  const title = view === "day" ? dayTitle.format(asUtc(date)) : range.formatRange(asUtc(days[0]), asUtc(days[6]));
  const nowMinute = minuteOfDay(now.toISOString(), tz, today);

  /** One person's column on one day. */
  function Lane({ day, worker, showName }: { day: string; worker: Worker; showName: boolean }) {
    const open = hours.filter((h) => h.weekday === isoWeekday(day));
    const laneOffs = offs.filter((o) => o.staff_id === null || o.staff_id === worker.id);
    const laneBookings = bookings.filter((b) => b.staff_id === worker.id);
    const marks: number[] = [];
    for (let m = window.start; m < window.end; m += 30) marks.push(m);
    return (
      <div className="relative min-w-0 flex-1 border-l border-gray-200 bg-gray-50" style={{ height }}>
        {open.map((h) => {
          const s = minuteOfDay(zonedToUtc(day, h.opens.slice(0, 5), tz).toISOString(), tz, day);
          const e = minuteOfDay(zonedToUtc(day, h.closes.slice(0, 5), tz).toISOString(), tz, day);
          return <div key={h.opens} aria-hidden className="absolute inset-x-0 bg-white" style={{ top: top(s), height: top(e) - top(s) }} />;
        })}
        {marks.map((m) => (
          <div key={m} aria-hidden className={`absolute inset-x-0 border-t ${m % 60 === 0 ? "border-gray-200" : "border-gray-100"}`} style={{ top: top(m) }} />
        ))}
        {/* Every half hour is a link that opens the "add booking" form there. */}
        {marks.map((m) => (
          <Link
            key={`add-${m}`}
            href={link({ date: day, add: "1", at: hhmm(m), staff: worker.id })}
            scroll={false}
            className="group absolute inset-x-0 hover:bg-brand-50/80 focus-visible:z-10 focus-visible:bg-brand-50"
            style={{ top: top(m), height: 30 * PX }}
          >
            <span className="sr-only">
              Add a booking on {dayTitle.format(asUtc(day))} at {hhmm(m)}
              {staff.length > 1 ? ` with ${worker.name}` : ""}
            </span>
            <span aria-hidden className="hidden px-2 pt-1 text-xs font-medium text-brand-700 group-hover:block">
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
              className="pointer-events-none absolute inset-x-0 bg-[repeating-linear-gradient(135deg,var(--color-gray-100)_0_6px,var(--color-gray-200)_6px_12px)] px-2 pt-1 text-xs font-medium text-gray-600"
              style={{ top: top(s), height: top(e) - top(s) }}
            >
              {o.staff_id ? "Off" : "Closed"}
            </div>
          );
        })}
        {day === today && nowMinute > window.start && nowMinute < window.end ? (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-red-500" style={{ top: top(nowMinute) }} />
        ) : null}
        {laneBookings.map((b) => {
          const s = minuteOfDay(b.starts_at, tz, day);
          const e = minuteOfDay(b.ends_at, tz, day);
          if (e <= s) return null;
          const h = Math.max(top(e) - top(s), 22);
          const active = b.id === selected?.id;
          return (
            <Link
              key={b.id}
              href={link({ b: b.id })}
              scroll={false}
              aria-current={active ? "true" : undefined}
              title={`${utcToZoned(new Date(b.starts_at), tz).time}–${utcToZoned(new Date(b.ends_at), tz).time} ${b.customer_name}${b.services ? `, ${b.services.name}` : ""}${staff.length > 1 ? `, with ${worker.name}` : ""}`}
              className={`absolute inset-x-1 z-20 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs leading-tight shadow-sm transition-colors duration-150 ${
                active ? "border-brand-800 bg-brand-700 text-white" : "border-brand-600 bg-brand-100 text-brand-800 hover:bg-brand-200"
              }`}
              style={{ top: top(s) + 1, height: h - 2 }}
            >
              {/* Short bookings put the time and name on one line, so the name still shows. */}
              {h < 36 ? (
                <span className="block truncate">
                  <span className="font-semibold tabular">{utcToZoned(new Date(b.starts_at), tz).time}</span> {b.customer_name}
                </span>
              ) : (
                <>
                  <span className="block font-semibold tabular">{utcToZoned(new Date(b.starts_at), tz).time}</span>
                  <span className="block truncate font-medium">{b.customer_name}</span>
                </>
              )}
              {h > 52 ? <span className="block truncate opacity-80">{b.services?.name}</span> : null}
              {showName && h > 66 ? <span className="block truncate opacity-80">{worker.name}</span> : null}
            </Link>
          );
        })}
      </div>
    );
  }

  const hourLabels: number[] = [];
  for (let m = window.start; m < window.end; m += 60) hourLabels.push(m);

  // The side panel: one booking's details, or the "add booking" form.
  const closeHref = link({});
  let panel: React.ReactNode = null;
  if (selected) {
    const local = utcToZoned(new Date(selected.starts_at), tz);
    const minutes = Math.round((Date.parse(selected.ends_at) - Date.parse(selected.starts_at)) / 60_000);
    const live = selected.status === "booked";
    panel = (
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold wrap-anywhere text-gray-900">{selected.customer_name}</h2>
            <p className="text-sm text-gray-600">
              {selected.services?.name ?? "Booking"}, {formatDuration(minutes)}
            </p>
          </div>
          <Link href={closeHref} scroll={false} aria-label="Close" className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <X aria-hidden className="size-4.5" />
          </Link>
        </div>
        <p className="mt-3 text-sm font-semibold text-gray-900 tabular">
          {dayTitle.format(asUtc(local.date))}, {local.time}–{utcToZoned(new Date(selected.ends_at), tz).time}
        </p>
        {staff.length > 1 ? <p className="text-sm text-gray-700">With {nameOf.get(selected.staff_id) ?? "someone"}</p> : null}
        {!live ? (
          <p className="mt-2">
            <Badge tone="warning">Cancelled</Badge>
          </p>
        ) : null}
        <div className="mt-3 space-y-1 text-sm">
          {selected.customer_email ? (
            <a href={`mailto:${selected.customer_email}`} className="flex min-w-0 items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
              <Mail aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
              <span className="min-w-0 wrap-anywhere">{selected.customer_email}</span>
            </a>
          ) : null}
          {selected.customer_phone ? (
            <a href={`tel:${selected.customer_phone.replace(/[^\d+]/g, "")}`} className="flex items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
              <Phone aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
              <span className="wrap-anywhere">{selected.customer_phone}</span>
            </a>
          ) : null}
          {!selected.customer_email && !selected.customer_phone ? <p className="text-gray-600">No contact details.</p> : null}
        </div>
        {live ? (
          <>
            <div className="mt-5 border-t border-gray-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">Move</h3>
              <MoveBookingForm
                key={`${selected.id}-${selected.starts_at}-${selected.staff_id}`}
                bookingId={selected.id}
                staff={team.length ? team : staff}
                date={local.date}
                time={local.time}
                staffId={selected.staff_id}
                view={view}
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-600">{selected.customer_email ? "Cancelling emails the customer." : "Cancelling frees the time."}</p>
              <form action={cancelBooking}>
                <input type="hidden" name="id" value={selected.id} />
                <ConfirmDelete label={`Cancel ${selected.customer_name}’s booking`} confirmText="Cancel?" busyText="Cancelling…">
                  <X aria-hidden className="size-4.5" />
                </ConfirmDelete>
              </form>
            </div>
          </>
        ) : null}
      </Card>
    );
  } else if (adding) {
    const at = typeof query.at === "string" && /^\d{2}:\d{2}$/.test(query.at) ? query.at : hhmm(Math.max(window.start, 9 * 60));
    const choices = services.filter((s) => s.active).length ? services.filter((s) => s.active) : services;
    panel = (
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Add a booking</h2>
          <Link href={closeHref} scroll={false} aria-label="Close" className="-mt-1 -mr-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
            <X aria-hidden className="size-4.5" />
          </Link>
        </div>
        {choices.length === 0 ? (
          <p className="text-sm text-gray-600">
            Add a service first, on the{" "}
            <Link href="/dashboard/services" className="font-semibold text-brand-700 hover:underline">
              Services
            </Link>{" "}
            page.
          </p>
        ) : (
          <AddBookingForm
            key={`${query.date}-${at}-${query.staff}`}
            services={choices.map((s) => ({ id: s.id, name: s.name, label: `${s.name}, ${formatDuration(s.duration_minutes)}` }))}
            staff={team.length ? team : staff}
            date={isDate(query.date) ? query.date : date}
            time={at}
            staffId={isId(query.staff) ? query.staff : undefined}
            view={view}
          />
        )}
        <p className="mt-3 text-xs text-gray-600">For phone calls and walk-ins. Opening hours and notice rules don’t apply to you, but nobody can be booked twice.</p>
      </Card>
    );
  }

  const columns = view === "day" ? staff.map((w) => ({ key: w.id, label: w.name, day: date, workers: [w] })) : days.map((d) => ({ key: d, label: shortDay.format(asUtc(d)), day: d, workers: staff }));

  return (
    <div data-wide className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Calendar</h1>
          <p className="text-sm text-gray-600 tabular">{title}</p>
        </div>
        <Link href={link({ add: "1", date })} scroll={false} className={buttonClass("primary")}>
          <CalendarPlus aria-hidden className="size-4" />
          Add booking
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link href={link({ date: stepDate(view, date, -1) })} scroll={false} aria-label={view === "day" ? "Day before" : "Week before"} className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
            <ChevronLeft aria-hidden className="size-4.5" />
          </Link>
          <Link href={link({ date: undefined })} scroll={false} className={buttonClass("secondary", { size: "sm" })}>
            Today
          </Link>
          <Link href={link({ date: stepDate(view, date, 1) })} scroll={false} aria-label={view === "day" ? "Next day" : "Next week"} className="flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
            <ChevronRight aria-hidden className="size-4.5" />
          </Link>
        </div>
        <div role="group" aria-label="View" className="flex rounded-lg bg-gray-200/70 p-0.5">
          {(["day", "week"] as const).map((v) => (
            <Link
              key={v}
              href={`/dashboard/calendar?${new URLSearchParams({ ...(v === "week" ? { view: "week" } : {}), ...(date !== today ? { date } : {}) })}`}
              scroll={false}
              aria-current={view === v ? "true" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${view === v ? "bg-white text-gray-900 shadow-sm" : "text-gray-700 hover:text-gray-900"}`}
            >
              {v === "day" ? "Day" : "Week"}
            </Link>
          ))}
        </div>
      </div>

      <div className={`grid gap-5 xl:items-start ${panel ? "xl:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}>
        {/* On smaller screens the panel sits above the calendar, so it is seen right away. */}
        {panel ? <div className="xl:sticky xl:top-6 xl:order-2">{panel}</div> : null}

        <Card className="overflow-hidden xl:order-1">
          <div className="overflow-x-auto">
            <div className="flex" style={{ minWidth: view === "day" ? `${3.5 + Math.max(1, columns.length) * 8.5}rem` : `${3.5 + 7 * Math.max(6, staff.length * 4)}rem` }}>
              {/* Hour labels, kept in view while the columns scroll sideways. */}
              <div className="sticky left-0 z-30 w-14 shrink-0 bg-white">
                <div className="h-11 border-b border-gray-200" />
                <div className="relative" style={{ height }}>
                  {hourLabels.map((m) => (
                    <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-gray-500 tabular first:translate-y-0" style={{ top: top(m) }}>
                      {hhmm(m)}
                    </span>
                  ))}
                </div>
              </div>
              {columns.map((c) => (
                <div key={c.key} className="min-w-0 flex-1">
                  <div className={`flex h-11 items-center justify-center border-b border-l border-gray-200 px-2 text-sm font-semibold ${c.day === today && view === "week" ? "text-brand-700" : "text-gray-900"}`}>
                    {view === "week" ? (
                      <Link href={`/dashboard/calendar?date=${c.day}`} className="truncate hover:underline">
                        {c.label}
                      </Link>
                    ) : (
                      <span className="truncate">{c.label}</span>
                    )}
                  </div>
                  <div className="flex">
                    {c.workers.map((w) => (
                      <Lane key={w.id} day={c.day} worker={w} showName={view === "week" && staff.length > 1} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
      {view === "week" && staff.length > 1 ? (
        <p className="text-sm text-gray-600">Each day shows one narrow column per person, in this order: {staff.map((w) => w.name).join(", ")}.</p>
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
