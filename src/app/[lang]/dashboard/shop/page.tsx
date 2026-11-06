import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyLink } from "@/components/copy-link";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  ChartBarIcon,
  DownloadSimpleIcon,
  PrinterIcon,
  ChatCircleTextIcon,
  ClockIcon,
  HourglassIcon,
  MapPinIcon,
  PhoneIcon,
  ScissorsIcon,
  SlidersHorizontalIcon,
  StarIcon,
  UsersIcon,
  UsersThreeIcon,
  type Icon,
} from "@/components/icons";
import { buttonClass, Card, CardSection, PageSkeleton } from "@/components/ui";
import { type BookingRules, rulesSummary } from "@/lib/booking-rules";
import { shopToday } from "@/lib/booking";
import { mediaUrl } from "@/lib/media";
import { qrSvg } from "@/lib/qr";
import { averageText, getShopRating } from "@/lib/reviews";
import { requireShop } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { OwnerHeader } from "../account";
import { ShopForm } from "../shop-form";
import { MediaForm } from "./media-form";
import { datesFor } from "@/lib/dates";
import type { OwnerT } from "@/lib/i18n/owner";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Your shop") };
}

/** Opening days in a few letters: "Mon–Sat", "Mon, Wed, Fri", or "Not set". */
function daysSummary(weekdays: number[], o: OwnerT) {
  // 2026-11-02 was a Monday: day n of the week is that date plus n - 1.
  const name = (n: number) => datesFor(o.lang).dayName.format(new Date(Date.UTC(2026, 10, 1 + n, 12)));
  const DAY = ["", 1, 2, 3, 4, 5, 6, 7].map((n) => (n ? name(n as number) : ""));
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  if (days.length === 0) return o("Not set");
  if (days.length === 1) return DAY[days[0]];
  const inARow = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  return inARow ? `${DAY[days[0]]}–${DAY[days[days.length - 1]]}` : days.map((d) => DAY[d]).join(", ");
}

type Row = { href: string; icon: Icon; label: string; value: string };

/** A titled card of links to the shop's sub-pages. */
function RowList({ id, title, rows }: { id: string; title: string; rows: Row[] }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="px-1 text-[13px] font-medium">
        {title}
      </h2>
      <Card className="overflow-hidden">
        <ul>
          {rows.map((r) => (
            <li key={r.href}>
              <Link href={r.href} className="rule-top flex min-h-14 items-center gap-3 py-2 pr-3.5 pl-4 transition-colors duration-150 hover:bg-ink/4">
                <r.icon aria-hidden className="size-5 shrink-0 text-neutral-500" />
                <span className="flex-1 text-[15px] font-medium">{r.label}</span>
                <span className="min-w-0 truncate text-right text-[13px] text-neutral-400">{r.value}</span>
                <CaretRightIcon aria-hidden className="size-4 shrink-0 text-neutral-600" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

async function ShopContent() {
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const [bookingUrl, { data: services }, { data: hours }, { count: notes }, { data: staff }, { data: rules }, { data: media }, { data: photos }, rating, { count: waiting }] = await Promise.all([
    siteUrl().then((site) => `${site}/s/${shop.slug}`),
    supabase.from("services").select("id").eq("shop_id", shop.id).eq("active", true),
    supabase.from("opening_hours").select("weekday").eq("shop_id", shop.id).returns<{ weekday: number }[]>(),
    supabase.from("shop_info").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("staff").select("name").eq("shop_id", shop.id).eq("active", true).order("created_at").returns<{ name: string }[]>(),
    supabase
      .from("shops")
      .select("booking_window_days, min_notice_minutes, slot_step_minutes, buffer_minutes, cancel_deadline_hours")
      .eq("id", shop.id)
      .single<BookingRules>(),
    supabase.from("shops").select("logo_path").eq("id", shop.id).single<{ logo_path: string | null }>(),
    supabase.from("shop_photos").select("id, path").eq("shop_id", shop.id).order("position").order("created_at").returns<{ id: string; path: string }[]>(),
    getShopRating(supabase, shop.id),
    supabase.from("waitlist").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).gte("day", shopToday(shop.timezone, new Date())),
  ]);

  const team = (staff ?? []).map((w) => w.name);
  const businessRows: Row[] = [
    { href: "/dashboard/customers", icon: UsersThreeIcon, label: o("Customers"), value: o("Visits and notes") },
    { href: "/dashboard/stats", icon: ChartBarIcon, label: o("Stats"), value: o("Takings and busy times") },
    { href: "/dashboard/reviews", icon: StarIcon, label: o("Reviews"), value: rating.total ? o.n(rating.total, "{avg} from {n} review", "{avg} from {n} reviews", { avg: averageText(rating.average) }) : o("No reviews yet") },
    { href: "/dashboard/waitlist", icon: HourglassIcon, label: o("Waitlist"), value: waiting ? o("{n} waiting", { n: waiting }) : o("Nobody waiting") },
  ];
  const rows: Row[] = [
    { href: "/dashboard/services", icon: ScissorsIcon, label: o("Services"), value: o("{n} shown", { n: services?.length ?? 0 }) },
    { href: "/dashboard/hours", icon: ClockIcon, label: o("Hours and days off"), value: daysSummary((hours ?? []).map((h) => h.weekday), o) },
    { href: "/dashboard/rules", icon: SlidersHorizontalIcon, label: o("Booking rules"), value: rules ? rulesSummary(rules, o) : "" },
    { href: "/dashboard/info", icon: ChatCircleTextIcon, label: o("AI notes"), value: o.n(notes ?? 0, "{n} answer", "{n} answers") },
    { href: "/dashboard/team", icon: UsersIcon, label: o("Team"), value: team.length > 2 ? o.n(team.length, "{n} person", "{n} people") : team.join(", ") || o("Nobody yet") },
  ];

  return (
    <>
      <OwnerHeader title={shop.name} eyebrow={o("Your shop")} />
      <div className="space-y-[22px]">
        <Card className="space-y-3.5 p-[18px]">
          <div>
            <h2 className="text-base font-medium">{o("Your booking page")}</h2>
            <p className="mt-0.5 text-sm text-neutral-400">{o("Share this link with customers. New bookings show up right away.")}</p>
          </div>
          <CopyLink url={bookingUrl} />
          <Link
            href={`/s/${shop.slug}`}
            className="inline-flex items-center gap-1.5 py-1 text-sm font-medium text-accent-400 transition-colors duration-150 hover:text-accent-300"
          >
            <ArrowSquareOutIcon aria-hidden className="size-4" />
            {o("Open it as a customer")}
          </Link>
        </Card>

        <RowList id="business" title={o("Your business")} rows={businessRows} />
        <RowList id="setup" title={o("Set up")} rows={rows} />

        {shop.address || shop.phone ? (
          <div className="space-y-1 px-1 text-[13px] text-neutral-400">
            {shop.address ? (
              <p className="flex items-start gap-1.5">
                <MapPinIcon aria-hidden className="mt-px size-[15px] shrink-0 text-neutral-500" />
                <span className="wrap-anywhere">{shop.address}</span>
              </p>
            ) : null}
            {shop.phone ? (
              <p className="flex items-start gap-1.5">
                <PhoneIcon aria-hidden className="mt-px size-[15px] shrink-0 text-neutral-500" />
                {shop.phone}
              </p>
            ) : null}
          </div>
        ) : null}

        <CardSection title={o("Pictures")} description={o("Your logo and up to 6 photos, shown at the top of your booking page.")}>
          <MediaForm
            shopId={shop.id}
            logoUrl={media?.logo_path ? mediaUrl(media.logo_path) : null}
            photos={(photos ?? []).map((p) => ({ id: p.id, url: mediaUrl(p.path) }))}
          />
        </CardSection>

        <CardSection title={o("QR code")} description={o("Print it for your door or counter. Customers point their phone camera at it to book.")}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div
              role="img"
              aria-label={o("QR code for your booking page")}
              className="w-36 shrink-0 overflow-hidden rounded-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg(bookingUrl) }}
            />
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/shop/poster" className={buttonClass("secondary", { size: "sm" })}>
                <PrinterIcon aria-hidden className="size-4" />
                {o("Print a poster")}
              </Link>
              <a href="/dashboard/shop/qr" download className={buttonClass("secondary", { size: "sm" })}>
                <DownloadSimpleIcon aria-hidden className="size-4" />
                {o("Download")}
              </a>
            </div>
          </div>
        </CardSection>

        <CardSection title={o("Shop details")} description={o("Customers see these on your booking page.")}>
          <ShopForm shop={shop} timezones={Intl.supportedValuesOf("timeZone")} />
        </CardSection>
      </div>
    </>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopContent />
    </Suspense>
  );
}
