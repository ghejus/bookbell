import Link from "next/link";
import type { ReactNode } from "react";
import { CaretLeftIcon, CaretRightIcon } from "@/components/icons";
import { asUtc, datesFor } from "@/lib/dates";
import { getT, pageLang } from "@/lib/i18n/server";

// The row of days to pick from, with "earlier" and "later" arrows. Used by
// the shop page (book) and the private booking page (change time).

type Props = {
  /** The heading, e.g. "3. Choose a day". */
  title: ReactNode;
  titleId: string;
  /** Shown beside the arrows, e.g. "Nov 2026". */
  months?: string;
  prevHref?: string | null;
  nextHref?: string | null;
  days: { date: string; free: number; full?: boolean }[];
  chosen?: string;
  hrefFor: (date: string) => string;
  /** When set, full days (open but every time taken) can be picked too, to join the waitlist. */
  fullHref?: (date: string) => string;
  /** Optional loading spinner inside each arrow while the next days load. */
  arrowPending?: ReactNode;
  /** Optional wrapper for the weekday name (the shop page swaps in a spinner while a day loads). */
  weekday?: (name: string) => ReactNode;
};

const arrowClass =
  "relative flex size-9 items-center justify-center rounded-lg text-neutral-300 transition-colors duration-150 hover:bg-raised";
const dayClass = "relative flex h-16 w-14 flex-col items-center justify-center rounded-lg border sm:w-full";

export async function DayStrip({ title, titleId, months, prevHref, nextHref, days, chosen, hrefFor, fullHref, arrowPending, weekday }: Props) {
  const [t, lang] = await Promise.all([getT(), pageLang()]);
  const { dayName, dayNum, longDay } = datesFor(lang);
  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={titleId} className="text-base font-medium whitespace-nowrap text-ink">
          {title}
        </h2>
        <div className="flex items-center gap-1">
          {months ? <span className="mr-1 text-sm whitespace-nowrap text-neutral-400 tabular">{months}</span> : null}
          {prevHref ? (
            <Link href={prevHref} scroll={false} aria-label={t.days.earlier} className={arrowClass}>
              <CaretLeftIcon aria-hidden className="size-4.5" />
              {arrowPending}
            </Link>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} scroll={false} aria-label={t.days.later} className={arrowClass}>
              <CaretRightIcon aria-hidden className="size-4.5" />
              {arrowPending}
            </Link>
          ) : null}
        </div>
      </div>
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0">
        {days.map((d) => {
          const name = dayName.format(asUtc(d.date));
          const label = longDay.format(asUtc(d.date));
          const number = <span className="text-lg font-medium tabular">{dayNum.format(asUtc(d.date))}</span>;
          return (
            <li key={d.date} className="shrink-0">
              {d.free > 0 ? (
                <Link
                  href={hrefFor(d.date)}
                  scroll={false}
                  aria-current={d.date === chosen ? "date" : undefined}
                  aria-label={t.days.free(label, d.free)}
                  className={`${dayClass} transition-colors duration-150 ${d.date === chosen ? "chip-on" : "chip-off"}`}
                >
                  <span className="flex h-4 items-center text-xs font-medium">{weekday ? weekday(name) : name}</span>
                  {number}
                </Link>
              ) : d.full && fullHref ? (
                <Link
                  href={fullHref(d.date)}
                  scroll={false}
                  aria-current={d.date === chosen ? "date" : undefined}
                  aria-label={t.days.full(label)}
                  className={`${dayClass} transition-colors duration-150 ${d.date === chosen ? "chip-on" : "chip-shut hover:bg-ink/5 hover:text-neutral-400"}`}
                >
                  <span className="flex h-4 items-center text-xs font-medium">{weekday ? weekday(name) : name}</span>
                  {number}
                  <span aria-hidden className="absolute bottom-1.5 text-[9px] leading-none font-medium tracking-wide uppercase">
                    {t.days.fullTag}
                  </span>
                </Link>
              ) : (
                <span aria-label={t.days.none(label)} className={`${dayClass} chip-shut`}>
                  <span className="flex h-4 items-center text-xs font-medium">{name}</span>
                  {number}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
