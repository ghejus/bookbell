import { DayStrip } from "@/components/day-strip";
import { CalendarCheckIcon, CalendarXIcon, CaretLeftIcon, CheckCircleIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, buttonClass, Card, EmptyState, Logo, PageSkeleton } from "@/components/ui";
import { whenLabel } from "@/lib/assistant/facts";
import { getAvailability, getPublicShop, shopToday } from "@/lib/booking";
import { bookingByToken, toBookingInfo } from "@/lib/booking-emails";
import { serviceLine } from "@/lib/email/templates";
import { getCurrentUser } from "@/lib/shop";
import { asUtc, dateLocale, datesFor, DAYS_SHOWN, dayWindow, isDate, shownMonths } from "@/lib/dates";
import { getT, pageLang } from "@/lib/i18n/server";
import { addDays } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/review-form";
import { Stars } from "@/components/stars";
import type { OwnReview } from "@/lib/reviews";
import { leaveReviewByToken, saveToMyBookings } from "./actions";
import { CancelForm, MoveForm } from "./manage-forms";

// The customer's private booking page, reached from the link in their emails
// and on the booking receipt. The secret token in the address is the only key.



/** After the visit: "How was it?", or the review they wrote (and the shop's reply). */
async function ReviewSection({ token, review, editing, base }: { token: string; review: OwnReview; editing: boolean; base: string }) {
  const written = review.state === "done" || review.state === "locked";
  const form = review.state === "open" || (review.state === "done" && editing);
  const [t, lang] = await Promise.all([getT(), pageLang()]);
  const shortDate = new Intl.DateTimeFormat(dateLocale(lang), { day: "numeric", month: "long" });
  return (
    <section id="review" aria-labelledby="review-title" className="scroll-mt-6">
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 id="review-title" className="text-lg font-medium">
          {written && !form ? t.reviews.yourReview : t.reviews.howWasIt}
        </h2>
        {form ? (
          <ReviewForm
            action={leaveReviewByToken}
            hidden={{ token }}
            initial={{ stars: review.stars, body: review.body }}
            submitLabel={written ? t.reviews.saveChanges : t.reviews.post}
          />
        ) : (
          <>
            <div className="space-y-2">
              <Stars stars={review.stars ?? 0} size="size-5" />
              {review.body ? <p className="text-[15px] whitespace-pre-line wrap-anywhere">{review.body}</p> : null}
            </div>
            {review.state === "done" && review.editable_until ? (
              <p className="text-sm text-neutral-400">
                {t.reviews.changeUntil(shortDate.format(new Date(review.editable_until)))}{" "}
                <Link href={`${base}?review=edit#review`} className="font-medium text-accent-400 hover:text-accent-300 hover:underline">
                  {t.reviews.changeIt}
                </Link>
              </p>
            ) : null}
          </>
        )}
        {review.reply ? (
          <div className="rounded-lg bg-raised px-4 py-3 text-sm">
            <p className="mb-1 font-medium">{t.reviews.replyFromShop}</p>
            <p className="whitespace-pre-line text-neutral-300 wrap-anywhere">{review.reply}</p>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

async function BrokenLink() {
  const t = await getT();
  return (
    <Card>
      <EmptyState icon={CalendarXIcon} title={t.manage.brokenTitle} as="h1">
        {t.manage.brokenText}
      </EmptyState>
    </Card>
  );
}

async function ManageBooking({ params, searchParams }: PageProps<"/[lang]/b/[token]">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  // The booking can change at any moment, so this always reads it fresh.
  await connection();
  if (!/^[0-9a-f]{48}$/.test(token)) return <BrokenLink />;
  const row = await bookingByToken(token);
  if (!row) return <BrokenLink />;

  // Is it in the signed-in person's My bookings already?
  const [user, supabase, t, lang] = await Promise.all([getCurrentUser(), createClient(), getT(), pageLang()]);
  const { longDay } = datesFor(lang);
  const [{ data: saved }, { data: review }] = await Promise.all([
    supabase.rpc("booking_saved_by_token", { p_token: token }),
    supabase.rpc("review_by_token", { p_token: token }).maybeSingle<OwnReview>(),
  ]);

  const info = toBookingInfo(row);
  const now = new Date();
  const live = row.status === "booked" && Date.parse(row.starts_at) > now.getTime();
  const done = ["moved", "cancelled", "saved", "not-saved", "reviewed"].includes(String(query.done)) ? String(query.done) : null;
  // The shop may close online changes some hours before the visit.
  const changeable = live && Date.parse(row.change_until) > now.getTime();
  const moving = changeable && query.move === "1";
  const base = `/b/${token}`;

  // The "pick a new time" part: same worker, same service, the shop's normal rules.
  let picker: React.ReactNode = null;
  if (moving) {
    const data = await getPublicShop(row.shop_slug);
    if (data) {
      const today = shopToday(row.shop_timezone, now);
      const lastDay = addDays(today, data.shop.booking_window_days);
      const { from, prevFrom, nextFrom } = dayWindow(today, lastDay, query.from);
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
          <div>
            <DayStrip
              title={t.manage.pickNewTime}
              titleId="move-title"
              months={shownMonths(from, DAYS_SHOWN, lang)}
              prevHref={prevFrom ? link({ from: prevFrom === today ? null : prevFrom }) : null}
              nextHref={nextFrom ? link({ from: nextFrom }) : null}
              days={days.map((d) => ({ date: d.date, free: d.slots.length }))}
              chosen={chosen?.date}
              hrefFor={(date) => link({ from: from === today ? null : from, date })}
            />
          </div>
          {chosen ? (
            <Card className="p-5 sm:p-6">
              <MoveForm key={chosen.date} token={token} slots={chosen.slots} dayLabel={longDay.format(asUtc(chosen.date))} />
            </Card>
          ) : (
            <Card>
              <EmptyState icon={CalendarXIcon} title={t.shop.noFreeTitle}>
                {nextFrom ? t.shop.tryLater : t.manage.callToFind}
              </EmptyState>
            </Card>
          )}
          <Link href={base} className="inline-block text-sm font-medium text-accent-400 hover:text-accent-300 hover:underline">
            {t.manage.keepCurrent}
          </Link>
        </section>
      );
    }
  }

  return (
    <div className="space-y-6">
      {saved === "mine" ? (
        <Link
          href="/my"
          className="-mb-2 -ml-2.5 inline-flex h-10 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-[15px] font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
        >
          <CaretLeftIcon aria-hidden className="size-5" />
          {t.common.myBookings}
        </Link>
      ) : null}
      {done === "not-saved" ? (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger-ink ring-1 ring-danger-text/30 ring-inset">
          {t.manage.otherAccount}
        </p>
      ) : done ? (
        <p role="status" className="flex items-start gap-2 rounded-lg bg-success-soft px-4 py-3 text-sm text-success-ink ring-1 ring-success-ink/30 ring-inset">
          <CheckCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          {done === "moved"
            ? t.manage.doneMoved
            : done === "saved"
              ? t.manage.doneSaved
              : done === "reviewed"
                ? t.manage.doneReviewed
                : t.manage.doneCancelled}
        </p>
      ) : null}

      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-gray-600">{t.manage.yourBookingAt}</p>
            <h1 className="text-[22px] leading-tight font-medium tracking-tight wrap-anywhere">{row.shop_name}</h1>
          </div>
          {row.status === "cancelled" ? (
            <Badge tone="warning">{t.manage.cancelled}</Badge>
          ) : row.status === "no_show" ? (
            <Badge tone="warning">{t.manage.missed}</Badge>
          ) : live ? (
            <Badge tone="success">{t.manage.booked}</Badge>
          ) : (
            <Badge>{t.manage.past}</Badge>
          )}
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div>
            <dt className="text-gray-600">{t.manage.when}</dt>
            <dd className={`font-medium tabular ${row.status === "cancelled" ? "text-gray-600 line-through" : "text-gray-900"}`}>
              {whenLabel(row.starts_at, row.shop_timezone, lang)}
            </dd>
          </div>
          <div>
            <dt className="text-gray-600">{t.manage.what}</dt>
            <dd className="font-medium wrap-anywhere text-gray-900">{serviceLine(info, lang)}</dd>
          </div>
          <div>
            <dt className="text-gray-600">{t.manage.bookedFor}</dt>
            <dd className="wrap-anywhere text-gray-900">
              {row.customer_name}, {row.customer_email}
            </dd>
          </div>
        </dl>

        {row.shop_address || row.shop_phone ? (
          <ul className="rule-top mt-5 space-y-1.5 pt-4 text-sm text-neutral-300">
            {row.shop_address ? (
              <li className="flex items-start gap-1.5">
                <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                {row.shop_address}
              </li>
            ) : null}
            {row.shop_phone ? (
              <li>
                <a href={`tel:${row.shop_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 font-medium text-accent-400 hover:text-accent-300 hover:underline">
                  <PhoneIcon aria-hidden className="size-4" />
                  {t.common.call(row.shop_phone)}
                </a>
              </li>
            ) : null}
          </ul>
        ) : null}

        {live && !changeable ? (
          <p className="mt-6 rounded-lg bg-raised px-4 py-3 text-sm text-neutral-300">
            {t.manage.tooClose}{" "}
            {row.shop_phone ? t.manage.tooCloseCall : t.manage.tooCloseTell}
          </p>
        ) : null}
        {changeable && !moving ? (
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-start">
            <Link href={`${base}?move=1`} className={buttonClass("primary", { full: true })}>
              <CalendarCheckIcon aria-hidden className="size-4" />
              {t.manage.changeTime}
            </Link>
            <div className="sm:ml-auto">
              <CancelForm token={token} />
            </div>
          </div>
        ) : null}
        {!live ? (
          <div className="mt-6">
            <Link href={`/s/${row.shop_slug}`} className={buttonClass("secondary", { full: true })}>
              {t.common.bookAnother}
            </Link>
          </div>
        ) : null}
      </Card>

      {review && review.state !== "none" ? (
        <ReviewSection token={token} review={review} editing={query.review === "edit"} base={base} />
      ) : null}

      {saved === "none" && live ? (
        user ? (
          <form action={saveToMyBookings} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 shadow-card">
            <input type="hidden" name="token" value={token} />
            <p className="text-sm text-neutral-300">{t.manage.keepWithOthers}</p>
            <button type="submit" className={buttonClass("secondary", { size: "sm" })}>
              {t.manage.addToMy}
            </button>
          </form>
        ) : (
          <p className="text-center text-[13px] text-neutral-400">
            <Link
              href={`/login?as=customer&next=${encodeURIComponent(base)}`}
              className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
            >
              {t.common.logIn}
            </Link>{" "}
            {t.manage.or}{" "}
            <Link
              href={`/signup?as=customer&next=${encodeURIComponent(base)}`}
              className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
            >
              {t.manage.makeFreeAccountLower}
            </Link>{" "}
            {t.manage.toKeepAll}
          </p>
        )
      ) : null}

      {picker}
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).manage.metaTitle, robots: { index: false, follow: false } };
}

export default async function Page(props: PageProps<"/[lang]/b/[token]">) {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<PageSkeleton />}>
          <ManageBooking {...props} />
        </Suspense>
      </main>
      <footer className="pt-6 pb-10 text-center text-sm text-gray-600">
        {t.common.bookingBy}{" "}
        <Link href="/" className="font-medium text-gray-900 hover:underline">
          <Logo className="text-sm" />
        </Link>
        <div className="mt-2 flex justify-center">
          <LanguageSwitch />
        </div>
      </footer>
    </div>
  );
}
