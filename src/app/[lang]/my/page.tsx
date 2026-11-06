import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-sheet";
import { ConfirmDelete, SubmitButton } from "@/components/form";
import { BellRingingIcon, CalendarBlankIcon, CalendarPlusIcon, ClockClockwiseIcon, HourglassIcon, StarIcon } from "@/components/icons";
import { buttonClass, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { accountInfo } from "@/lib/account";
import { formatDuration, formatPrice } from "@/lib/format";
import { calendarHref } from "@/lib/ics";
import { ReviewForm } from "@/components/review-form";
import { Sheet, SheetHeader } from "@/components/sheet";
import { Stars } from "@/components/stars";
import type { OwnReview } from "@/lib/reviews";
import { asUtc, capital, dateLocale, datesFor } from "@/lib/dates";
import { getT, pageLang } from "@/lib/i18n/server";
import { bookHref, WAIT_COLUMNS, withFreeTimes, type WaitRow } from "@/lib/waitlist";
import { cancelFromMyBookings, changeMyBooking, leaveMyReview, leaveMyWait } from "./actions";
import { myBookings, type MyBooking } from "./data";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).my.title };
}

const minutesOf = (b: MyBooking) => Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000);


async function MyBookingsContent({ searchParams }: { searchParams: PageProps<"/[lang]/my">["searchParams"] }) {
  const [{ bookings, supabase, userId }, account, query, t, lang] = await Promise.all([myBookings(), accountInfo(), searchParams, getT(), pageLang()]);
  const fmt = (tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dateLocale(lang), { timeZone: tz, ...o });
  const { longDay } = datesFor(lang);
  // Which past visits can get (or already have) a review, and the days they're waiting for.
  const [{ data: reviewRows }, { data: waitRows }] = await Promise.all([
    supabase.rpc("my_reviews"),
    supabase.from("waitlist").select(WAIT_COLUMNS).eq("customer_id", userId).order("day").order("created_at").limit(20).returns<WaitRow[]>(),
  ]);
  const waits = (await withFreeTimes(supabase, waitRows ?? [])).filter((w) => !w.past);
  const reviews = new Map(((reviewRows ?? []) as (OwnReview & { booking_id: string })[]).map((r) => [r.booking_id, r]));
  const reviewing = typeof query.review === "string" ? bookings.find((b) => b.booking_id === query.review) : undefined;
  const reviewingState = reviewing ? reviews.get(reviewing.booking_id) : undefined;
  const now = new Date().getTime();
  const upcoming = bookings.filter((b) => b.status === "booked" && Date.parse(b.ends_at) > now);
  const past = bookings.filter((b) => !upcoming.includes(b)).reverse();
  const shops = new Set(upcoming.map((b) => b.shop_name));

  return (
    <>
      <PageHeader
        title={t.my.title}
        eyebrow={upcoming.length ? (shops.size === 1 ? t.my.upcomingAt(upcoming.length, [...shops][0]) : t.my.upcoming(upcoming.length)) : t.my.everyShop}
        action={<AccountButton account={account} mode="customer" />}
      />

      <div className="space-y-3.5">
        {upcoming.length === 0 ? (
          <Card>
            <EmptyState icon={CalendarBlankIcon} title={t.my.noneTitle}>
              {t.my.noneText}
            </EmptyState>
            <div className="flex justify-center px-6 pb-8">
              <Link href="/my/shops" className={buttonClass("secondary")}>
                {t.my.bookATime}
              </Link>
            </div>
          </Card>
        ) : (
          upcoming.map((b) => {
            const tz = b.shop_timezone;
            const time = fmt(tz, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
            const price = formatPrice(b.price_cents, b.shop_currency, lang);
            const started = Date.parse(b.starts_at) <= now;
            // The shop may close online changes some hours before the visit.
            const changeable = Date.parse(b.change_until) > now;
            return (
              <Card key={b.booking_id} className="space-y-3.5 p-[18px]">
                <div className="space-y-0.5">
                  <p className="text-[13px] text-accent-300">{capital(fmt(tz, { weekday: "long", day: "numeric", month: "long" }).format(new Date(b.starts_at)))}</p>
                  <p className="text-2xl font-medium tracking-tight tabular">
                    {time.format(new Date(b.starts_at))}–{time.format(new Date(b.ends_at))}
                  </p>
                  <p className="pt-1 text-[15px]">
                    {[b.service_name, formatDuration(minutesOf(b)), price].filter(Boolean).join(", ")}
                    {b.team_size > 1 ? ` · ${t.common.withWorker(b.staff_name)}` : ""}
                  </p>
                  <p className="text-sm text-neutral-400 wrap-anywhere">
                    <Link href={`/s/${b.shop_slug}`} className="hover:text-ink hover:underline">
                      {b.shop_name}
                    </Link>
                    {b.shop_address ? ` · ${b.shop_address}` : ""}
                  </p>
                </div>
                {started ? (
                  <p className="text-sm text-neutral-400">{t.my.happeningNow}</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {changeable ? (
                    <form action={changeMyBooking}>
                      <input type="hidden" name="id" value={b.booking_id} />
                      <div className="[&>button]:h-10 [&>button]:shadow-none">
                        <SubmitButton size="sm">
                          <ClockClockwiseIcon aria-hidden className="size-4" />
                          {t.my.changeTime}
                        </SubmitButton>
                      </div>
                    </form>
                    ) : null}
                    <a
                      href={calendarHref({
                        start: b.starts_at,
                        minutes: minutesOf(b),
                        title: b.service_name,
                        location: b.shop_address,
                        shopName: b.shop_name,
                        uid: b.booking_id,
                      })}
                      download="booking.ics"
                      className={`${buttonClass("secondary", { size: "sm" })} h-10`}
                    >
                      <CalendarPlusIcon aria-hidden className="size-4" />
                      {t.common.addToCalendar}
                    </a>
                    {changeable ? (
                      <form action={cancelFromMyBookings}>
                        <input type="hidden" name="id" value={b.booking_id} />
                        <ConfirmDelete text label={t.my.cancelLabel(b.service_name)} confirmText={t.my.cancelAsk} busyText={t.manage.cancelling}>
                          {t.my.cancel}
                        </ConfirmDelete>
                      </form>
                    ) : (
                      <p className="basis-full text-sm text-neutral-400">{t.my.tooClose}</p>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {waits.length ? (
          <section aria-labelledby="waiting" className="space-y-2 pt-2.5">
            <h2 id="waiting" className="px-1 text-[13px] font-medium">
              {t.waitlist.waitingTitle}
            </h2>
            <Card className="overflow-hidden">
              <ul>
                {waits.map((w) => {
                  const open = w.slots.length > 0;
                  return (
                    <li key={w.id} className="rule-top space-y-2.5 px-4 py-3.5">
                      <div className="flex items-start gap-3">
                        {open ? (
                          <BellRingingIcon aria-hidden weight="fill" className="mt-0.5 size-5 shrink-0 text-accent-400" />
                        ) : (
                          <HourglassIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-neutral-500" />
                        )}
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="text-[15px] font-medium">{longDay.format(asUtc(w.day))}</p>
                          <p className="text-sm text-neutral-400 wrap-anywhere">
                            {w.serviceName || t.waitlist.aService}
                            {w.staffName ? ` ${t.common.withWorker(w.staffName)}` : ""} ·{" "}
                            <Link href={`/s/${w.shopSlug}`} className="hover:text-ink hover:underline">
                              {w.shopName}
                            </Link>
                          </p>
                          <p className={`pt-1 text-sm ${open ? "font-medium text-success-ink" : "text-neutral-400"}`}>
                            {open
                              ? t.waitlist.opened(`${w.slots.slice(0, 4).map((s) => s.label).join(", ")}${w.slots.length > 4 ? " …" : ""}`)
                              : w.gone
                                ? t.waitlist.gone
                                : t.waitlist.stillFull}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pl-8">
                        {open ? (
                          <Link href={bookHref(w)} className={`${buttonClass("primary", { size: "sm" })} h-10`}>
                            {t.waitlist.bookIt}
                          </Link>
                        ) : null}
                        <form action={leaveMyWait}>
                          <input type="hidden" name="id" value={w.id} />
                          <SubmitButton variant="ghost" size="sm">
                            {t.waitlist.leaveShort}
                          </SubmitButton>
                        </form>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ) : null}

        {past.length ? (
          <section aria-labelledby="past" className="space-y-2 pt-2.5">
            <h2 id="past" className="px-1 text-[13px] font-medium">
              {t.my.past}
            </h2>
            <Card className="overflow-hidden">
              <ul>
                {past.slice(0, 30).map((b) => {
                  const review = reviews.get(b.booking_id);
                  return (
                    <li key={b.booking_id} className="rule-top px-4 py-[13px] text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="min-w-0 wrap-anywhere">
                          {b.service_name}
                          <span className="text-neutral-400"> · {b.shop_name}</span>
                          {b.status === "cancelled" ? <span className="text-neutral-500"> · {t.my.cancelled}</span> : null}
                          {b.status === "no_show" ? <span className="text-neutral-500"> · {t.my.missed}</span> : null}
                        </span>
                        <span className="shrink-0 text-neutral-400 tabular">
                          {fmt(b.shop_timezone, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(b.starts_at))}
                        </span>
                      </div>
                      {review?.state === "open" ? (
                        <Link
                          href={`/my?review=${b.booking_id}`}
                          scroll={false}
                          className="-ml-2 mt-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
                        >
                          <StarIcon aria-hidden weight="fill" className="size-4" />
                          {t.reviews.leave}
                        </Link>
                      ) : review?.stars ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Stars stars={review.stars} size="size-3.5" />
                          {review.state === "done" ? (
                            <Link href={`/my?review=${b.booking_id}`} scroll={false} className="text-[13px] font-medium text-accent-400 hover:underline">
                              {t.reviews.edit}
                            </Link>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        ) : null}
      </div>

      {reviewing && reviewingState && (reviewingState.state === "open" || reviewingState.state === "done") ? (
        <Sheet label={t.reviews.sheetLabel} closeHref="/my">
          <SheetHeader
            title={t.reviews.howWasIt}
            description={`${reviewing.service_name} · ${reviewing.shop_name}`}
            closeHref="/my"
          />
          <ReviewForm
            key={reviewing.booking_id}
            action={leaveMyReview}
            hidden={{ id: reviewing.booking_id }}
            initial={{ stars: reviewingState.stars, body: reviewingState.body }}
            submitLabel={reviewingState.state === "done" ? t.reviews.saveChanges : t.reviews.post}
          />
        </Sheet>
      ) : null}
    </>
  );
}

export default function MyBookingsPage({ searchParams }: PageProps<"/[lang]/my">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MyBookingsContent searchParams={searchParams} />
    </Suspense>
  );
}
