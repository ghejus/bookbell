"use client";

import { FormMessage, SubmitButton, TextArea } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { saveCustomerNote } from "../actions/customers";

/** The owner's private note about one customer. */
export function NoteForm({ customerKey, note }: { customerKey: string; note: string }) {
  const { state, pending, formProps } = useActionForm(saveCustomerNote);
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="customer_key" value={customerKey} />
      <TextArea
        label="Your notes"
        name="note"
        defaultValue={state?.values?.note ?? note}
        maxLength={2000}
        rows={3}
        placeholder="Likes it short at the back. Allergic to …"
        hint="Only you see this."
      />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm" pending={pending} pendingText="Saving…">
        Save note
      </SubmitButton>
    </form>
  );
}
