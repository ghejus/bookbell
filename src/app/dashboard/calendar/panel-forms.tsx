"use client";

import { Field, FormMessage, Select, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { OWNER_TIMES } from "@/lib/calendar";
import { ownerAddBooking, ownerMoveBooking } from "../actions";

type Option = { id: string; name: string };

/** Times every 15 minutes, plus the current one if it is off that grid (like 10:05). */
function timeOptions(current: string) {
  return OWNER_TIMES.includes(current) ? OWNER_TIMES : [...OWNER_TIMES, current].sort();
}

/** The "add a phone or walk-in booking" form. */
export function AddBookingForm({
  services,
  staff,
  date,
  time,
  staffId,
  view,
}: {
  services: (Option & { label: string })[];
  staff: Option[];
  date: string;
  time: string;
  staffId?: string;
  view: string;
}) {
  const { state, pending, formProps } = useActionForm(ownerAddBooking);
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="view" value={view} />
      {/* After a "that's outside your hours" warning, the next press goes ahead. */}
      {state?.values?.force ? <input type="hidden" name="force" value={state.values.force} /> : null}
      <Select label="Service" name="service_id" defaultValue={services[0]?.id} required>
        {services.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </Select>
      {staff.length > 1 ? (
        <Select label="With" name="staff_id" defaultValue={staffId ?? staff[0]?.id} required>
          {staff.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      ) : (
        <input type="hidden" name="staff_id" value={staff[0]?.id ?? ""} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" name="date" type="date" defaultValue={date} required />
        <Select label="Time" name="time" defaultValue={time} required>
          {timeOptions(time).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      <Field label="Customer’s name" name="customer_name" autoComplete="off" required maxLength={80} />
      <Field label="Phone" name="customer_phone" type="tel" autoComplete="off" maxLength={40} />
      <Field
        label="Email"
        name="customer_email"
        type="email"
        inputMode="email"
        autoComplete="off"
        spellCheck={false}
        maxLength={200}
        hint="Optional. With an email, the customer gets a confirmation and a reminder."
      />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Adding…">
          Add booking
        </SubmitButton>
      </div>
    </form>
  );
}

/** Move a booking to another time and/or person. */
export function MoveBookingForm({
  bookingId,
  staff,
  date,
  time,
  staffId,
  view,
}: {
  bookingId: string;
  staff: Option[];
  date: string;
  time: string;
  staffId: string;
  view: string;
}) {
  const { state, pending, formProps } = useActionForm(ownerMoveBooking);
  return (
    <form {...formProps} className="space-y-4">
      <input type="hidden" name="id" value={bookingId} />
      <input type="hidden" name="view" value={view} />
      {state?.values?.force ? <input type="hidden" name="force" value={state.values.force} /> : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="New date" name="date" type="date" defaultValue={date} required />
        <Select label="New time" name="time" defaultValue={time} required>
          {timeOptions(time).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </div>
      {staff.length > 1 ? (
        <Select label="With" name="staff_id" defaultValue={staffId} required>
          {staff.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </Select>
      ) : (
        <input type="hidden" name="staff_id" value={staffId} />
      )}
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton variant="secondary" pending={pending} pendingText="Moving…">
          Move
        </SubmitButton>
      </div>
    </form>
  );
}
