import { CalendarSlashIcon, TrashIcon, XIcon } from "@/components/icons";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { ConfirmDelete, Field, IconSubmit, Select, SubmitButton } from "@/components/form";
import { Badge, Card, CardSection, PageSkeleton } from "@/components/ui";
import { OwnerHeader } from "../account";
import { WEEKDAYS } from "@/lib/format";
import { requireShop } from "@/lib/shop";
import { DateTimeField } from "./date-time-field";
import { addOpeningHours, addStandardWeek, addTimeOff, deleteOpeningHours, deleteTimeOff } from "../actions/hours";
import { capital, dateLocale } from "@/lib/dates";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Opening hours") };
}

type Hours = { id: string; weekday: number; opens: string; closes: string };
type TimeOff = { id: string; starts_at: string; ends_at: string; reason: string; staff: { name: string } | null };
type Worker = { id: string; name: string };

const hm = (t: string) => t.slice(0, 5);

/** 05:00, 05:15 … 23:45: picked from a list so every screen shows the same 24-hour times. */
const TIMES = Array.from({ length: (24 - 5) * 4 }, (_, i) => {
  const minutes = 5 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});

async function HoursContent() {
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  // Monday … Sunday in the owner's language (2 November 2026 was a Monday).
  const dayNames = WEEKDAYS.map((_, i) =>
    capital(new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: "UTC", weekday: "long" }).format(new Date(Date.UTC(2026, 10, 2 + i, 12)))),
  );
  const [{ data: hoursData }, { data: offData }, { data: staffData }] = await Promise.all([
    supabase
      .from("opening_hours")
      .select("id, weekday, opens, closes")
      .eq("shop_id", shop.id)
      .order("weekday")
      .order("opens")
      .returns<Hours[]>(),
    supabase
      .from("time_off")
      .select("id, starts_at, ends_at, reason, staff(name)")
      .eq("shop_id", shop.id)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .returns<TimeOff[]>(),
    supabase.from("staff").select("id, name").eq("shop_id", shop.id).order("created_at").returns<Worker[]>(),
  ]);
  const hours = hoursData ?? [];
  const timeOff = offData ?? [];
  const team = staffData ?? [];
  // With one person, "the whole shop" and "that person" mean the same, so don't ask.
  const askWho = team.length >= 2;
  const when = new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: shop.timezone, dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <OwnerHeader back
        title={o("Opening hours")}
        description={o("Customers can only book inside these hours. Times are in {zone} time.", { zone: shop.timezone.replaceAll("_", " ") })}
      />

      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-6">
            <h2 className="text-base font-medium text-gray-900">{o("Your week")}</h2>
            {hours.length === 0 ? (
              <form action={addStandardWeek}>
                <SubmitButton variant="secondary" pendingText={o("Adding…")}>
                  {o("Fill Mon–Fri, 09:00–17:00")}
                </SubmitButton>
              </form>
            ) : null}
          </div>
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {dayNames.map((dayName, i) => {
              const day = hours.filter((h) => h.weekday === i + 1);
              return (
                <li key={dayName} className="grid grid-cols-[6rem_1fr] items-start gap-x-4 px-5 py-2.5 sm:px-6">
                  {/* Same height as one time block, so the day name lines up with the first block. */}
                  <span className="flex h-9 items-center text-sm font-medium text-gray-900">{dayName}</span>
                  {day.length === 0 ? (
                    <span className="flex h-9 items-center">
                      <Badge>{o("Closed")}</Badge>
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {day.map((h) => (
                        <form
                          key={h.id}
                          action={deleteOpeningHours}
                          className="flex items-center rounded-lg bg-gray-50 pl-3 text-sm font-medium text-gray-900 ring-1 ring-gray-200 ring-inset"
                        >
                          <time className="tabular whitespace-nowrap">
                            {hm(h.opens)}–{hm(h.closes)}
                          </time>
                          <input type="hidden" name="id" value={h.id} />
                          <IconSubmit label={o("Remove {day} {from} to {to}", { day: dayName, from: hm(h.opens), to: hm(h.closes) })}>
                            <XIcon aria-hidden className="size-4" />
                          </IconSubmit>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        <CardSection title={o("Add hours")} description={o("For a lunch break, add two blocks on the same day, like 09:00–13:00 and 14:00–18:00.")}>
          <ActionForm action={addOpeningHours} submitLabel={o("Add hours")} pendingText={o("Adding…")}>
            <div className="grid gap-5 sm:grid-cols-3">
              <Select label={o("Day")} name="weekday" defaultValue="1">
                {dayNames.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </Select>
              <Select label={o("Opens")} name="opens" defaultValue="09:00">
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <Select label={o("Closes")} name="closes" defaultValue="17:00">
                {TIMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
          </ActionForm>
        </CardSection>

        <CardSection title={o("Days off")} description={o("Holidays, or any time you can’t take bookings. Only you can see the reason.")}>
          {timeOff.length > 0 ? (
            <ul className="-mx-5 mb-6 divide-y divide-gray-100 border-y border-gray-100 sm:-mx-6">
              {timeOff.map((t) => (
                <li key={t.id} className="flex items-start gap-3 py-2.5 pr-3 pl-5 sm:pr-4 sm:pl-6">
                  {/* Top-aligned, so the icon and button stay with the dates when a long reason wraps. */}
                  <CalendarSlashIcon aria-hidden className="mt-0.5 size-4.5 shrink-0 text-gray-500" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-gray-900 tabular">
                      <time dateTime={t.starts_at}>{when.format(new Date(t.starts_at))}</time> –{" "}
                      <time dateTime={t.ends_at}>{when.format(new Date(t.ends_at))}</time>
                    </p>
                    {askWho ? (
                      <p className="font-medium wrap-anywhere text-gray-900">{t.staff ? o("{name} is off", { name: t.staff.name }) : o("Whole shop closed")}</p>
                    ) : null}
                    {t.reason ? <p className="wrap-anywhere text-gray-600">{t.reason}</p> : null}
                  </div>
                  <form action={deleteTimeOff}>
                    <input type="hidden" name="id" value={t.id} />
                    <ConfirmDelete label={o("Remove this time off")}>
                      <TrashIcon aria-hidden className="size-4.5" />
                    </ConfirmDelete>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-5 text-sm text-gray-600">{o("No days off planned.")}</p>
          )}
          <ActionForm action={addTimeOff} submitLabel={o("Add time off")} pendingText={o("Adding…")}>
            <div className="grid gap-5 sm:grid-cols-2">
              <DateTimeField label={o("From")} name="starts_at" />
              <DateTimeField label={o("Until")} name="ends_at" />
            </div>
            <p className="-mt-2 text-sm text-gray-600">
              {o("Dates may show in your device’s style. Saved in {zone} time.", { zone: shop.timezone.replaceAll("_", " ") })}
            </p>
            {askWho ? (
              <Select label={o("Who is off?")} name="staff_id" defaultValue="">
                <option value="">{o("Whole shop (nobody can be booked)")}</option>
                {team.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Field label={o("Reason")} name="reason" maxLength={200} placeholder={o("Christmas holiday")} hint={o("Private. Customers never see it.")} />
          </ActionForm>
        </CardSection>
      </div>
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function HoursPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HoursContent />
    </Suspense>
  );
}
