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
import { averageText, getShopRating, reviewCount } from "@/lib/reviews";
import { requireShop } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { OwnerHeader } from "../account";
import { ShopForm } from "../shop-form";
import { MediaForm } from "./media-form";

export const metadata: Metadata = { title: "Your shop" };

const DAY = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Opening days in a few letters: "Mon–Sat", "Mon, Wed, Fri", or "Not set". */
function daysSummary(weekdays: number[]) {
  const days = [...new Set(weekdays)].sort((a, b) => a - b);
  if (days.length === 0) return "Not set";
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
  const { supabase, shop } = await requireShop();
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
    { href: "/dashboard/customers", icon: UsersThreeIcon, label: "Customers", value: "Visits and notes" },
    { href: "/dashboard/stats", icon: ChartBarIcon, label: "Stats", value: "Takings and busy times" },
    { href: "/dashboard/reviews", icon: StarIcon, label: "Reviews", value: rating.total ? `${averageText(rating.average)} from ${reviewCount(rating.total)}` : "No reviews yet" },
    { href: "/dashboard/waitlist", icon: HourglassIcon, label: "Waitlist", value: waiting ? `${waiting} waiting` : "Nobody waiting" },
  ];
  const rows: Row[] = [
    { href: "/dashboard/services", icon: ScissorsIcon, label: "Services", value: `${services?.length ?? 0} shown` },
    { href: "/dashboard/hours", icon: ClockIcon, label: "Hours and days off", value: daysSummary((hours ?? []).map((h) => h.weekday)) },
    { href: "/dashboard/rules", icon: SlidersHorizontalIcon, label: "Booking rules", value: rules ? rulesSummary(rules) : "" },
    { href: "/dashboard/info", icon: ChatCircleTextIcon, label: "AI notes", value: `${notes ?? 0} ${notes === 1 ? "answer" : "answers"}` },
    { href: "/dashboard/team", icon: UsersIcon, label: "Team", value: team.length > 2 ? `${team.length} people` : team.join(", ") || "Nobody yet" },
  ];

  return (
    <>
      <OwnerHeader title={shop.name} eyebrow="Your shop" />
      <div className="space-y-[22px]">
        <Card className="space-y-3.5 p-[18px]">
          <div>
            <h2 className="text-base font-medium">Your booking page</h2>
            <p className="mt-0.5 text-sm text-neutral-400">Share this link with customers. New bookings show up right away.</p>
          </div>
          <CopyLink url={bookingUrl} />
          <Link
            href={`/s/${shop.slug}`}
            className="inline-flex items-center gap-1.5 py-1 text-sm font-medium text-accent-400 transition-colors duration-150 hover:text-accent-300"
          >
            <ArrowSquareOutIcon aria-hidden className="size-4" />
            Open it as a customer
          </Link>
        </Card>

        <RowList id="business" title="Your business" rows={businessRows} />
        <RowList id="setup" title="Set up" rows={rows} />

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

        <CardSection title="Pictures" description="Your logo and up to 6 photos, shown at the top of your booking page.">
          <MediaForm
            shopId={shop.id}
            logoUrl={media?.logo_path ? mediaUrl(media.logo_path) : null}
            photos={(photos ?? []).map((p) => ({ id: p.id, url: mediaUrl(p.path) }))}
          />
        </CardSection>

        <CardSection title="QR code" description="Print it for your door or counter. Customers point their phone camera at it to book.">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div
              role="img"
              aria-label="QR code for your booking page"
              className="w-36 shrink-0 overflow-hidden rounded-lg [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
              dangerouslySetInnerHTML={{ __html: qrSvg(bookingUrl) }}
            />
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/shop/poster" className={buttonClass("secondary", { size: "sm" })}>
                <PrinterIcon aria-hidden className="size-4" />
                Print a poster
              </Link>
              <a href="/dashboard/shop/qr" download className={buttonClass("secondary", { size: "sm" })}>
                <DownloadSimpleIcon aria-hidden className="size-4" />
                Download
              </a>
            </div>
          </div>
        </CardSection>

        <CardSection title="Shop details" description="Customers see these on your booking page.">
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
