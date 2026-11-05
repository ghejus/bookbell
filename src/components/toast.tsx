"use client";

import { useEffect, useState } from "react";
import { CalendarXIcon, CheckCircleIcon, ClockClockwiseIcon, type Icon } from "@/components/icons";
import type { Flash } from "@/lib/flash";

const icons: Record<Flash["kind"], Icon> = {
  added: CheckCircleIcon,
  cancelled: CalendarXIcon,
  moved: ClockClockwiseIcon,
  saved: CheckCircleIcon,
};

/**
 * Drops down from the top for a few seconds, then slides away.
 * Give it `key={flash.id}` so each new message starts fresh.
 */
export function Toast({ flash }: { flash: Flash }) {
  const [on, setOn] = useState(true);

  useEffect(() => {
    // Shown once: forget it, so a reload doesn't show it again.
    document.cookie = "bb_flash=; Max-Age=0; path=/";
    const timer = setTimeout(() => setOn(false), 3400);
    return () => clearTimeout(timer);
  }, []);

  const Shape = icons[flash.kind] ?? CheckCircleIcon;
  return (
    <div
      role="status"
      className={`pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl bg-surface px-3.5 py-3 shadow-lg transition-[opacity,transform] duration-300 motion-safe:animate-toast-in ${
        on ? "" : "-translate-y-[130%] opacity-0"
      }`}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-900 text-accent-400">
        <Shape aria-hidden className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{flash.title}</p>
        {flash.text ? <p className="mt-px text-[13px] text-neutral-400 wrap-anywhere">{flash.text}</p> : null}
      </div>
    </div>
  );
}
