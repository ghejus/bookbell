"use client";

import { FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingText?: string;
  children: React.ReactNode;
};

/**
 * An "add something" form: shows the action's error or success message under
 * the fields, keeps the typing on errors, and clears itself after a success.
 */
export function ActionForm({ action, submitLabel, pendingText, children }: Props) {
  const { state, pending, formProps } = useActionForm(action, { resetOnSuccess: true });
  return (
    <form {...formProps} className="space-y-5">
      {children}
      <FormMessage state={state} />
      <div className="sm:flex sm:justify-end">
        <SubmitButton full pending={pending} pendingText={pendingText}>
          {submitLabel}
        </SubmitButton>
      </div>
    </form>
  );
}
