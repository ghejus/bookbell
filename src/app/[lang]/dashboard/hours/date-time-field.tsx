"use client";

import { useEffect, useRef, useState } from "react";
import { Field } from "@/components/form";
import { dateLocale } from "@/lib/dates";
import type { Lang } from "@/lib/i18n/config";
import { useLang } from "@/lib/i18n/client";

// "2026-12-31T18:00" -> "Thu, 31 Dec 2026, 18:00", the same style as the days-off list.
// The value is already the shop's wall-clock time, so it is formatted as-is (in UTC, no shifting).
const echoFormat = (lang: Lang) => new Intl.DateTimeFormat(dateLocale(lang), {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function echo(value: string, lang: Lang): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const [, y, m, d, hh, mm] = match.map(Number);
  return echoFormat(lang).format(new Date(Date.UTC(y, m - 1, d, hh, mm)));
}

/**
 * A date-and-time box whose picker uses the device's own style (like 12/31/2026),
 * with the chosen moment repeated underneath in the dashboard's style.
 */
export function DateTimeField({ label, name }: { label: string; name: string }) {
  const [value, setValue] = useState("");
  const lang = useLang();
  const wrapper = useRef<HTMLDivElement>(null);

  // The add form clears itself after a success; clear the echo with it.
  useEffect(() => {
    const form = wrapper.current?.closest("form");
    if (!form) return;
    const clear = () => setValue("");
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  return (
    <div ref={wrapper}>
      <Field
        label={label}
        name={name}
        type="datetime-local"
        required
        onChange={(e) => setValue(e.target.value)}
        hint={value ? <span className="font-medium text-gray-900 tabular">{echo(value, lang)}</span> : undefined}
      />
    </div>
  );
}
