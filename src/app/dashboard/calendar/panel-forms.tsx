"use client";

import { Field, FormMessage, Select, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { OWNER_TIMES } from "@/lib/calendar";
import { ownerMoveBooking } from "../actions";

type Option = { id: string; name: string };

/** Times every 15 minutes, plus the current one if it is off that grid (like 10:05). */
function timeOptions(current: string) {
  return OWNER_TIMES.includes(current) ? OWNER_TIMES : [...OWNER_TIMES, current].sort();
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
