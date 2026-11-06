"use client";

import { FormMessage, SubmitButton, TextArea } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { saveCustomerNote } from "../actions/customers";
import { useOwnerT } from "@/lib/i18n/client";

/** The owner's private note about one customer. */
export function NoteForm({ customerKey, note }: { customerKey: string; note: string }) {
  const { state, pending, formProps } = useActionForm(saveCustomerNote);
  const o = useOwnerT();
  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="customer_key" value={customerKey} />
      <TextArea
        label={o("Your notes")}
        name="note"
        defaultValue={state?.values?.note ?? note}
        maxLength={2000}
        rows={3}
        placeholder={o("Likes it short at the back. Allergic to …")}
        hint={o("Only you see this.")}
      />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" size="sm" pending={pending} pendingText={o("Saving…")}>
        {o("Save note")}
      </SubmitButton>
    </form>
  );
}
