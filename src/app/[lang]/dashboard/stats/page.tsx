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
import { capital, dateLocale } from "@/lib/dates";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Stats") };
}

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

async function StatsContent({ searchParams }: PageProps<"/[lang]/dashboard/stats">) {
  const query = await searchParams;
  const kind: PeriodKind = query.p === "month" ? "month" : "week";
  const offset = Math.max(0, Math.min(MAX_BACK, Number.parseInt(String(query.o ?? "0"), 10) || 0));
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const tz = shop.timezone;
  const now = new Date();
  const today = shopToday(tz, now);

  const period = periodFor(kind, today, offset, o.lang);
  const before = periodFor(kind, today, offset + 1, o.lang);
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
  const vs = offset === 0 ? (kind === "week" ? o("vs same time last week") : o("vs same time last month")) : kind === "week" ? o("vs the week before") : o("vs the month before");

  const href = (k: PeriodKind, back: number) => `/dashboard/stats${k === "month" || back ? "?" : ""}${new URLSearchParams({ ...(k === "month" ? { p: "month" } : {}), ...(back ? { o: String(back) } : {}) })}`;

  const delta = (nowValue: number, beforeValue: number, upIsGood: boolean): Pick<Tile, "delta" | "good"> => {
    const c = p ? change(nowValue, beforeValue) : null;
    if (!c) return {};
    return { delta: `${c === "same" ? o("no change") : c} ${vs}`, good: c === "same" ? null : c.startsWith("+") === upIsGood };
  };

  let body: React.ReactNode;
  if (error || !s) {
    body = <Card className="p-5 text-sm text-neutral-400">{o("Could not load your stats. Please reload the page.")}</Card>;
  } else if (s.active === 0 && s.cancelled === 0) {
    body = (
      <Card>
        <EmptyState
          icon={ChartBarIcon}
          title={offset === 0 ? (kind === "week" ? o("No bookings this week yet") : o("No bookings this month yet")) : o("No bookings in {period} yet", { period: o(period.label) })}
        >
          {o("Numbers show up here as soon as people book.")}
        </EmptyState>
      </Card>
    );
  } else {
    const missedRate = pct(s.no_shows, s.kept + s.no_shows);
    const missedBefore = p ? pct(p.no_shows, p.kept + p.no_shows) : 0;
    const tiles: Tile[] = [
      {
        label: o("Takings"),
        value: formatMoney(s.revenue_cents, shop.currency, o.lang),
        ...delta(s.revenue_cents, p?.revenue_cents ?? 0, true),
        note: s.booked_cents ? o("{money} more booked", { money: formatMoney(s.booked_cents, shop.currency, o.lang) }) : undefined,
      },
      {
        label: o("Visits"),
        value: String(s.kept),
        ...delta(s.kept, p?.kept ?? 0, true),
        note: s.upcoming ? o("{n} still to come", { n: s.upcoming }) : undefined,
      },
      {
        label: o("Didn’t come"),
        value: `${missedRate}%`,
        ...(p && s.kept + s.no_shows ? { delta: missedRate === missedBefore ? `${o("no change")} ${vs}` : missedRate > missedBefore ? o("up from {pct}%", { pct: missedBefore }) : o("down from {pct}%", { pct: missedBefore }), good: missedRate === missedBefore ? null : missedRate < missedBefore } : {}),
        note: o("{missed} of {all} visits", { missed: s.no_shows, all: s.kept + s.no_shows }),
      },
      {
        label: o("Booked online"),
        value: `${pct(s.online, s.active)}%`,
        note: o.n(s.customers, "{n} customer", "{n} customers"),
      },
    ];

    const days = WEEKDAYS.map((_, i) => capital(new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: "UTC", weekday: "long" }).format(new Date(Date.UTC(2026, 10, 2 + i, 12))))).map((name, i) => ({ key: String(i + 1), label: name, short: name.slice(0, 2), n: s.by_weekday.find((d) => d.day === i + 1)?.n ?? 0 }));
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
              <h2 className="text-base font-medium">{o("Busiest days")}</h2>
              <p className="mb-2 text-[13px] text-neutral-400">{o("Visits and bookings by day of the week")}</p>
              <ColumnChart data={days} caption={o("Bookings by day")} heading={o("Day")} valueHeading={o("Bookings")} count={(n) => o.n(n, "{n} booking", "{n} bookings")} />
            </Card>
            <Card className="p-5">
              <h2 className="text-base font-medium">{o("Busiest times")}</h2>
              <p className="mb-2 text-[13px] text-neutral-400">{o("By the hour they start, {city} time", { city: tz.split("/").pop()?.replaceAll("_", " ") ?? tz })}</p>
              <ColumnChart data={hours} caption={o("Bookings by starting hour")} heading={o("Starts at")} valueHeading={o("Bookings")} count={(n) => o.n(n, "{n} booking", "{n} bookings")} />
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 text-base font-medium">{o("Top services")}</h2>
              <RankedBars
                caption={o("Top services")}
                headings={[o("Service"), o("Bookings · takings")]}
                rows={s.top_services.map((t) => ({ name: t.name, n: t.n, money: t.cents ? formatMoney(t.cents, shop.currency, o.lang) : "" }))}
              />
            </Card>
          </>
        ) : null}

        <p className="px-1 text-[13px] text-neutral-400">
          {o("Takings count visits that happened, at the price they were booked at. Cancelled bookings and missed visits don’t count.")}
          {s.cancelled ? ` ${kind === "week" ? o("{n} cancelled in this week.", { n: s.cancelled }) : o("{n} cancelled in this month.", { n: s.cancelled })}` : ""}
        </p>
      </div>
    );
  }

  return (
    <>
      <OwnerHeader back title={o("Stats")} description={o("How your shop is doing.")} />

      {/* One row of controls above everything they change. */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={o("Show by")} className="inline-flex overflow-hidden rounded-lg border border-line">
          {(["week", "month"] as const).map((k) => (
            <Link
              key={k}
              href={href(k, 0)}
              aria-current={kind === k ? "true" : undefined}
              className={`px-4 py-2 text-[13px] font-medium transition-colors duration-150 ${kind === k ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent)]" : "text-neutral-300 hover:bg-ink/7"}`}
            >
              {k === "week" ? o("Week") : o("Month")}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {offset < MAX_BACK ? (
            <Link href={href(kind, offset + 1)} aria-label={kind === "week" ? o("Earlier week") : o("Earlier month")} className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-raised">
              <CaretLeftIcon aria-hidden className="size-4.5" />
            </Link>
          ) : null}
          <p className="min-w-28 text-center text-sm">
            <span className="block font-medium">{o(period.label)}</span>
            {offset <= 1 ? (
              <span className="block text-[12px] text-neutral-400">{periodRange(kind, period, o.lang)}</span>
            ) : null}
          </p>
          {offset > 0 ? (
            <Link href={href(kind, offset - 1)} aria-label={kind === "week" ? o("Later week") : o("Later month")} className="flex size-9 items-center justify-center rounded-lg text-neutral-300 hover:bg-raised">
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

export default function StatsPage(props: PageProps<"/[lang]/dashboard/stats">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsContent {...props} />
    </Suspense>
  );
}
