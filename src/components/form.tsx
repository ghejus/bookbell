"use client";

import { CheckIcon, CaretDownIcon, WarningCircleIcon, CircleNotchIcon } from "@/components/icons";
import { useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const pending = pendingProp ?? status.pending;
  // Small buttons keep their word while busy, so the row doesn't jump.
  const busyText = size === "sm" ? children : (pendingText ?? t.common.saving);
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      aria-label={label}
      className={buttonClass(variant, { full, size })}
    >
      {pending && size !== "sm" ? <CircleNotchIcon aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
      {pending ? busyText : children}
    </button>
  );
}

/** A small icon button inside a form, for quick actions like hide or remove. */
export function IconSubmit({ label, children, tone = "neutral" }: { label: string; children: React.ReactNode; tone?: "neutral" | "danger" }) {
  const { pending } = useFormStatus();
  const color = tone === "danger" ? "text-neutral-500 hover:bg-danger-text/10 hover:text-danger-text" : "text-neutral-500 hover:bg-ink/7 hover:text-ink";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-50 ${color}`}
    >
      {pending ? <CircleNotchIcon aria-hidden className="size-4 motion-safe:animate-spin" /> : children}
    </button>
  );
}

/**
 * Delete needs two taps: the first asks "Delete?", the second does it.
 * It resets after a few seconds, so a stray tap never deletes anything.
 */
export function ConfirmDelete({
  label,
  children,
  confirmText,
  busyText,
  wide = false,
  text = false,
}: {
  label: string;
  children: React.ReactNode;
  confirmText?: string;
  busyText?: string;
  /** A full-width button with a word (children) instead of a small icon. */
  wide?: boolean;
  /** A small button with a word (children), like "Cancel". */
  text?: boolean;
}) {
  const { pending } = useFormStatus();
  const t = useT();
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
        className={`flex items-center justify-center gap-1.5 rounded-lg border border-danger bg-danger-soft px-3 text-sm font-medium text-danger-ink transition-colors duration-150 disabled:opacity-60 ${wide ? "h-11 w-full" : text ? "h-10" : "h-9"}`}
      >
        {pending ? <CircleNotchIcon aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
        {pending ? (busyText ?? t.common.deleting) : (confirmText ?? t.common.deleteAsk)}
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
      aria-label={wide || text ? undefined : label}
      title={wide || text ? undefined : label}
      className={
        text
          ? "flex h-10 items-center rounded-lg px-3 text-sm font-medium text-neutral-300 transition-colors duration-150 hover:bg-danger-text/10 hover:text-danger-text"
          : wide
          ? "flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium text-danger-text transition-colors duration-150 hover:bg-danger-text/8"
          : "flex size-9 items-center justify-center rounded-lg text-neutral-500 transition-colors duration-150 hover:bg-danger-text/10 hover:text-danger-text"
      }
    >
      {children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger-ink ring-1 ring-danger-text/30 ring-inset">
        <WarningCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="flex items-start gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success-ink ring-1 ring-success-ink/30 ring-inset">
        <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        {state.message}
      </p>
    );
  }
  return null;
}

const controlClass =
  "block w-full rounded-lg border border-line bg-ground px-3 text-base text-ink transition-[border-color,box-shadow] duration-150 hover:border-ink/45 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20 disabled:opacity-45 sm:text-sm";

type FieldBase = { label: string; name: string; hint?: React.ReactNode; className?: string };

function Label({ htmlFor, children, optional }: { htmlFor: string; children: React.ReactNode; optional?: boolean }) {
  const t = useT();
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-gray-900">
      {children}
      {optional ? <span className="ml-1 font-normal text-gray-600">{t.common.optional}</span> : null}
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
        <CaretDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500" />
      </div>
      <Hint id={hintId}>{hint}</Hint>
    </div>
  );
}
