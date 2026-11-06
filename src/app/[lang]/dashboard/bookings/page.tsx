import { CalendarBlankIcon, EnvelopeSimpleIcon, PhoneIcon, UserMinusIcon, XIcon } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDelete, IconSubmit } from "@/components/form";
import { buttonClass, Card, EmptyState, PageSkeleton } from "@/components/ui";
import { emailMode } from "@/lib/email/send";
import { formatDuration } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { OwnerHeader } from "../account";
import { cancelBooking, markNoShow } from "../actions/bookings";
import { BookingSheet, isBookingId } from "../booking-sheet";
import { capital, dateLocale } from "@/lib/dates";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Bookings") };
}

/** An email that may wrap before "@" and dots ("wang.xiuying / @example.com"), not in the middle of a word. */
function BreakableEmail({ email }: { email: string }) {
  return email.split(/(?=[@.])/).map((part, i) => (
    <span key={i}>
      {i > 0 ? <wbr /> : null}
      {part}
    </span>
  ));
}

type Booking = {
  id: string;
  status: "booked" | "no_show";
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  services: { name: string; duration_minutes: number } | null;
  staff: { name: string } | null;
};

const PAGE_SIZE = 50;

async function BookingsContent({ searchParams }: PageProps<"/[lang]/dashboard/bookings">) {
  const query = await searchParams;
  const past = query.show === "past";
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const now = new Date().toISOString();
  const list = supabase
    .from("bookings")
    .select("id, status, starts_at, ends_at, customer_name, customer_email, customer_phone, services(name, duration_minutes), staff(name)")
    .eq("shop_id", shop.id)
    // Past visits include the ones marked "didn't come".
    .in("status", past ? ["booked", "no_show"] : ["booked"]);
  const [{ data }, { count: teamSize }] = await Promise.all([
    past
      ? // Newest first, one page at a time (one extra row tells us if there is an older page).
        list.lt("ends_at", now).order("starts_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE).returns<Booking[]>()
      : list.gte("ends_at", now).order("starts_at").limit(200).returns<Booking[]>(),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
  ]);
  const more = past && (data?.length ?? 0) > PAGE_SIZE;
  const bookings = (data ?? []).slice(0, past ? PAGE_SIZE : undefined);
  // Only name the person when there is more than one.
  const showWho = (teamSize ?? 0) >= 2;

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: shop.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayTitle = new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: shop.timezone, weekday: "long", day: "numeric", month: "long", year: past ? "numeric" : undefined });
  const time = new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: shop.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const todayKey = dayKey.format(new Date(now));
  const tomorrowKey = dayKey.format(new Date(Date.parse(now) + 86_400_000));
  const here = past ? `/dashboard/bookings?show=past${page > 1 ? `&page=${page}` : ""}` : "/dashboard/bookings";
  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = dayKey.format(new Date(b.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  return (
    <>
      <OwnerHeader title={o("Bookings")} eyebrow={past ? o("Already happened, newest first") : o("Upcoming, soonest first")} />

      <div role="group" aria-label={o("Which bookings")} className="mb-5 inline-flex overflow-hidden rounded-lg border border-line">
        {[
          { label: o("Upcoming"), href: "/dashboard/bookings", active: !past },
          { label: o("Past"), href: "/dashboard/bookings?show=past", active: past },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.active ? "true" : undefined}
            className={`px-4 py-2 text-[13px] font-medium transition-colors duration-150 ${t.active ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 && past ? (
        <Card>
          <EmptyState icon={CalendarBlankIcon} title={page > 1 ? o("No older bookings") : o("No past bookings yet")}>
            {o("Bookings move here once they are over.")}
          </EmptyState>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarBlankIcon} title={o("No bookings yet")}>
            {o("Share your booking page with customers. New bookings show up here right away.")}
          </EmptyState>
          <div className="flex justify-center px-6 pb-8">
            <Link href={`/s/${shop.slug}`} className={buttonClass("secondary")}>
              {o("Open my booking page")}
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-[22px]">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2 id={`day-${day}`} className="mb-2 px-1 text-[13px] font-medium">
                {day === todayKey ? o("Today, ") : day === tomorrowKey ? o("Tomorrow, ") : ""}
                {day === todayKey || day === tomorrowKey ? dayTitle.format(new Date(list[0].starts_at)) : capital(dayTitle.format(new Date(list[0].starts_at)))}
              </h2>
              <Card className="overflow-hidden">
                <ul>
                  {list.map((b) => (
                    <li key={b.id} className="rule-top grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-3 pt-3 pr-2 pb-[13px] pl-4">
                      <time dateTime={b.starts_at} className="pt-1.5 text-sm font-medium text-gray-900 tabular">
                        {time.format(new Date(b.starts_at))}
                      </time>
                      <p className="min-w-0 pt-1 font-medium break-words text-gray-900">
                        <Link href={`${here}${here.includes("?") ? "&" : "?"}b=${b.id}`} scroll={false} className="text-[15px] hover:underline">
                          {b.customer_name}
                        </Link>
                      </p>
                      {past ? (
                        b.status === "no_show" ? (
                          <span className="mt-1 rounded-md bg-danger-soft px-2 py-0.5 text-[11px] whitespace-nowrap text-danger-ink">{o("Didn’t come")}</span>
                        ) : (
                          <form action={markNoShow} className="flex min-w-9 justify-end">
                            <input type="hidden" name="id" value={b.id} />
                            <input type="hidden" name="back" value={here} />
                            <IconSubmit label={o("{name} didn’t come", { name: b.customer_name })}>
                              <UserMinusIcon aria-hidden className="size-4.5" />
                            </IconSubmit>
                          </form>
                        )
                      ) : (
                        <form action={cancelBooking} className="row-span-1 flex min-w-9 justify-end">
                          <input type="hidden" name="id" value={b.id} />
                          <ConfirmDelete label={o("Cancel {name}’s booking at {time}", { name: b.customer_name, time: time.format(new Date(b.starts_at)) })} confirmText={o("Cancel?")} busyText={o("Cancelling…")}>
                            <XIcon aria-hidden className="size-4.5" />
                          </ConfirmDelete>
                        </form>
                      )}
                      {/* Details use the full width under the name, so the Cancel? button never squeezes them. */}
                      <div className="col-span-2 col-start-2 min-w-0 space-y-1 pr-2">
                        <p className="text-[13px] wrap-anywhere text-neutral-400">
                          {b.services?.name ?? o("Service")}
                          {b.services ? <span className="tabular">, {formatDuration(b.services.duration_minutes)}</span> : null}
                          <span className="tabular"> · {o("until {time}", { time: time.format(new Date(b.ends_at)) })}</span>
                          {showWho && b.staff ? <> · {o("with {name}", { name: b.staff.name })}</> : null}
                        </p>
                        <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-[13px]">
                          {/* The owner needs the whole email to reach the customer, so it wraps instead of being cut off. */}
                          {b.customer_email ? (
                            <a href={`mailto:${b.customer_email}`} className="flex min-w-0 items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                              <EnvelopeSimpleIcon aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
                              <span className="min-w-0 wrap-break-word">
                                <BreakableEmail email={b.customer_email} />
                              </span>
                            </a>
                          ) : null}
                          {b.customer_phone ? (
                            <a href={`tel:${b.customer_phone.replace(/[^\d+]/g, "")}`} className="flex min-w-0 items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                              <PhoneIcon aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
                              <span className="min-w-0 wrap-anywhere">{b.customer_phone}</span>
                            </a>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ))}
          {past && (page > 1 || more) ? (
            <nav aria-label={o("Pages")} className="flex justify-between gap-3">
              {page > 1 ? (
                <Link href={`/dashboard/bookings?show=past${page > 2 ? `&page=${page - 1}` : ""}`} className={buttonClass("secondary", { size: "sm" })}>
                  {o("Newer")}
                </Link>
              ) : (
                <span />
              )}
              {more ? (
                <Link href={`/dashboard/bookings?show=past&page=${page + 1}`} className={buttonClass("secondary", { size: "sm" })}>
                  {o("Older")}
                </Link>
              ) : null}
            </nav>
          ) : null}
          {past ? null : (
            <p className="px-1 text-[13px] text-neutral-400">
              {emailMode() === "gmail"
                ? o("Cancelling frees the time for others and emails the customer to say so.")
                : o("Cancelling frees the time for others. Emails aren’t switched on yet, so please let the customer know.")}
            </p>
          )}
        </div>
      )}
      {isBookingId(query.b) ? <BookingSheet id={query.b} closeHref={here} /> : null}
    </>
  );
}

export default function BookingsPage(props: PageProps<"/[lang]/dashboard/bookings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookingsContent {...props} />
    </Suspense>
  );
}
