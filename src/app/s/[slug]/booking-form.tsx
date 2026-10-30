"use client";

import { CalendarCheck, CalendarPlus, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { buttonClass } from "@/components/ui";
import { bookAppointment } from "./actions";
import { useBookingFlow } from "./booking-flow";

type Props = {
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  serviceId: string;
  serviceName: string;
  serviceSummary: string;
  durationMinutes: number;
  timezone: string;
  dayLabel: string;
  slots: { iso: string; label: string }[];
  /** Link back to the start, for "Book another time". */
  againHref: string;
};

const whenFormat = (timezone: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: timezone, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** Morning, afternoon and evening, like a paper appointment book. */
function groupSlots(slots: Props["slots"]) {
  const groups = [
    { name: "Morning", slots: slots.filter((s) => s.label < "12:00") },
    { name: "Afternoon", slots: slots.filter((s) => s.label >= "12:00" && s.label < "17:00") },
    { name: "Evening", slots: slots.filter((s) => s.label >= "17:00") },
  ];
  return groups.filter((g) => g.slots.length > 0);
}

/** A calendar file (.ics) the customer can add to their phone's calendar. */
export function calendarHref({ start, minutes, title, location, shopName }: { start: string; minutes: number; title: string; location: string; shopName: string }) {
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
  const begins = new Date(start);
  const ends = new Date(begins.getTime() + minutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookbell//Booking//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(begins)}-${Math.random().toString(36).slice(2)}@bookbell`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(begins)}`,
    `DTEND:${stamp(ends)}`,
    `SUMMARY:${esc(`${title} at ${shopName}`)}`,
    location ? `LOCATION:${esc(location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** Step 3: pick a time, then name and email. Shows the receipt after booking. */
export function BookingForm(props: Props) {
  const { shopId, serviceId, timezone, dayLabel, slots, againHref } = props;
  const { state, pending, formProps } = useActionForm(bookAppointment);
  const { setBooked } = useBookingFlow();
  const [picked, setPicked] = useState<string | null>(null);
  const [needTime, setNeedTime] = useState(false);
  const grid = useRef<HTMLFieldSetElement>(null);
  const pickedLabel = slots.find((s) => s.iso === picked)?.label;
  const booked = state?.message === "booked" && state.values ? state.values : null;

  useEffect(() => {
    if (!booked) return;
    setBooked(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [booked, setBooked]);

  if (booked) {
    return (
      <div role="status" className="py-2 text-center">
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-green-50 text-green-800">
          <CalendarCheck aria-hidden className="size-5" />
        </span>
        <h2 className="text-lg font-semibold text-gray-900">You’re booked</h2>
        <p className="mt-2 text-gray-900">{props.serviceSummary}</p>
        <p className="font-semibold text-gray-900 tabular">{whenFormat(timezone).format(new Date(booked.starts_at))}</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-gray-600">Booked for {booked.customer_email}. Keep this page or add it to your calendar.</p>

        <a
          href={calendarHref({ start: booked.starts_at, minutes: props.durationMinutes, title: props.serviceName, location: props.shopAddress, shopName: props.shopName })}
          download="booking.ics"
          className={`${buttonClass("secondary")} mt-5`}
        >
          <CalendarPlus aria-hidden className="size-4" />
          Add to calendar
        </a>

        <div className="mx-auto mt-6 max-w-sm border-t border-gray-100 pt-5 text-sm text-gray-700">
          <p>If you can’t make it, please let {props.shopName} know.</p>
          <ul className="mt-2 flex flex-col items-center gap-1.5">
            {props.shopAddress ? (
              <li className="flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4 text-gray-500" />
                {props.shopAddress}
              </li>
            ) : null}
            {props.shopPhone ? (
              <li>
                <a href={`tel:${props.shopPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 hover:underline">
                  <Phone aria-hidden className="size-4" />
                  Call {props.shopPhone}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <Link
          href={againHref}
          onClick={() => setBooked(false)}
          className="mt-6 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800 hover:underline"
        >
          Book another time
        </Link>
      </div>
    );
  }

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        // No time picked yet (also right after someone else took the chosen one).
        if (!picked || !pickedLabel) {
          event.preventDefault();
          setNeedTime(true);
          grid.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        formProps.onSubmit(event);
      }}
      className="space-y-6"
    >
      <input type="hidden" name="shop_id" value={shopId} />
      <input type="hidden" name="service_id" value={serviceId} />

      <fieldset ref={grid} className="scroll-mt-4">
        <legend className="mb-3 text-sm font-medium text-gray-900">Free times on {dayLabel}</legend>
        <div className="space-y-4">
          {groupSlots(slots).map((group) => (
            <div key={group.name}>
              <p className="mb-2 text-xs font-medium text-gray-600">{group.name}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.slots.map((s) => (
                  <label key={s.iso} className="relative">
                    <input
                      type="radio"
                      name="starts_at"
                      value={s.iso}
                      checked={picked === s.iso}
                      onChange={() => {
                        setPicked(s.iso);
                        setNeedTime(false);
                      }}
                      className="peer sr-only"
                    />
                    <span className="flex h-11 cursor-pointer items-center justify-center rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 tabular shadow-sm transition-colors duration-150 peer-checked:border-brand-700 peer-checked:bg-brand-700 peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 hover:border-gray-400">
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-5 border-t border-gray-100 pt-6">
        <Field label="Your name" name="customer_name" autoComplete="name" required maxLength={80} />
        <Field
          label="Email"
          name="customer_email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={200}
          hint="Only the shop sees it."
        />
        <Field label="Phone" name="customer_phone" type="tel" autoComplete="tel" maxLength={40} />
        {/* Hidden from people; only bots fill it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
      </div>

      <FormMessage state={needTime ? { error: "Please choose a time." } : state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Booking…">
          {pickedLabel ? `Book ${pickedLabel}` : "Choose a time"}
        </SubmitButton>
      </div>
    </form>
  );
}
