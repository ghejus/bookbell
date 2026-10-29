"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action-state";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Runs a server action from a form, but keeps what the person typed when the
 * action returns an error. (React normally clears the form after every
 * submit, which would wipe a long answer because of one typo.)
 * The form is cleared only after a success message, when `resetOnSuccess` is set.
 */
export function useActionForm(action: Action, { resetOnSuccess = false } = {}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.message) formRef.current?.reset();
  }, [state, resetOnSuccess]);

  const formProps = {
    ref: formRef,
    // Still a normal form action, so it works before JavaScript loads.
    action: formAction,
    onSubmit(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => formAction(data));
    },
  };

  return { state, pending, formProps };
}
