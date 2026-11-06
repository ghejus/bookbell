import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { IconSubmit } from "@/components/form";
import { EnvelopeSimpleIcon, HourglassIcon, PhoneIcon, XIcon } from "@/components/icons";
import { Card, EmptyState, PageSkeleton } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { asUtc, longDay } from "@/lib/dates";
import { requireShop } from "@/lib/shop";
import { WAIT_COLUMNS, withFreeTimes, type WaitRow } from "@/lib/waitlist";
import { OwnerHeader } from "../account";
import { removeFromWaitlist } from "../actions/waitlist";

export const metadata: Metadata = { title: "Waitlist" };

const contactClass =
  "inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-[13px] font-medium transition-colors duration-150 hover:bg-ink/7";

async function WaitlistContent() {
  const { supabase, shop } = await requireShop();
  const today = shopToday(shop.timezone, new Date());
  const { data } = await supabase
    .from("waitlist")
    .select(WAIT_COLUMNS)
    .eq("shop_id", shop.id)
    .gte("day", today)
    .order("day")
    .order("created_at")
    .limit(100)
    .returns<WaitRow[]>();
  const waits = await withFreeTimes(supabase, data ?? []);
  const days = [...new Set(waits.map((w) => w.day))];

  return (
    <>
      <OwnerHeader
        back
        title="Waitlist"
        description="People waiting for a time on a full day. If someone cancels, they see the free time in their app. You can also call them."
      />

      {waits.length === 0 ? (
        <Card>
          <EmptyState icon={HourglassIcon} title="Nobody is waiting">
            When a day is fully booked, customers can join its waitlist from your booking page. They show up here.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-5">
          {days.map((day) => {
            const list = waits.filter((w) => w.day === day);
            return (
              <section key={day} aria-labelledby={`day-${day}`} className="space-y-2">
                <h2 id={`day-${day}`} className="flex items-baseline justify-between gap-3 px-1 text-[13px] font-medium">
                  <Link href={`/dashboard/calendar?date=${day}`} className="hover:underline">
                    {day === today ? "Today" : longDay.format(asUtc(day))}
                  </Link>
                  <span className="font-normal text-neutral-400">{list.length} waiting</span>
                </h2>
                <Card className="overflow-hidden">
                  <ul>
                    {list.map((w) => (
                      <li key={w.id} className="rule-top space-y-2.5 py-3 pr-2 pl-4">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="text-[15px] font-medium wrap-anywhere">{w.name || w.email || "A customer"}</p>
                            <p className="text-[13px] text-neutral-400 wrap-anywhere">
                              {w.serviceName || "A service that’s now hidden"} · {w.staffName ?? "anyone"}
                            </p>
                          </div>
                          {w.slots.length ? (
                            <span className="shrink-0 rounded-md bg-success-soft px-2 py-0.5 text-[11px] whitespace-nowrap text-success-ink">
                              Free now: {w.slots[0].label}
                            </span>
                          ) : null}
                          <form action={removeFromWaitlist} className="-mt-1 shrink-0">
                            <input type="hidden" name="id" value={w.id} />
                            <IconSubmit label={`Remove ${w.name || "this person"} from the waitlist`}>
                              <XIcon aria-hidden className="size-4" />
                            </IconSubmit>
                          </form>
                        </div>
                        {w.phone || w.email ? (
                          <div className="flex flex-wrap gap-2">
                            {w.phone ? (
                              <a href={`tel:${w.phone.replace(/[^\d+]/g, "")}`} className={contactClass}>
                                <PhoneIcon aria-hidden className="size-4" />
                                {w.phone}
                              </a>
                            ) : null}
                            {w.email ? (
                              <a href={`mailto:${w.email}`} className={`${contactClass} max-w-full`}>
                                <EnvelopeSimpleIcon aria-hidden className="size-4 shrink-0" />
                                <span className="truncate">{w.email}</span>
                              </a>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <WaitlistContent />
    </Suspense>
  );
}
