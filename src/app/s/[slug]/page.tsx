import { CalendarX, ChevronLeft, ChevronRight, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, EmptyState, Logo, PageSkeleton } from "@/components/ui";
import { aiProvider } from "@/lib/assistant/provider";
import { getAvailability, getPublicShop, getShopMeta, shopToday } from "@/lib/booking";
import { formatDuration, formatPrice } from "@/lib/format";
import { addDays } from "@/lib/slots";
import { AboutText } from "./about-text";
import { BookingFlow, HideWhenBooked, LinkPending, PendingSwap } from "./booking-flow";
import { BookingForm } from "./booking-form";
import { ShopChat } from "./chat";

const DAYS_SHOWN = 14;
/** "Europe/Bucharest" -> "Bucharest", for customers. */
const cityOf = (tz: string) => (tz.split("/").pop() ?? tz).replaceAll("_", " ");
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShopMeta(slug);
  return shop ? { title: `Book at ${shop.name}`, description: shop.about || undefined } : { title: "Shop not found" };
}

async function BookingPage({ params, searchParams }: PageProps<"/s/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  // Free times depend on the current time, so this part always waits for a real visit.
  await connection();
  const data = await getPublicShop(slug);
  if (!data) notFound();
  const { shop, services, hours, staff } = data;

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
  const from = isDate(query.from) && query.from > today && query.from <= lastDay ? query.from : today;
  const prevFrom = from > today ? (addDays(from, -DAYS_SHOWN) < today ? today : addDays(from, -DAYS_SHOWN)) : null;
  const nextFrom = addDays(from, DAYS_SHOWN) <= lastDay ? addDays(from, DAYS_SHOWN) : null;

  const days = service ? await getAvailability(data, service, from, DAYS_SHOWN, now, worker?.id) : [];
  const chosenDate =
    service && isDate(query.date) && days.some((d) => d.date === query.date)
      ? query.date
      : days.find((d) => d.slots.length > 0)?.date;
  const chosenDay = days.find((d) => d.date === chosenDate);

  // Calendar dates as noon UTC, so formatting them never slips to the day before.
  const asUtc = (d: string) => new Date(`${d}T12:00:00Z`);
  const dayName = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });
  const dayNum = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric" });
  const longDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  // Short months ("Oct – Nov 2026") so the range fits beside the heading on small phones.
  const monthRange = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short", year: "numeric" });
  const shownMonths = (() => {
    // "October 2026", or "October – November 2026" when the two weeks cross a month.
    const first = asUtc(from);
    const last = asUtc(addDays(from, DAYS_SHOWN - 1));
    return monthRange.formatRange(first, last);
  })();

  const takingBookings = services.length > 0 && hours.length > 0;

  return (
    <>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-balance wrap-anywhere text-gray-900">{shop.name}</h1>
          {shop.about ? <AboutText text={shop.about} /> : null}
          {shop.address || shop.phone ? (
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-600">
              {shop.address ? (
                <li className="flex min-w-0 items-start gap-1.5">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                  {shop.address}
                </li>
              ) : null}
              {shop.phone ? (
                <li className="flex min-w-0 items-start gap-1.5">
                  <Phone aria-hidden className="mt-0.5 size-4 shrink-0 text-gray-500" />
                  <a href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`} className="hover:text-gray-900 hover:underline">
                    {shop.phone}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : null}
        </header>

        {!takingBookings ? (
          <Card>
            <EmptyState icon={CalendarX} title="Online booking isn’t open yet" as="h2">
              {shop.phone ? `Please call the shop at ${shop.phone} to book.` : "Please contact the shop to book."}
            </EmptyState>
          </Card>
        ) : (
          <BookingFlow>
            <HideWhenBooked>
            {/* Step 1: service */}
            <section aria-labelledby="step-service">
              <h2 id="step-service" className="mb-3 text-base font-semibold text-gray-900">
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
                        className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-card transition-colors duration-150 sm:px-5 ${
                          active ? "border-brand-700 ring-1 ring-brand-700" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold break-words text-gray-900">{s.name}</span>
                          <span className="block text-sm text-gray-600 tabular">{formatDuration(s.duration_minutes)}</span>
                        </span>
                        <LinkPending className="text-gray-500" />
                        {s.price_cents !== null ? (
                          <span className="font-semibold whitespace-nowrap text-gray-900 tabular">
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
                <h2 id="step-staff" className="mb-3 text-base font-semibold text-gray-900">
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
                            active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-900 hover:border-gray-400"
                          }`}
                        >
                          {w.name}
                          <LinkPending className={active ? "text-white" : "text-gray-500"} />
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
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 id="step-day" className="text-base font-semibold whitespace-nowrap text-gray-900">
                    {step(3)}. Choose a day
                  </h2>
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-sm whitespace-nowrap text-gray-600 tabular">{shownMonths}</span>
                    {prevFrom ? (
                      <Link href={href({ service: service.id, from: prevFrom })} scroll={false} aria-label="Earlier days" className="relative flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
                        <ChevronLeft aria-hidden className="size-4.5" />
                        <LinkPending className="absolute text-gray-500" />
                      </Link>
                    ) : null}
                    {nextFrom ? (
                      <Link href={href({ service: service.id, from: nextFrom })} scroll={false} aria-label="Later days" className="relative flex size-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100">
                        <ChevronRight aria-hidden className="size-4.5" />
                        <LinkPending className="absolute text-gray-500" />
                      </Link>
                    ) : null}
                  </div>
                </div>
                <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
                  {days.map((d) => {
                    const open = d.slots.length > 0;
                    const active = d.date === chosenDate;
                    const weekday = dayName.format(asUtc(d.date));
                    const number = <span className="text-lg font-semibold tabular">{dayNum.format(asUtc(d.date))}</span>;
                    return (
                      <li key={d.date} className="shrink-0">
                        {open ? (
                          <Link
                            href={href({ service: service.id, from: from === today ? undefined : from, date: d.date })}
                            scroll={false}
                            aria-current={active ? "date" : undefined}
                            aria-label={`${longDay.format(asUtc(d.date))}, ${d.slots.length} free times`}
                            className={`relative flex h-16 w-14 flex-col items-center justify-center rounded-lg border transition-colors duration-150 sm:w-full ${
                              active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white text-gray-900 hover:border-gray-400"
                            }`}
                          >
                            {/* While the day loads, the spinner takes the weekday's place. */}
                            <span className="flex h-4 items-center text-xs font-medium">
                              <PendingSwap>{weekday}</PendingSwap>
                            </span>
                            {number}
                          </Link>
                        ) : (
                          <span
                            aria-label={`${longDay.format(asUtc(d.date))}, no free times`}
                            className="flex h-16 w-14 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 text-gray-600 sm:w-full"
                          >
                            <span className="flex h-4 items-center text-xs font-medium">{weekday}</span>
                            {number}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-sm text-gray-600">Times are {cityOf(shop.timezone)} time.</p>
              </section>
            ) : null}
            </HideWhenBooked>

            {/* Step 4 (or 3): time and details */}
            {service ? (
              <section aria-label="Choose a time">
                <HideWhenBooked>
                  <h2 className="mb-3 text-base font-semibold text-gray-900">{step(4)}. Choose a time</h2>
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
                    />
                  </Card>
                ) : (
                  <Card>
                    <EmptyState icon={CalendarX} title="No free times in these two weeks">
                      {nextFrom ? "Try the later days with the arrow above." : "Please check again soon, or call the shop."}
                    </EmptyState>
                  </Card>
                )}
              </section>
            ) : null}
          </BookingFlow>
        )}
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
      />
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
      <footer className="pt-6 pb-24 text-center text-sm text-gray-600 sm:pb-28">
        Booking by{" "}
        <Link href="/" className="font-medium text-gray-900 hover:underline">
          <Logo className="text-sm" />
        </Link>
      </footer>
    </div>
  );
}
