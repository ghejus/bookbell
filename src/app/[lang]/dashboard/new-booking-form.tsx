"use client";

import { useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { OWNER_TIMES } from "@/lib/calendar";
import { formatDuration } from "@/lib/format";
import { getTeamFreeSlots, type OpeningBlock, type StaffBusy } from "@/lib/slots";
import { ownerAddBooking } from "./actions/calendar";

export type NewBookingData = {
  services: { id: string; name: string; duration: number }[];
  staff: { id: string; name: string }[];
  /** The days to choose from, with their opening hours. */
  days: { date: string; weekday: string; num: string; hours: OpeningBlock[] }[];
  /** Taken times on those days, as ISO strings. */
  busy: { start: string; end: string; staffId: string | null }[];
  timezone: string;
  now: string;
  initial: { serviceId?: string; staffId?: string; date: string; time?: string };
  view: string;
};

const chip = "flex items-center justify-center rounded-lg border text-sm font-medium tabular transition-colors duration-150";

/**
 * Add a walk-in or phone booking: tap a service, a person, a day and a free time.
 * Times outside opening hours are still possible under "Another time".
 */
export function NewBookingForm({ data }: { data: NewBookingData }) {
  const { state, pending, formProps } = useActionForm(ownerAddBooking);
  const [serviceId, setServiceId] = useState(data.initial.serviceId ?? data.services[0]?.id ?? "");
  const [staffId, setStaffId] = useState(data.initial.staffId ?? data.staff[0]?.id ?? "");
  const [date, setDate] = useState(data.initial.date);
  const [time, setTime] = useState<string | null>(data.initial.time ?? null);
  const [needTime, setNeedTime] = useState(false);

  const service = data.services.find((s) => s.id === serviceId);
  const day = data.days.find((d) => d.date === date);
  const busy: StaffBusy[] = data.busy.map((b) => ({ start: new Date(b.start), end: new Date(b.end), staffId: b.staffId }));
  const slots =
    service && day
      ? getTeamFreeSlots(
          {
            date,
            timezone: data.timezone,
            hours: day.hours,
            durationMinutes: service.duration,
            now: new Date(data.now),
            // The owner may add someone who just walked in a few minutes late.
            minNoticeMinutes: -10,
            windowDays: 400,
            stepMinutes: 15,
          },
          busy,
          [staffId],
          staffId,
        ).map((s) => s.label)
      : [];
  const worker = data.staff.find((w) => w.id === staffId);
  const offGrid = time !== null && !slots.includes(time);

  // Changing the service, person or day keeps the time only if it is still free.
  const pick = (next: { serviceId?: string; staffId?: string; date?: string }) => {
    if (next.serviceId !== undefined) setServiceId(next.serviceId);
    if (next.staffId !== undefined) setStaffId(next.staffId);
    if (next.date !== undefined) setDate(next.date);
    setTime(null);
  };

  return (
    <form
      {...formProps}
      onSubmit={(event) => {
        if (!time) {
          event.preventDefault();
          setNeedTime(true);
          return;
        }
        formProps.onSubmit(event);
      }}
      className="space-y-5"
    >
      <input type="hidden" name="view" value={data.view} />
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time ?? ""} />
      {state?.values?.force ? <input type="hidden" name="force" value={state.values.force} /> : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Service</legend>
        <div className="space-y-2">
          {data.services.map((s) => {
            const on = s.id === serviceId;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() => pick({ serviceId: s.id })}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-left transition-colors duration-150 ${
                  on ? "bg-accent-900 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "bg-ink/4 shadow-[inset_0_0_0_1px_rgb(233_233_237/0.12)] hover:bg-ink/7"
                }`}
              >
                <span className="flex-1 text-sm font-medium wrap-anywhere">{s.name}</span>
                <span className="text-[13px] text-neutral-400 tabular">{formatDuration(s.duration)}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {data.staff.length > 1 ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">With</legend>
          <div className="flex flex-wrap gap-2">
            {data.staff.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={w.id === staffId}
                onClick={() => pick({ staffId: w.id })}
                className={`${chip} h-10 px-4 ${w.id === staffId ? "chip-on" : "chip-off"}`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Day</legend>
        <div className="grid grid-cols-7 gap-[5px]">
          {data.days.map((d) => {
            const open = d.hours.length > 0;
            const on = d.date === date;
            return (
              <button
                key={d.date}
                type="button"
                aria-pressed={on}
                aria-label={`${d.weekday} ${d.num}${open ? "" : ", closed"}`}
                onClick={() => pick({ date: d.date })}
                className={`${chip} h-[54px] flex-col ${on ? "chip-on" : open ? "chip-off" : "chip-shut"}`}
              >
                <span className="text-[11px]">{d.weekday}</span>
                <span className="text-base">{d.num}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Time</legend>
        {slots.length === 0 ? (
          <p className="mb-2 text-sm text-neutral-400">
            {day && day.hours.length === 0
              ? "The shop is closed this day. Pick another time below if you need to."
              : `${worker && data.staff.length > 1 ? worker.name : "Nobody"} has no free time left on this day.`}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === time}
                onClick={() => {
                  setTime(t);
                  setNeedTime(false);
                }}
                className={`${chip} h-10 ${t === time ? "chip-on" : "chip-off"}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <details className="mt-3 group" open={offGrid || undefined}>
          <summary className="cursor-pointer text-[13px] font-medium text-accent-400 hover:text-accent-300">Another time</summary>
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="other-time" className="text-[13px] text-neutral-400">
              Start at
            </label>
            <select
              id="other-time"
              value={offGrid ? time : ""}
              onChange={(e) => {
                setTime(e.target.value || null);
                setNeedTime(false);
              }}
              className="h-10 rounded-lg border border-line bg-ground px-2 text-sm text-ink tabular focus:border-accent focus:outline-none"
            >
              <option value="">Choose…</option>
              {OWNER_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <p className="mt-1.5 text-[13px] text-neutral-400">Opening hours don’t apply to you, but nobody can be booked twice.</p>
        </details>
      </fieldset>

      <Field label="Customer name" name="customer_name" autoComplete="off" required maxLength={80} />
      <Field label="Phone" name="customer_phone" type="tel" autoComplete="off" maxLength={40} />
      <Field
        label="Email"
        name="customer_email"
        type="email"
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        maxLength={200}
        hint="With an email, the customer gets a confirmation and a reminder."
      />
      {needTime ? <FormMessage state={{ error: "Please choose a time." }} /> : <FormMessage state={state} />}
      <div className="[&>button]:h-12 [&>button]:w-full [&>button]:text-[15px]">
        <SubmitButton pending={pending} pendingText="Adding…">
          {time ? `Add ${time}` : "Choose a time"}
        </SubmitButton>
      </div>
    </form>
  );
}
