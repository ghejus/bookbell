"use client";

import type { Ref } from "react";
import type { Dict } from "@/lib/i18n/dict";
import { useT } from "@/lib/i18n/client";

// The free times on one day, as radio buttons grouped into morning, afternoon
// and evening, like a paper appointment book. Used when booking and when
// changing a booking's time.

export type Slot = { iso: string; label: string };

function groupSlots(slots: Slot[], t: Dict) {
  const groups = [
    { name: t.days.morning, slots: slots.filter((s) => s.label < "12:00") },
    { name: t.days.afternoon, slots: slots.filter((s) => s.label >= "12:00" && s.label < "17:00") },
    { name: t.days.evening, slots: slots.filter((s) => s.label >= "17:00") },
  ];
  return groups.filter((g) => g.slots.length > 0);
}

type Props = {
  slots: Slot[];
  dayLabel: string;
  picked: string | null;
  onPick: (iso: string) => void;
  ref?: Ref<HTMLFieldSetElement>;
};

export function TimeGrid({ slots, dayLabel, picked, onPick, ref }: Props) {
  const t = useT();
  return (
    <fieldset ref={ref} className="scroll-mt-4">
      <legend className="mb-3 text-sm font-medium text-ink">{t.days.freeTimesOn(dayLabel)}</legend>
      <div className="space-y-4">
        {groupSlots(slots, t).map((group) => (
          <div key={group.name}>
            <p className="mb-2 text-xs font-medium text-neutral-400">{group.name}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.slots.map((s) => (
                <label key={s.iso} className="relative">
                  <input
                    type="radio"
                    name="starts_at"
                    value={s.iso}
                    checked={picked === s.iso}
                    onChange={() => onPick(s.iso)}
                    className="peer sr-only"
                  />
                  <span className="flex h-11 cursor-pointer items-center justify-center rounded-lg border chip-off text-sm font-medium tabular transition-colors duration-150 peer-checked:chip-on peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                    {s.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
