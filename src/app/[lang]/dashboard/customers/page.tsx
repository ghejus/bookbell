import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CaretRightIcon,
  EnvelopeSimpleIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PhoneIcon,
  UsersThreeIcon,
} from "@/components/icons";
import { Sheet, SheetHeader } from "@/components/sheet";
import { Card, EmptyState, PageSkeleton } from "@/components/ui";
import { formatPrice } from "@/lib/format";
import { requireShop, type Shop } from "@/lib/shop";
import { utcToZoned } from "@/lib/time";
import { OwnerHeader } from "../account";
import { NoteForm } from "./note-form";
import { dateLocale } from "@/lib/dates";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Customers") };
}

type Customer = {
  customer_key: string;
  name: string;
  email: string;
  phone: string;
  visits: number;
  no_shows: number;
  cancelled: number;
  spent_cents: number;
  last_visit: string | null;
  next_visit: string | null;
  note: string | null;
};

type Visit = {
  id: string;
  status: "booked" | "cancelled" | "no_show";
  starts_at: string;
  ends_at: string;
  price_cents: number | null;
  services: { name: string } | null;
  staff: { name: string } | null;
};

const isKey = (v: unknown): v is string => typeof v === "string" && /^[enp]:.{1,218}$/.test(v);

/** One customer's card: contact, counts, the owner's note and every visit. */
async function CustomerSheet({ shop, customer, closeHref }: { shop: Shop; customer: Customer; closeHref: string }) {
  const [{ supabase }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const { data } = await supabase
    .from("bookings")
    .select("id, status, starts_at, ends_at, price_cents, services(name), staff(name)")
    .eq("shop_id", shop.id)
    .eq("customer_key", customer.customer_key)
    .order("starts_at", { ascending: false })
    .limit(100)
    .returns<Visit[]>();
  const visits = data ?? [];
  const now = new Date().getTime();
  const when = new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: shop.timezone, day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const contact =
    "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-sm font-medium transition-colors duration-150 hover:bg-ink/7";
  const tiles = [
    { label: o("Visits"), value: String(customer.visits) },
    { label: o("Didn’t come"), value: String(customer.no_shows), warn: customer.no_shows > 0 },
    { label: o("Spent"), value: customer.spent_cents ? formatPrice(customer.spent_cents, shop.currency, o.lang) : "–" },
  ];

  return (
    <Sheet label={o("Customer: {name}", { name: customer.name })} closeHref={closeHref}>
      <SheetHeader title={customer.name} closeHref={closeHref} description={[customer.email, customer.phone].filter(Boolean).join(" · ") || o("No contact details")} />
      <div className="space-y-5">
        {customer.phone || customer.email ? (
          <div className="flex gap-2">
            {customer.phone ? (
              <a href={`tel:${customer.phone.replace(/[^\d+]/g, "")}`} className={contact}>
                <PhoneIcon aria-hidden className="size-[17px]" />
                {o("Call")}
              </a>
            ) : null}
            {customer.email ? (
              <a href={`mailto:${customer.email}`} className={contact}>
                <EnvelopeSimpleIcon aria-hidden className="size-[17px]" />
                {o("Email")}
              </a>
            ) : null}
          </div>
        ) : null}

        <dl className="grid grid-cols-3 gap-2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg bg-raised px-3 py-2.5">
              <dt className="text-[12px] text-neutral-400">{t.label}</dt>
              <dd className={`text-lg font-medium tabular ${t.warn ? "text-danger-ink" : ""}`}>{t.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rule-top pt-4">
          <NoteForm key={customer.customer_key} customerKey={customer.customer_key} note={customer.note ?? ""} />
        </div>

        <section aria-labelledby="visits" className="rule-top pt-4">
          <h3 id="visits" className="mb-2 text-sm font-medium">
            {o("All bookings")}
          </h3>
          <ul>
            {visits.map((v) => {
              const upcoming = v.status === "booked" && Date.parse(v.ends_at) > now;
              const label =
                v.status === "cancelled" ? o("Cancelled") : v.status === "no_show" ? o("Didn’t come") : upcoming ? o("Upcoming") : null;
              return (
                <li key={v.id} className="rule-top flex items-start justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/dashboard/calendar?date=${utcToZoned(new Date(v.starts_at), shop.timezone).date}&b=${v.id}`} className="min-w-0 hover:underline">
                    <span className="block tabular">{when.format(new Date(v.starts_at))}</span>
                    <span className="block text-[13px] text-neutral-400 wrap-anywhere">
                      {v.services?.name ?? o("Booking")}
                      {v.staff ? ` · ${v.staff.name}` : ""}
                    </span>
                  </Link>
                  {label ? (
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] whitespace-nowrap ${
                        v.status === "no_show" ? "bg-danger-soft text-danger-ink" : upcoming ? "bg-accent-900 text-accent-300" : "bg-neutral-800 text-neutral-300"
                      }`}
                    >
                      {label}
                    </span>
                  ) : v.price_cents !== null ? (
                    <span className="shrink-0 text-neutral-400 tabular">{formatPrice(v.price_cents, shop.currency, o.lang)}</span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Sheet>
  );
}

async function CustomersContent({ searchParams }: PageProps<"/[lang]/dashboard/customers">) {
  const query = await searchParams;
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const { data, error } = await supabase.rpc("owner_customers");
  // People coming soon first (soonest at the top), then the most recent visitors.
  const all = [...((error ? [] : (data as Customer[])) ?? [])].sort(
    (x, y) =>
      Number(Boolean(y.next_visit)) - Number(Boolean(x.next_visit)) ||
      (x.next_visit && y.next_visit ? x.next_visit.localeCompare(y.next_visit) : (y.last_visit ?? "").localeCompare(x.last_visit ?? "")) ||
      x.name.localeCompare(y.name),
  );
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 80) : "";
  const needle = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  const shown = q
    ? all.filter(
        (c) =>
          c.name.toLowerCase().includes(needle) ||
          c.email.toLowerCase().includes(needle) ||
          (digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits)),
      )
    : all;
  const day = new Intl.DateTimeFormat(dateLocale(o.lang), { timeZone: shop.timezone, day: "numeric", month: "short" });
  const here = q ? `/dashboard/customers?q=${encodeURIComponent(q)}` : "/dashboard/customers";
  const open = isKey(query.c) ? all.find((c) => c.customer_key === query.c) : undefined;

  return (
    <>
      <OwnerHeader back title={o("Customers")} description={o("Everyone who has booked, with their visits and your private notes.")} />

      <form role="search" action="/dashboard/customers" className="relative mb-4">
        <label htmlFor="customer-search" className="sr-only">
          {o("Search customers")}
        </label>
        <MagnifyingGlassIcon aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-neutral-500" />
        <input
          id="customer-search"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={o("Name, email or phone")}
          maxLength={80}
          className="h-11 w-full rounded-lg border border-line bg-surface pr-3 pl-10 text-[15px] text-ink placeholder:text-neutral-500 focus:border-accent focus:outline-none"
        />
      </form>

      {all.length === 0 ? (
        <Card>
          <EmptyState icon={UsersThreeIcon} title={o("No customers yet")}>
            {o("Everyone who books, online or added by you, shows up here.")}
          </EmptyState>
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon={MagnifyingGlassIcon} title={o("Nobody found")}>
            {o("No customer matches “{q}”. Try part of a name, an email or a phone number.", { q })}
          </EmptyState>
        </Card>
      ) : (
        <>
          <p className="mb-2 px-1 text-[13px] text-neutral-400">
            {q ? o.n(shown.length, "{n} match", "{n} matches") : o.n(all.length, "{n} customer", "{n} customers")}
          </p>
          <Card className="overflow-hidden">
            <ul>
              {shown.slice(0, 300).map((c) => {
                const bits = [
                  c.visits ? o.n(c.visits, "{n} visit", "{n} visits") : o("No visits yet"),
                  c.next_visit ? o("next {day}", { day: day.format(new Date(c.next_visit)) }) : c.last_visit ? o("last {day}", { day: day.format(new Date(c.last_visit)) }) : "",
                ].filter(Boolean);
                return (
                  <li key={c.customer_key}>
                    <Link
                      href={`${here}${here.includes("?") ? "&" : "?"}c=${encodeURIComponent(c.customer_key)}`}
                      scroll={false}
                      className="rule-top flex min-h-14 items-center gap-3 py-2.5 pr-3.5 pl-4 transition-colors duration-150 hover:bg-ink/4"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-[15px] font-medium wrap-anywhere">
                          {c.name}
                          {c.note ? <NotePencilIcon aria-label={o("Has a note")} className="size-3.5 shrink-0 text-neutral-500" /> : null}
                        </span>
                        <span className="block text-[13px] text-neutral-400">{bits.join(" · ")}</span>
                      </span>
                      {c.no_shows ? (
                        <span className="shrink-0 rounded-md bg-danger-soft px-2 py-0.5 text-[11px] whitespace-nowrap text-danger-ink">
                          {o("{n} missed", { n: c.no_shows })}
                        </span>
                      ) : null}
                      <CaretRightIcon aria-hidden className="size-4 shrink-0 text-neutral-600" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
          {shown.length > 300 ? <p className="mt-2 px-1 text-[13px] text-neutral-400">{o("Showing the 300 most recent. Search to find others.")}</p> : null}
        </>
      )}

      {open ? <CustomerSheet shop={shop} customer={open} closeHref={here} /> : null}
    </>
  );
}

export default function CustomersPage(props: PageProps<"/[lang]/dashboard/customers">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CustomersContent {...props} />
    </Suspense>
  );
}
