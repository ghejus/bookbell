"use client";

import { Check, ChevronDown, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

// Interactive form pieces shared by every screen.

type SubmitProps = {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  full?: boolean;
  /** Longer name for screen readers, when the visible word is short (like "Hide"). */
  label?: string;
  /** Pass this when the form is sent by useActionForm (useFormStatus can't see that). */
  pending?: boolean;
};

export function SubmitButton({ children, pendingText, variant = "primary", size, full, label, pending: pendingProp }: SubmitProps) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  // Small buttons keep their word while busy, so the row doesn't jump.
  const busyText = size === "sm" ? children : (pendingText ?? "Saving…");
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      className={buttonClass(variant, { full, size })}
    >
      {pending && size !== "sm" ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
      {pending ? busyText : children}
    </button>
  );
}

/** A small icon button inside a form, for quick actions like hide or remove. */
export function IconSubmit({ label, children, tone = "neutral" }: { label: string; children: React.ReactNode; tone?: "neutral" | "danger" }) {
  const { pending } = useFormStatus();
  const color = tone === "danger" ? "text-gray-500 hover:bg-red-50 hover:text-red-700" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-50 ${color}`}
    >
      {pending ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : children}
    </button>
  );
}

/**
 * Delete needs two taps: the first asks "Delete?", the second does it.
 * It resets after a few seconds, so a stray tap never deletes anything.
 */
export function ConfirmDelete({ label, children }: { label: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (armed || pending) {
    return (
      <button
        key="confirm"
        type="submit"
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-red-700 disabled:opacity-60"
      >
        {pending ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
        {pending ? "Deleting…" : "Delete?"}
      </button>
    );
  }
  return (
    <button
      key="arm"
      type="button"
      onClick={(event) => {
        // Separate buttons (different keys) plus preventDefault, so this tap
        // can never also count as a tap on the "Delete?" button that replaces it.
        event.preventDefault();
        setArmed(true);
      }}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-700"
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-800 ring-1 ring-red-200 ring-inset">
        <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-800 ring-1 ring-green-200 ring-inset">
        <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

const controlClass =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 shadow-sm transition-colors duration-150 placeholder:text-gray-500 hover:border-gray-400 focus:border-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-100 disabled:bg-gray-50 sm:text-sm";

type FieldBase = { label: string; name: string; hint?: React.ReactNode; className?: string };

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-900">
      {children}
      {optional ? <span className="ml-1 font-normal text-gray-600">(optional)</span> : null}
    </label>
  );
}

function Hint({ id, children }: { id: string; children?: React.ReactNode }) {
  return children ? (
    <p id={id} className="mt-1.5 text-sm text-gray-600">
      {children}
    </p>
  ) : null;
}

export function Field({
  label,
  name,
  hint,
  className,
  suffix,
  ...rest
}: FieldBase & { suffix?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "className">) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={!rest.required && rest.type !== "hidden"}>
        {label}
      </Label>
      <div className="relative">
        <input
          id={id}
          name={name}
          aria-describedby={hint ? hintId : undefined}
          className={`${controlClass} h-11 ${suffix ? "pr-12" : ""}`}
          {...rest}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-600">{suffix}</span>
        ) : null}
      </div>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

export function TextArea({
  label,
  name,
  hint,
  className,
  ...rest
}: FieldBase & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "className">) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <Label htmlFor={id} optional={!rest.required}>
        {label}
      </Label>
      <textarea
        id={id}
        name={name}
        rows={4}
        aria-describedby={hint ? hintId : undefined}
        className={`${controlClass} py-2.5`}
        {...rest}
      />
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}

export function Select({
  label,
  name,
  hint,
  className,
  children,
  ...rest
}: FieldBase & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "className">) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          name={name}
          aria-describedby={hint ? hintId : undefined}
          className={`${controlClass} h-11 appearance-none pr-10`}
          {...rest}
        >
          {children}
        </select>
        {/* Our own arrow, so dropdowns match the text boxes instead of the browser's default. */}
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" />
      </div>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}
