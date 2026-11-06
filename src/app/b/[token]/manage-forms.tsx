"use client";

import { useState } from "react";
import { FormMessage, SubmitButton } from "@/components/form";
import { TimeGrid, type Slot } from "@/components/time-grid";
import { useActionForm } from "@/components/use-action-form";
import { buttonClass } from "@/components/ui";
import { cancelMyBooking, moveMyBooking } from "./actions";

/** Cancel needs two taps: "Cancel booking", then "Yes, cancel it". */
export function CancelForm({ token }: { token: string }) {
  const { state, pending, formProps } = useActionForm(cancelMyBooking);
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" onClick={() => setAsking(true)} className={buttonClass("danger", { full: true })}>
        Cancel booking
      </button>
    );
  }
  return (
    <form {...formProps} className="w-full space-y-3 rounded-lg bg-red-50 p-4 ring-1 ring-red-200 ring-inset">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm font-medium text-red-900">Cancel this booking? The time goes back to other customers.</p>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-danger bg-danger-soft px-4 text-sm font-medium text-danger-ink disabled:opacity-60"
        >
          {pending ? "Cancelling…" : "Yes, cancel it"}
        </button>
        <button type="button" onClick={() => setAsking(false)} disabled={pending} className={buttonClass("secondary")}>
          Keep it
        </button>
      </div>
    </form>
  );
}

/** The free times on one day; pick one and move the booking there. */
export function MoveForm({ token, slots, dayLabel }: { token: string; slots: Slot[]; dayLabel: string }) {
  const { state, pending, formProps } = useActionForm(moveMyBooking);
  const [picked, setPicked] = useState<string | null>(null);
  const pickedLabel = slots.find((s) => s.iso === picked)?.label;

  return (
    <form {...formProps} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      <TimeGrid slots={slots} dayLabel={dayLabel} picked={picked} onPick={setPicked} />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Moving…">
          {pickedLabel ? `Move to ${pickedLabel}` : "Choose a new time"}
        </SubmitButton>
      </div>
    </form>
  );
}
