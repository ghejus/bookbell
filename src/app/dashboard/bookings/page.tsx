import { CalendarDays, Mail, Phone, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDelete } from "@/components/form";
import { buttonClass, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { emailMode } from "@/lib/email/send";
import { formatDuration } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { cancelBooking } from "../actions";

export const metadata: Metadata = { title: "Bookings" };

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
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  services: { name: string; duration_minutes: number } | null;
  staff: { name: string } | null;
};

const PAGE_SIZE = 50;

async function BookingsContent({ searchParams }: PageProps<"/dashboard/bookings">) {
  const query = await searchParams;
  const past = query.show === "past";
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const { supabase, shop } = await requireShop();
  const now = new Date().toISOString();
  const list = supabase
    .from("bookings")
    .select("id, starts_at, ends_at, customer_name, customer_email, customer_phone, services(name, duration_minutes), staff(name)")
    .eq("shop_id", shop.id)
    .eq("status", "booked");
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
  const dayTitle = new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, weekday: "long", day: "numeric", month: "long", year: past ? "numeric" : undefined });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = dayKey.format(new Date(b.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  return (
    <>
      <PageHeader title="Bookings" description={past ? "Bookings that already happened, newest first." : "Upcoming bookings, soonest first."} />

      <div role="group" aria-label="Which bookings" className="mb-5 inline-flex rounded-lg bg-gray-200/70 p-0.5">
        {[
          { label: "Upcoming", href: "/dashboard/bookings", active: !past },
          { label: "Past", href: "/dashboard/bookings?show=past", active: past },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.active ? "true" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${t.active ? "bg-white text-gray-900 shadow-sm" : "text-gray-700 hover:text-gray-900"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 && past ? (
        <Card>
          <EmptyState icon={CalendarDays} title={page > 1 ? "No older bookings" : "No past bookings yet"}>
            Bookings move here once they are over.
          </EmptyState>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarDays} title="No bookings yet">
            Share your booking page with customers. New bookings show up here right away.
          </EmptyState>
          <div className="flex justify-center px-6 pb-8">
            <Link href={`/s/${shop.slug}`} className={buttonClass("secondary")}>
              Open my booking page
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} aria-labelledby={`day-${day}`}>
              <h2 id={`day-${day}`} className="mb-2.5 text-sm font-semibold text-gray-900">
                {dayTitle.format(new Date(list[0].starts_at))}
              </h2>
              <Card>
                <ul className="divide-y divide-gray-100">
                  {list.map((b) => (
                    <li key={b.id} className="grid grid-cols-[3rem_1fr_auto] items-start gap-x-4 py-3.5 pr-3 pl-5 sm:pr-4 sm:pl-6">
                      <time dateTime={b.starts_at} className="pt-1.5 text-sm font-semibold text-gray-900 tabular">
                        {time.format(new Date(b.starts_at))}
                      </time>
                      <p className="min-w-0 pt-1 font-semibold break-words text-gray-900">
                        <Link href={`/dashboard/calendar?date=${dayKey.format(new Date(b.starts_at))}&b=${b.id}`} className="hover:underline">
                          {b.customer_name}
                        </Link>
                      </p>
                      {past ? (
                        <span />
                      ) : (
                        <form action={cancelBooking} className="row-span-1">
                          <input type="hidden" name="id" value={b.id} />
                          <ConfirmDelete label={`Cancel ${b.customer_name}’s booking at ${time.format(new Date(b.starts_at))}`} confirmText="Cancel?" busyText="Cancelling…">
                            <X aria-hidden className="size-4.5" />
                          </ConfirmDelete>
                        </form>
                      )}
                      {/* Details use the full width under the name, so the Cancel? button never squeezes them. */}
                      <div className="col-span-2 col-start-2 min-w-0">
                        <p className="text-sm wrap-anywhere text-gray-600">
                          {b.services?.name ?? "Service"}
                          {b.services ? <span className="tabular">, {formatDuration(b.services.duration_minutes)}</span> : null}
                          <span className="tabular"> · until&nbsp;{time.format(new Date(b.ends_at))}</span>
                          {showWho && b.staff ? <> · with {b.staff.name}</> : null}
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          {/* The owner needs the whole email to reach the customer, so it wraps instead of being cut off. */}
                          {b.customer_email ? (
                            <a href={`mailto:${b.customer_email}`} className="flex min-w-0 items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                              <Mail aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
                              <span className="min-w-0 wrap-break-word">
                                <BreakableEmail email={b.customer_email} />
                              </span>
                            </a>
                          ) : null}
                          {b.customer_phone ? (
                            <a href={`tel:${b.customer_phone.replace(/[^\d+]/g, "")}`} className="flex min-w-0 items-start gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                              <Phone aria-hidden className="mt-[3px] size-3.5 shrink-0 text-gray-500" />
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
            <nav aria-label="Pages" className="flex justify-between gap-3">
              {page > 1 ? (
                <Link href={`/dashboard/bookings?show=past${page > 2 ? `&page=${page - 1}` : ""}`} className={buttonClass("secondary", { size: "sm" })}>
                  Newer
                </Link>
              ) : (
                <span />
              )}
              {more ? (
                <Link href={`/dashboard/bookings?show=past&page=${page + 1}`} className={buttonClass("secondary", { size: "sm" })}>
                  Older
                </Link>
              ) : null}
            </nav>
          ) : null}
          {past ? null : (
            <p className="text-sm text-gray-600">
              {emailMode() === "gmail"
                ? "Cancelling frees the time for others and emails the customer to say so."
                : "Cancelling frees the time for others. Emails aren’t switched on yet, so please let the customer know."}
            </p>
          )}
        </div>
      )}
    </>
  );
}

export default function BookingsPage(props: PageProps<"/dashboard/bookings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookingsContent {...props} />
    </Suspense>
  );
}
