import { CalendarDays, Mail, Phone, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDelete } from "@/components/form";
import { buttonClass, Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { cancelBooking } from "../actions";

export const metadata: Metadata = { title: "Bookings" };

type Booking = {
  id: string;
  starts_at: string;
  ends_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  services: { name: string; duration_minutes: number } | null;
};

async function BookingsContent() {
  const { supabase, shop } = await requireShop();
  const { data } = await supabase
    .from("bookings")
    .select("id, starts_at, ends_at, customer_name, customer_email, customer_phone, services(name, duration_minutes)")
    .eq("shop_id", shop.id)
    .eq("status", "booked")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at")
    .limit(200)
    .returns<Booking[]>();
  const bookings = data ?? [];

  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: shop.timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayTitle = new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: shop.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  const groups = new Map<string, Booking[]>();
  for (const b of bookings) {
    const key = dayKey.format(new Date(b.starts_at));
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }

  return (
    <>
      <PageHeader title="Bookings" description="Upcoming bookings, soonest first." />

      {bookings.length === 0 ? (
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
                      <p className="min-w-0 pt-1 font-semibold break-words text-gray-900">{b.customer_name}</p>
                      <form action={cancelBooking} className="row-span-1">
                        <input type="hidden" name="id" value={b.id} />
                        <ConfirmDelete label={`Cancel ${b.customer_name}’s booking at ${time.format(new Date(b.starts_at))}`} confirmText="Cancel?" busyText="Cancelling…">
                          <X aria-hidden className="size-4.5" />
                        </ConfirmDelete>
                      </form>
                      {/* Details use the full width under the name, so the Cancel? button never squeezes them. */}
                      <div className="col-span-2 col-start-2 min-w-0">
                        <p className="text-sm text-gray-600">
                          {b.services?.name ?? "Service"}
                          {b.services ? <span className="tabular">, {formatDuration(b.services.duration_minutes)}</span> : null}
                          <span className="tabular"> · until&nbsp;{time.format(new Date(b.ends_at))}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <a href={`mailto:${b.customer_email}`} className="flex min-w-0 items-center gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                            <Mail aria-hidden className="size-3.5 shrink-0 text-gray-500" />
                            <span className="truncate">{b.customer_email}</span>
                          </a>
                          {b.customer_phone ? (
                            <a href={`tel:${b.customer_phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 hover:underline">
                              <Phone aria-hidden className="size-3.5 text-gray-500" />
                              {b.customer_phone}
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
          <p className="text-sm text-gray-600">
            Cancelling frees the time for others. The customer isn’t told automatically yet, so please let them know.
          </p>
        </div>
      )}
    </>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BookingsContent />
    </Suspense>
  );
}
