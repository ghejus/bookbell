"use client";

import { whenLabel } from "@/lib/assistant/facts";
import { useLang, useT } from "@/lib/i18n/client";
import { CalendarCheckIcon, CalendarDotsIcon, CalendarPlusIcon, MapPinIcon, PhoneIcon } from "@/components/icons";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { TimeGrid } from "@/components/time-grid";
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
  /** When the page was made, signed by the server (stops robots). */
  ticket: string;
};


/** Step 3: pick a time, then name and email. Shows the receipt after booking. */
export function BookingForm(props: Props) {
  const { shopId, serviceId, timezone, dayLabel, slots, againHref } = props;
  const { state, pending, formProps } = useActionForm(bookAppointment);
  const { setBooked } = useBookingFlow();
  const t = useT();
  const lang = useLang();
  const [picked, setPicked] = useState<string | null>(null);
  const [needTime, setNeedTime] = useState(false);
  // Keep the first ticket: after a failed try the page refreshes with a new
  // one, and a quick second try must not look "too fast".
  const [ticket] = useState(props.ticket);
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
        <h2 className="text-[19px] font-medium">{t.common.youreBooked}</h2>
        <p className="mt-2 text-[15px]">
          {props.serviceSummary}
          {props.staffName ? <>, {t.common.withWorker(props.staffName)}</> : null}
        </p>
        <p className="text-[15px] font-medium tabular">{whenLabel(booked.starts_at, timezone, lang)}</p>
        <p className="mx-auto mt-3 max-w-sm text-sm text-neutral-400">
          {props.emailsOn
            ? t.book.detailsSent(booked.customer_email)
            : props.account
              ? t.book.bookedFor(booked.customer_email)
              : t.book.bookedForKeep(booked.customer_email)}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <a
            href={calendarHref({ start: booked.starts_at, minutes: props.durationMinutes, title: props.serviceName, location: props.shopAddress, shopName: props.shopName })}
            download="booking.ics"
            className={buttonClass("secondary")}
          >
            <CalendarPlusIcon aria-hidden className="size-4" />
            {t.common.addToCalendar}
          </a>
          {props.account ? (
            <Link href="/my" className={buttonClass("secondary")}>
              <CalendarDotsIcon aria-hidden className="size-4" />
              {t.common.myBookings}
            </Link>
          ) : booked.manage_path ? (
            <Link href={booked.manage_path} className={buttonClass("secondary")}>
              <CalendarDotsIcon aria-hidden className="size-4" />
              {t.common.changeOrCancel}
            </Link>
          ) : null}
        </div>
        {props.account ? (
          <p className="mx-auto mt-3 max-w-sm text-[13px] text-neutral-400">{t.book.savedToMy}</p>
        ) : booked.manage_path ? (
          <p className="mx-auto mt-3 max-w-sm text-[13px] text-neutral-400">
            {t.book.wantAllInOne}{" "}
            <Link
              href={`/signup?as=customer&next=${encodeURIComponent(booked.manage_path)}`}
              className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
            >
              {t.common.makeFreeAccount}
            </Link>
          </p>
        ) : null}

        <div className="rule-top mx-auto mt-6 max-w-sm pt-5 text-sm text-neutral-300">
          <p>
            {props.account
              ? t.book.plansMy
              : booked.manage_path
              ? props.emailsOn
                ? t.book.plansEmail
                : t.book.plansKeep
              : t.book.letShopKnow(props.shopName)}
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
                  {t.common.call(props.shopPhone)}
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
          {t.common.bookAnother}
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

      <TimeGrid
        ref={grid}
        slots={slots}
        dayLabel={dayLabel}
        picked={picked}
        onPick={(iso) => {
          setPicked(iso);
          setNeedTime(false);
        }}
      />

      <div className="rule-top space-y-5 pt-6">
        <Field label={t.common.yourName} name="customer_name" autoComplete="name" required maxLength={80} defaultValue={props.account?.name || undefined} />
        <Field
          label={t.common.email}
          name="customer_email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          required
          maxLength={200}
          defaultValue={props.account?.email || undefined}
          hint={t.common.onlyShopSees}
        />
        <Field label={t.common.phone} name="customer_phone" type="tel" autoComplete="tel" maxLength={40} />
        {/* Hidden from people; only bots fill it in. */}
        <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </div>
        <input type="hidden" name="ticket" value={ticket} />
      </div>

      <FormMessage state={needTime ? { error: t.book.pleaseChooseTime } : state} />
      <div className="[&>button]:h-12 [&>button]:w-full [&>button]:text-[15px]">
        <SubmitButton pending={pending} pendingText={t.common.booking}>
          {pickedLabel ? t.common.bookAt(pickedLabel) : t.common.chooseTime}
        </SubmitButton>
      </div>
      {props.account ? null : (
        <p className="text-center text-[13px] text-neutral-400">
          {t.book.haveAccount}{" "}
          <Link
            href={`/login?as=customer&next=${encodeURIComponent(props.pagePath)}`}
            className="font-medium text-accent-400 hover:text-accent-300 hover:underline"
          >
            {t.common.logIn}
          </Link>{" "}
          {t.book.keepInOnePlace}
        </p>
      )}
    </form>
  );
}
