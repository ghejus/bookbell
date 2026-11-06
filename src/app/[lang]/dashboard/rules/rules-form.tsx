"use client";

import { FormMessage, Select, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { type BookingRules, choicesFor, daysLabel, hoursLabel, minutesLabel } from "@/lib/booking-rules";
import { saveBookingRules } from "../actions/rules";

type Rule = {
  name: keyof BookingRules;
  label: string;
  hint: string;
  show: (n: number) => string;
};

const WHEN: Rule[] = [
  {
    name: "booking_window_days",
    label: "How far ahead people can book",
    hint: "Customers can’t pick days later than this.",
    show: daysLabel,
  },
  {
    name: "min_notice_minutes",
    label: "Notice you need",
    hint: "Nobody can book a time that starts sooner than this.",
    show: (m) => (m === 0 ? "None (book right up to the time)" : minutesLabel(m)),
  },
  {
    name: "slot_step_minutes",
    label: "Times start every",
    hint: "15 min shows 09:00, 09:15, 09:30 …",
    show: minutesLabel,
  },
];

const AFTER: Rule[] = [
  {
    name: "buffer_minutes",
    label: "Gap after each booking",
    hint: "Time to clean up or breathe. Customers can’t book inside it. You still can.",
    show: (m) => (m === 0 ? "No gap" : minutesLabel(m)),
  },
  {
    name: "cancel_deadline_hours",
    label: "Customers can cancel or change online until",
    hint: "After that they have to call you. You can always change it yourself.",
    show: hoursLabel,
  },
];

export function RulesForm({ rules }: { rules: BookingRules }) {
  const { state, pending, formProps } = useActionForm(saveBookingRules);
  const value = (name: keyof BookingRules) => Number(state?.values?.[name] ?? rules[name]);

  const group = (title: string, list: Rule[]) => (
    <fieldset className="space-y-5">
      <legend className="mb-4 text-base font-medium text-ink">{title}</legend>
      {list.map((r) => (
        <Select key={r.name} label={r.label} name={r.name} hint={r.hint} defaultValue={String(value(r.name))}>
          {choicesFor(r.name, rules[r.name]).map((n) => (
            <option key={n} value={n}>
              {r.show(n)}
            </option>
          ))}
        </Select>
      ))}
    </fieldset>
  );

  return (
    <form {...formProps} className="space-y-8">
      {group("When people can book", WHEN)}
      <div className="rule-top pt-6">{group("Around each booking", AFTER)}</div>
      <FormMessage state={state} />
      <div className="sm:flex sm:justify-end">
        <SubmitButton full pending={pending}>
          Save rules
        </SubmitButton>
      </div>
    </form>
  );
}
