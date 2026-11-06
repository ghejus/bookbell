"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { XIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";

/**
 * A panel that slides up from the bottom on phones (a "bottom sheet") and in
 * from the right on computers. It is a real <dialog>, so the keyboard stays
 * inside it, Escape closes it, and screen readers know it is on top.
 *
 * Close it with `closeHref` (a page address, for sheets opened from a link
 * like ?b=123) or with `onClose` (for sheets the page opens itself).
 */
export function Sheet({
  label,
  closeHref,
  onClose,
  children,
}: {
  label: string;
  closeHref?: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function close() {
    if (onClose) onClose();
    else if (closeHref) router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      // A tap on the dark area around the panel lands on the dialog itself.
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 flex max-h-[90dvh] w-full max-w-none flex-col rounded-t-2xl bg-surface p-0 text-ink shadow-sheet motion-safe:animate-sheet-up lg:top-0 lg:right-0 lg:left-auto lg:h-dvh lg:max-h-none lg:w-[26rem] lg:rounded-none lg:rounded-l-2xl lg:motion-safe:animate-drawer-in"
    >
      <div aria-hidden className="flex justify-center pt-2 pb-1 lg:hidden">
        <span className="h-[5px] w-9 rounded-full bg-neutral-700" />
      </div>
      <div className="overflow-y-auto overscroll-contain px-5 pt-1.5 pb-[max(2.75rem,env(safe-area-inset-bottom))] lg:pt-6">{children}</div>
    </dialog>
  );
}

/** The title row of a sheet: a title, an optional line under it, and a close button. */
export function SheetHeader({
  title,
  description,
  closeHref,
  onClose,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  closeHref?: string;
  onClose?: () => void;
  /** Extra things under the title, like a tag. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const t = useT();
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <h2 className="text-[22px] leading-tight font-medium wrap-anywhere">{title}</h2>
        {description ? <p className="-mt-1 text-sm text-neutral-400 tabular">{description}</p> : null}
        {children}
      </div>
      <button
        type="button"
        aria-label={t.common.close}
        onClick={() => (onClose ? onClose() : closeHref ? router.replace(closeHref, { scroll: false }) : undefined)}
        className="-mt-1 -mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-neutral-300 transition-colors duration-150 hover:bg-ink/7"
      >
        <XIcon aria-hidden className="size-[18px]" />
      </button>
    </div>
  );
}
