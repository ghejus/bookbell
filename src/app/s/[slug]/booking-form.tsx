"use client";

import { CalendarCheckIcon, CalendarDotsIcon, CalendarPlusIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { buttonClass } from "@/components/ui";
import { calendarHref } from "@/lib/ics";
import { bookAppointment } from "./actions";
import { useBookingFlow } from "./booking-flow";

type Props = {
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  /** The chosen worker, or nothing for "anyone". */
  staffId?: string;
  staffName?: string;
  serviceId: string;
  serviceName: string;
  serviceSummary: string;
  durationMinutes: number;
  timezone: string;
  dayLabel: string;
  slots: { iso: string; label: string }[];
  /** Link back to the start, for "Book another time". */
  againHref: string;
  /** True when confirmation emails really go out (Gmail is set up). */
  emailsOn?: boolean;
  /** The signed-in customer, if any: their details are filled in and the booking goes to My bookings. */
  account?: { name: string; email: string } | null;
  /** This page's address, to come back here after logging in. */
  pagePath: string;
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
        <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-success-soft text-success-ink shadow-[inset_0_0_0_1px_rgb(134_217_165/0.3)]">
          <CalendarCheckIcon aria-hidden className="size-[21px]" />
        </span>
        <h2 className="text-[19px] font-medium">You’re booked</h2>
        <p className="mt-2 text-[15px]">
          {props.serviceSummary}
          {props.staffName ? <>, with {props.staffName}</> : null}
        </p>
        <p className="text-[15px] font-medium tabular">{whenFormat(timezone).format(new Date(booked.starts_at))}</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-neutral-400">
          {props.emailsOn
            ? `We sent the details to ${booked.customer_email}.`
            : props.account
              ? `Booked for ${booked.customer_email}.`
              : `Booked for ${booked.customer_email}. Keep this page or add it to your calendar.`}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <a
            href={calendarHref({ start: booked.starts_at, minutes: props.durationMinutes, title: props.serviceName, location: props.shopAddress, shopName: props.shopName })}
            download="booking.ics"
            className={buttonClass("secondary")}
          >
            <CalendarPlusIcon aria-hidden className="size-4" />
            Add to calendar
          </a>
          {props.account ? (
            <Link href="/my" className={buttonClass("secondary")}>
              <CalendarDotsIcon aria-hidden className="size-4" />
              My bookings
            </Link>
          ) : booked.manage_path ? (
            <Link href={booked.manage_path} className={buttonClass("secondary")}>
              <CalendarDotsIcon aria-hidden className="size-4" />
              Change or cancel
            </Link>
          ) : null}
        </div>
        {props.account ? (
          <p className="mx-auto mt-3 max-w-sm text-[13px] text-neutral-400">Saved to My bookings, where you can change or cancel it.</p>
        ) : booked.manage_path ? (
          <p className="mx-auto mt-3 max-w-sm text-[13px] text-neutral-400">
            Want all your bookings in one place?{" "}
            <Link
              href={`/signup?as=customer&next=${encodeURIComponent(booked.manage_path)}`}
              className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
            >
              Make a free account
            </Link>
          </p>
        ) : null}

        <div className="rule-top mx-auto mt-6 max-w-sm pt-5 text-sm text-neutral-300">
          <p>
            {props.account
              ? "Plans change? Use My bookings, or call the shop."
              : booked.manage_path
              ? props.emailsOn
                ? "Plans change? Use the link in your email, or call the shop."
                : "Plans change? Keep the “Change or cancel” link, or call the shop."
              : `If you can’t make it, please let ${props.shopName} know.`}
          </p>
          <ul className="mt-2 flex flex-col items-center gap-1.5">
            {props.shopAddress ? (
              <li className="flex items-center gap-1.5">
                <MapPinIcon aria-hidden className="size-4 text-gray-500" />
                {props.shopAddress}
              </li>
            ) : null}
            {props.shopPhone ? (
              <li>
                <a href={`tel:${props.shopPhone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 font-medium text-accent-400 hover:text-accent-300 hover:underline">
                  <PhoneIcon aria-hidden className="size-4" />
                  Call {props.shopPhone}
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        <Link
          href={againHref}
          onClick={() => setBooked(false)}
          className="mt-6 inline-block text-sm font-medium text-accent-400 hover:text-accent-300 hover:underline"
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
      {props.staffId ? <input type="hidden" name="staff_id" value={props.staffId} /> : null}

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
                    <span className="flex h-11 cursor-pointer items-center justify-center rounded-lg border chip-off text-sm font-medium tabular transition-colors duration-150 peer-checked:chip-on peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="rule-top space-y-5 pt-6">
        <Field label="Your name" name="customer_name" autoComplete="name" required maxLength={80} defaultValue={props.account?.name || undefined} />
        <Field
          label="Email"
          name="customer_email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={200}
          defaultValue={props.account?.email || undefined}
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
      <div className="[&>button]:h-12 [&>button]:w-full [&>button]:text-[15px]">
        <SubmitButton pending={pending} pendingText="Booking…">
          {pickedLabel ? `Book ${pickedLabel}` : "Choose a time"}
        </SubmitButton>
      </div>
      {props.account ? null : (
        <p className="text-center text-[13px] text-neutral-400">
          Have an account?{" "}
          <Link
            href={`/login?as=customer&next=${encodeURIComponent(props.pagePath)}`}
            className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
          >
            Log in
          </Link>{" "}
          to keep your bookings in one place.
        </p>
      )}
    </form>
  );
}
