import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaretLeftIcon, CaretRightIcon, ChartBarIcon } from "@/components/icons";
import { Card, EmptyState, PageSkeleton } from "@/components/ui";
import { shopToday } from "@/lib/booking";
import { formatMoney, WEEKDAYS } from "@/lib/format";
import { change, comparisonEnd, periodFor, periodRange, type PeriodKind } from "@/lib/periods";
import { requireShop } from "@/lib/shop";
import { zonedToUtc } from "@/lib/time";
import { OwnerHeader } from "../account";
import { ColumnChart, RankedBars } from "./charts";

export const metadata: Metadata = { title: "Stats" };

type Stats = {
  kept: number;
  upcoming: number;
  no_shows: number;
  cancelled: number;
  online: number;
  active: number;
  revenue_cents: number;
  booked_cents: number;
  customers: number;
  by_weekday: { day: number; n: number }[];
  by_hour: { hour: number; n: number }[];
  top_services: { name: string; n: number; cents: number }[];
};

const MAX_BACK = 52;
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

type Tile = { label: string; value: string; delta?: string | null; good?: boolean | null; note?: string };

/** A headline number with how it changed. Up isn't always good (missed visits). */
function StatTile({ label, value, delta, good, note }: Tile) {
  const tone = good === true ? "text-success-ink" : good === false ? "text-danger-text" : "text-neutral-400";
  return (
    <Card className="p-4">
      <p className="text-[13px] text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-medium tracking-tight">{value}</p>
      {delta ? <p className={`mt-0.5 text-[12px] ${tone}`}>{delta}</p> : null}
      {note ? <p className="mt-0.5 text-[12px] text-neutral-400">{note}</p> : null}
    </Card>
  );
}

async function StatsContent({ searchParams }: PageProps<"/dashboard/stats">) {
  const query = await searchParams;
  const kind: PeriodKind = query.p === "month" ? "month" : "week";
  const offset = Math.max(0, Math.min(MAX_BACK, Number.parseInt(String(query.o ?? "0"), 10) || 0));
  const { supabase, shop } = await requireShop();
  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);

  const period = periodFor(kind, today, offset);
  const before = periodFor(kind, today, offset + 1);
  const ms = (d: string) => zonedToUtc(d, "00:00", tz).getTime();
  const iso = (t: number) => new Date(t).toISOString();
  // A running period is compared with the same stretch of the one before.
  const beforeEnd = offset === 0 ? comparisonEnd(ms(before.from), ms(before.to), ms(period.from), now.getTime()) : ms(before.to);

  const [{ data: cur, error }, { data: prev }] = await Promise.all([
    supabase.rpc("owner_stats", { p_from: iso(ms(period.from)), p_to: iso(ms(period.to)) }),
    supabase.rpc("owner_stats", { p_from: iso(ms(before.from)), p_to: iso(beforeEnd) }),
  ]);
  const s = cur as Stats | null;
  const p = prev as Stats | null;
  const vs = offset === 0 ? `vs same time ${kind === "week" ? "last week" : "last month"}` : `vs the ${kind} before`;

  const href = (k: PeriodKind, o: number) => `/dashboard/stats${k === "month" || o ? "?" : ""}${new URLSearchParams({ ...(k === "month" ? { p: "month" } : {}), ...(o ? { o: String(o) } : {}) })}`;

  const delta = (nowValue: number, beforeValue: number, upIsGood: boolean): Pick<Tile, "delta" | "good"> => {
    const c = p ? change(nowValue, beforeValue) : null;
    if (!c) return {};
    return { delta: `${c} ${vs}`, good: c === "same" ? null : c.startsWith("+") === upIsGood };
  };

  let body: React.ReactNode;
  if (error || !s) {
    body = <Card className="p-5 text-sm text-neutral-400">Could not load your stats. Please reload the page.</Card>;
  } else if (s.active === 0 && s.cancelled === 0) {
    body = (
      <Card>
        <EmptyState icon={ChartBarIcon} title={`No bookings ${offset === 0 ? `this ${kind}` : `in ${period.label}`} yet`}>
          Numbers show up here as soon as people book.
        </EmptyState>
      </Card>
    );
  } else {
    const missedRate = pct(s.no_shows, s.kept + s.no_shows);
    const missedBefore = p ? pct(p.no_shows, p.kept + p.no_shows) : 0;
    const tiles: Tile[] = [
      {
        label: "Takings",
        value: formatMoney(s.revenue_cents, shop.currency),
        ...delta(s.revenue_cents, p?.revenue_cents ?? 0, true),
        note: s.booked_cents ? `${formatMoney(s.booked_cents, shop.currency)} more booked` : undefined,
      },
      {
        label: "Visits",
        value: String(s.kept),
        ...delta(s.kept, p?.kept ?? 0, true),
        note: s.upcoming ? `${s.upcoming} still to come` : undefined,
      },
      {
        label: "Didn’t come",
        value: `${missedRate}%`,
        ...(p && s.kept + s.no_shows ? { delta: missedRate === missedBefore ? `same ${vs}` : `${missedRate > missedBefore ? "up" : "down"} from ${missedBefore}%`, good: missedRate === missedBefore ? null : missedRate < missedBefore } : {}),
        note: `${s.no_shows} of ${s.kept + s.no_shows} visits`,
      },
      {
        label: "Booked online",
        value: `${pct(s.online, s.active)}%`,
        note: `${s.customers} ${s.customers === 1 ? "customer" : "customers"}`,
      },
    ];

    const days = WEEKDAYS.map((name, i) => ({ key: String(i + 1), label: name, short: name.slice(0, 2), n: s.by_weekday.find((d) => d.day === i + 1)?.n ?? 0 }));
    const hourList = s.by_hour.map((h) => h.hour);
    const hours = hourList.length
      ? Array.from({ length: Math.max(...hourList) - Math.min(...hourList) + 1 }, (_, i) => {
          const hour = Math.min(...hourList) + i;
          return { key: String(hour), label: `${String(hour).padStart(2, "0")}:00`, short: String(hour), n: s.by_hour.find((h) => h.hour === hour)?.n ?? 0 };
        })
      : [];

    body = (
      <div className="space-y-[22px]">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tiles.map((t) => (
            <StatTile key={t.label} {...t} />
          ))}
        </div>

        {s.kept + s.upcoming > 0 ? (
          <>
            <Card className="p-5">
              <h2 className="text-base font-medium">Busiest days</h2>
              <p className="mb-2 text-[13px] text-neutral-400">Visits and bookings by day of the week</p>
              <ColumnChart data={days} caption="Bookings by day" heading="Day" unit={["booking", "bookings"]} />
            </Card>
            <Card className="p-5">
              <h2 className="text-base font-medium">Busiest times</h2>
              <p className="mb-2 text-[13px] text-neutral-400">By the hour they start, {tz.split("/").pop()?.replaceAll("_", " ")} time</p>
              <ColumnChart data={hours} caption="Bookings by starting hour" heading="Starts at" unit={["booking", "bookings"]} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-base font-medium">Top services</h2>
              <RankedBars
                caption="Top services"
                rows={s.top_services.map((t) => ({ name: t.name, n: t.n, money: t.cents ? formatMoney(t.cents, shop.currency) : "" }))}
              />
            </Card>
          </>
        ) : null}

        <p className="px-1 text-[13px] text-neutral-400">
          Takings count visits that happened, at the price they were booked at. Cancelled bookings and missed visits don’t count.
          {s.cancelled ? ` ${s.cancelled} cancelled in this ${kind}.` : ""}
        </p>
      </div>
    );
  }

  return (
    <>
      <OwnerHeader back title="Stats" description="How your shop is doing." />

      {/* One row of controls above everything they change. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Show by" className="inline-flex overflow-hidden rounded-lg border border-line">
          {(["week", "month"] as const).map((k) => (
            <Link
              key={k}
              href={href(k, 0)}
              aria-current={kind === k ? "true" : undefined}
              className={`px-4 py-2 text-[13px] font-medium transition-colors duration-150 ${kind === k ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"}`}
            >
              {k === "week" ? "Week" : "Month"}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {offset < MAX_BACK ? (
            <Link href={href(kind, offset + 1)} aria-label={`Earlier ${kind}`} className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-raised">
              <CaretLeftIcon aria-hidden className="size-4.5" />
            </Link>
          ) : null}
          <p className="min-w-28 text-center text-sm">
            <span className="block font-medium">{period.label}</span>
            {period.label.startsWith("This") || period.label.startsWith("Last") ? (
              <span className="block text-[12px] text-neutral-400">{periodRange(kind, period)}</span>
            ) : null}
          </p>
          {offset > 0 ? (
            <Link href={href(kind, offset - 1)} aria-label={`Later ${kind}`} className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-raised">
              <CaretRightIcon aria-hidden className="size-4.5" />
            </Link>
          ) : (
            <span className="size-9" />
          )}
        </div>
      </div>

      {body}
    </>
  );
}

export default function StatsPage(props: PageProps<"/dashboard/stats">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsContent {...props} />
    </Suspense>
  );
}
