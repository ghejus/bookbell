// Small charts for the Stats page, in plain HTML (no chart library).
import { getOwnerT } from "@/lib/i18n/server";
// One colour (the accent), thin columns with a rounded top on one baseline,
// only the biggest value labelled; every value shows on hover or keyboard
// focus, and "See the numbers" opens the same data as a table.

type Datum = { key: string; label: string; short: string; n: number };

async function NumbersTable({ caption, headings, data }: { caption: string; headings: [string, string]; data: { label: string; value: string }[] }) {
  const o = await getOwnerT();
  const showNumbers = o("See the numbers");
  return (
    <details className="mt-3 text-[13px] text-neutral-400">
      <summary className="cursor-pointer select-none hover:text-ink">{showNumbers}</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className="py-1 font-medium">
              {headings[0]}
            </th>
            <th scope="col" className="py-1 text-right font-medium">
              {headings[1]}
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="rule-top">
              <td className="py-1 text-neutral-300">{d.label}</td>
              <td className="py-1 text-right text-neutral-300 tabular">{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Columns along one baseline, e.g. bookings per weekday. */
export function ColumnChart({
  data,
  caption,
  count,
  heading,
  valueHeading,
}: {
  data: Datum[];
  caption: string;
  /** 3 -> "3 bookings", in the owner's language. */
  count: (n: number) => string;
  heading: string;
  valueHeading: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const top = data.reduce((best, d) => (d.n > best.n ? d : best), data[0]);
  const word = count;
  return (
    <div>
      <div role="list" aria-label={caption} className="flex h-36 items-end gap-0.5 border-b border-hairline pt-5">
        {data.map((d) => {
          const pct = (d.n / max) * 100;
          return (
            <div
              key={d.key}
              role="listitem"
              tabIndex={0}
              aria-label={`${d.label}: ${word(d.n)}`}
              className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {/* The tallest column carries its value; the rest show it on hover or focus. */}
              <span
                className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-md px-1.5 py-0.5 text-[12px] font-medium whitespace-nowrap text-ink tabular ${
                  d === top && d.n > 0
                    ? "group-hover:bg-raised group-focus-visible:bg-raised"
                    : "bg-raised opacity-0 shadow-lg group-hover:opacity-100 group-focus-visible:opacity-100"
                }`}
                style={{ bottom: `calc(${pct}% + 4px)` }}
              >
                {d === top && d.n > 0 ? d.n : word(d.n)}
              </span>
              <span
                aria-hidden
                className="block w-full max-w-6 rounded-t-[4px] bg-accent transition-colors duration-150 group-hover:bg-accent-400 group-focus-visible:bg-accent-400"
                style={{ height: d.n ? `max(${pct}%, 3px)` : 0 }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden className="mt-1.5 flex gap-0.5">
        {data.map((d) => (
          <span key={d.key} className="min-w-0 flex-1 text-center text-[11px] text-neutral-400 tabular">
            {d.short}
          </span>
        ))}
      </div>
      <NumbersTable caption={caption} headings={[heading, valueHeading]} data={data.map((d) => ({ label: d.label, value: String(d.n) }))} />
    </div>
  );
}

/** A ranked list with a thin bar each, e.g. the top services. */
export function RankedBars({
  rows,
  caption,
  headings,
}: {
  rows: { name: string; n: number; money: string }[];
  caption: string;
  /** The hidden table's column titles, like ["Service", "Bookings · takings"]. */
  headings: [string, string];
}) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <div>
      <ol aria-label={caption} className="space-y-3">
        {rows.map((r) => (
          <li key={r.name}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 wrap-anywhere">{r.name}</span>
              <span className="shrink-0 text-neutral-400 tabular">{r.money}</span>
            </div>
            <div className="flex items-center gap-2">
              <span aria-hidden className="block h-2.5 rounded-r-[4px] bg-accent" style={{ width: `max(${(r.n / max) * 85}%, 3px)` }} />
              <span className="text-[12px] text-neutral-300 tabular">{r.n}</span>
            </div>
          </li>
        ))}
      </ol>
      <NumbersTable caption={caption} headings={headings} data={rows.map((r) => ({ label: r.name, value: `${r.n} · ${r.money}` }))} />
    </div>
  );
}
