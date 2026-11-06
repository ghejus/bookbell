import { CalendarXIcon, CaretRightIcon, MapPinIcon, PhoneIcon, StarIcon } from "@/components/icons";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-sheet";
import { CustomerTabs } from "@/components/customer-tabs";
import { DayStrip } from "@/components/day-strip";
import { Card, EmptyState, Logo, PageSkeleton } from "@/components/ui";
import { accountFor } from "@/lib/account";
import { aiProvider } from "@/lib/assistant/provider";
import { getAvailability, getPublicShop, getShopMeta, shopToday } from "@/lib/booking";
import { emailMode } from "@/lib/email/send";
import { formatDuration, formatPrice } from "@/lib/format";
import { mediaUrl } from "@/lib/media";
import { averageText, getShopRating, getShopReviews, reviewCount, REVIEWS_ON_SHOP_PAGE } from "@/lib/reviews";
import { ReviewList } from "@/components/review-list";
import { Stars } from "@/components/stars";
import { getCurrentUser } from "@/lib/shop";
import { asUtc, DAYS_SHOWN, dayWindow, isDate, longDay, shownMonths } from "@/lib/dates";
import { addDays } from "@/lib/slots";
import { bookingTicket } from "@/lib/visitor";
import { AboutText } from "./about-text";
import { BookingFlow, HideWhenBooked, LinkPending, PendingSwap } from "./booking-flow";
import { BookingForm } from "./booking-form";
import { ShopChat } from "./chat";

/** "Europe/Bucharest" -> "Bucharest", for customers. */
const cityOf = (tz: string) => (tz.split("/").pop() ?? tz).replaceAll("_", " ");

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopMeta(slug);
  return shop ? { title: `Book at ${shop.name}`, description: shop.about || undefined } : { title: "Shop not found" };
}

async function BookingPage({ params, searchParams }: PageProps<"/s/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // Free times depend on the current time, so this part always waits for a real visit.
  await connection();
  const [data, user] = await Promise.all([getPublicShop(slug), getCurrentUser()]);
  if (!data) notFound();
  const { shop, services, hours, staff, photos } = data;
  const ticket = bookingTicket(shop.id);
  const [rating, reviews] = await Promise.all([
    getShopRating(data.supabase, shop.id),
    getShopReviews(data.supabase, shop.id, REVIEWS_ON_SHOP_PAGE),
  ]);

  const now = new Date();
  const today = shopToday(shop.timezone, now);
  const lastDay = addDays(today, shop.booking_window_days);
  const service = services.find((s) => s.id === query.service);
  // "Who?" is only asked when there is a real choice. No worker picked means "anyone".
  const pickWorker = staff.length >= 2;
  const worker = pickWorker ? staff.find((w) => w.id === query.staff) : undefined;
  // Links keep the chosen worker unless they say otherwise.
  const href = (q: Record<string, string | undefined>) => {
    const all = { service: q.service, staff: "staff" in q ? q.staff : worker?.id, from: q.from, date: q.date };
    const p = new URLSearchParams(Object.entries(all).filter((e): e is [string, string] => Boolean(e[1])));
    return `/s/${shop.slug}${p.size ? `?${p}` : ""}`;
  };
  const step = (n: number) => (pickWorker || n < 2 ? n : n - 1);

  // The two weeks shown, kept inside today … last bookable day.
  const { from, prevFrom, nextFrom } = dayWindow(today, lastDay, query.from);

  const days = service ? await getAvailability(data, service, from, DAYS_SHOWN, now, worker?.id) : [];
  const chosenDate =
    service && isDate(query.date) && days.some((d) => d.date === query.date)
      ? query.date
      : days.find((d) => d.slots.length > 0)?.date;
  const chosenDay = days.find((d) => d.date === chosenDate);

  const takingBookings = services.length > 0 && hours.length > 0;

  return (
    <>
      <div className="space-y-6">
        <header>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              {shop.logo_path ? (
                <Image src={mediaUrl(shop.logo_path)} alt="" width={56} height={56} unoptimized className="size-14 shrink-0 rounded-xl shadow-card" />
              ) : null}
              <h1 className="min-w-0 text-[28px] leading-tight font-medium tracking-tight text-balance wrap-anywhere">{shop.name}</h1>
            </div>
            {user ? (
              <AccountButton account={accountFor(user)} mode="customer" />
            ) : (
              <Link
                href={`/login?as=customer&next=${encodeURIComponent(`/s/${shop.slug}`)}`}
                className="mt-1 shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
              >
                Log in
              </Link>
            )}
          </div>
          {rating.total > 0 ? (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-1.5 rounded-lg text-sm hover:underline">
              <StarIcon aria-hidden weight="fill" className="size-4 text-accent-400" />
              <span className="font-medium tabular">{averageText(rating.average)}</span>
              <span className="text-neutral-400">· {reviewCount(rating.total)}</span>
            </a>
          ) : null}
          {shop.about ? <AboutText text={shop.about} /> : null}
          {shop.address || shop.phone ? (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-600">
              {shop.address ? (
                <li className="flex min-w-0 items-start gap-1.5">
                  <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                  {shop.address}
                </li>
              ) : null}
              {shop.phone ? (
                <li className="flex min-w-0 items-start gap-1.5">
                  <PhoneIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                  <a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className="hover:text-gray-900 hover:underline">
                    {shop.phone}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
          {photos.length ? (
            // A row of photos to swipe through; on a computer it scrolls with the keyboard too.
            <ul
              tabIndex={0}
              aria-label={`Photos of ${shop.name}`}
              className="-mx-4 mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto [scrollbar-width:thin] scroll-px-4 px-4 pb-1 outline-none focus-visible:ring-2 focus-visible:ring-accent sm:mx-0 sm:scroll-px-0 sm:px-0"
            >
              {photos.map((path, i) => (
                <li key={path} className="relative aspect-[4/3] w-[72%] max-w-[300px] shrink-0 snap-start overflow-hidden rounded-xl bg-raised sm:w-[46%]">
                  <Image
                    src={mediaUrl(path)}
                    alt={`${shop.name}, photo ${i + 1}`}
                    fill
                    sizes="300px"
                    unoptimized
                    className="object-cover"
                    loading={i < 2 ? "eager" : "lazy"}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </header>

        {!takingBookings ? (
          <Card>
            <EmptyState icon={CalendarXIcon} title="Online booking isn’t open yet" as="h2">
              {shop.phone ? `Please call the shop at ${shop.phone} to book.` : "Please contact the shop to book."}
            </EmptyState>
          </Card>
        ) : (
          <BookingFlow>
            <HideWhenBooked>
            {/* Step 1: service */}
            <section aria-labelledby="step-service">
              <h2 id="step-service" className="mb-3 text-base font-medium text-gray-900">
                1. Choose a service
              </h2>
              <ul className="space-y-2.5">
                {services.map((s) => {
                  const active = s.id === service?.id;
                  return (
                    <li key={s.id}>
                      <Link
                        href={href({ service: s.id })}
                        scroll={false}
                        aria-current={active ? "true" : undefined}
                        className={`flex items-center gap-3 rounded-lg px-4 py-[13px] transition-[background-color,box-shadow] duration-150 ${
                          active
                            ? "bg-accent-900 shadow-[0_0_0_1px_var(--color-accent),0_0_18px_rgb(145_132_217/0.18)]"
                            : "bg-surface shadow-card hover:bg-raised"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium break-words text-gray-900">{s.name}</span>
                          <span className="block text-sm text-gray-600 tabular">{formatDuration(s.duration_minutes)}</span>
                        </span>
                        <LinkPending className="text-gray-500" />
                        {s.price_cents !== null ? (
                          <span className="font-medium whitespace-nowrap text-gray-900 tabular">
                            {formatPrice(s.price_cents, shop.currency)}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Step 2: who (only for shops with two or more workers) */}
            {service && pickWorker ? (
              <section aria-labelledby="step-staff">
                <h2 id="step-staff" className="mb-3 text-base font-medium text-gray-900">
                  2. Who would you like?
                </h2>
                <ul className="flex flex-wrap gap-2">
                  {[{ id: undefined, name: "Anyone" }, ...staff].map((w) => {
                    const active = w.id === worker?.id;
                    return (
                      <li key={w.id ?? "anyone"} className="max-w-full">
                        <Link
                          href={href({ service: service.id, staff: w.id, from: from === today ? undefined : from })}
                          scroll={false}
                          aria-current={active ? "true" : undefined}
                          className={`flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium wrap-anywhere transition-colors duration-150 ${
                            active ? "chip-on" : "chip-off"
                          }`}
                        >
                          {w.name}
                          <LinkPending className={active ? "text-accent-200" : "text-gray-500"} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {/* Step 3 (or 2): day */}
            {service ? (
              <section aria-labelledby="step-day">
                <DayStrip
                  title={<>{step(3)}. Choose a day</>}
                  titleId="step-day"
                  months={shownMonths(from)}
                  prevHref={prevFrom ? href({ service: service.id, from: prevFrom }) : null}
                  nextHref={nextFrom ? href({ service: service.id, from: nextFrom }) : null}
                  arrowPending={<LinkPending className="absolute text-neutral-500" />}
                  days={days.map((d) => ({ date: d.date, free: d.slots.length }))}
                  chosen={chosenDate}
                  hrefFor={(date) => href({ service: service.id, from: from === today ? undefined : from, date })}
                  weekday={(name) => <PendingSwap>{name}</PendingSwap>}
                />
                <p className="mt-2 text-sm text-gray-600">Times are {cityOf(shop.timezone)} time.</p>
              </section>
            ) : null}
            </HideWhenBooked>

            {/* Step 4 (or 3): time and details */}
            {service ? (
              <section aria-label="Choose a time">
                <HideWhenBooked>
                  <h2 className="mb-3 text-base font-medium text-gray-900">{step(4)}. Choose a time</h2>
                </HideWhenBooked>
                {chosenDay && chosenDay.slots.length > 0 ? (
                  <Card className="p-5 sm:p-6">
                    <BookingForm
                      key={`${service.id}-${worker?.id ?? "anyone"}-${chosenDay.date}`}
                      shopId={shop.id}
                      staffId={worker?.id}
                      staffName={worker?.name}
                      shopName={shop.name}
                      shopAddress={shop.address}
                      shopPhone={shop.phone}
                      serviceId={service.id}
                      serviceName={service.name}
                      durationMinutes={service.duration_minutes}
                      serviceSummary={`${service.name}, ${formatDuration(service.duration_minutes)}${
                        service.price_cents !== null ? `, ${formatPrice(service.price_cents, shop.currency)}` : ""
                      }`}
                      timezone={shop.timezone}
                      dayLabel={longDay.format(asUtc(chosenDay.date))}
                      slots={chosenDay.slots}
                      againHref={href({})}
                      emailsOn={emailMode() === "gmail"}
                      account={user ? { name: user.name, email: user.email } : null}
                      pagePath={`/s/${shop.slug}`}
                      ticket={ticket}
                    />
                  </Card>
                ) : (
                  <Card>
                    <EmptyState icon={CalendarXIcon} title="No free times in these two weeks">
                      {nextFrom ? "Try the later days with the arrow above." : "Please check again soon, or call the shop."}
                    </EmptyState>
                  </Card>
                )}
              </section>
            ) : null}
          </BookingFlow>
        )}

        {rating.total > 0 ? (
          <section id="reviews" aria-labelledby="reviews-title" className="scroll-mt-6 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
              <h2 id="reviews-title" className="text-base font-medium">
                Reviews
              </h2>
              <p className="flex items-center gap-2 text-sm">
                <Stars stars={rating.average} size="size-3.5" />
                <span className="font-medium tabular">{averageText(rating.average)}</span>
                <span className="text-neutral-400">· {reviewCount(rating.total)}</span>
              </p>
            </div>
            <ReviewList reviews={reviews} shopName={shop.name} />
            {rating.total > reviews.length ? (
              <Link
                href={`/s/${shop.slug}/reviews`}
                className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
              >
                See all {rating.total} reviews
                <CaretRightIcon aria-hidden className="size-4" />
              </Link>
            ) : null}
          </section>
        ) : null}
      </div>
      {/* Outside the stack above, so its spacing never touches the chat window. */}
      <ShopChat
        slug={shop.slug}
        shopId={shop.id}
        shopName={shop.name}
        shopAddress={shop.address}
        shopPhone={shop.phone}
        timezone={shop.timezone}
        practice={aiProvider() === "practice"}
        raised={Boolean(user)}
        ticket={ticket}
      />
      {user ? <CustomerTabs /> : null}
    </>
  );
}

export default function Page(props: PageProps<"/s/[slug]">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {/* The shop page reads the web address, so it renders fresh on each visit. */}
        <Suspense fallback={<PageSkeleton />}>
          <BookingPage {...props} />
        </Suspense>
      </main>
      {/* Extra room at the bottom so the chat button never covers the footer. */}
      <footer className="pt-6 pb-36 text-center text-[13px] text-neutral-400">
        Booking by{" "}
        <Link href="/" className="font-medium hover:underline">
          <Logo className="text-sm" />
        </Link>
      </footer>
    </div>
  );
}
