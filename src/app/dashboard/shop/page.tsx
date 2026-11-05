import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CopyLink } from "@/components/copy-link";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  ChatCircleTextIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
  ScissorsIcon,
  UsersIcon,
  type Icon,
} from "@/components/icons";
import { Card, CardSection, PageSkeleton } from "@/components/ui";
import { requireShop } from "@/lib/shop";
import { siteUrl } from "@/lib/site";
import { OwnerHeader } from "../account";
import { ShopForm } from "../shop-form";

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

async function ShopContent() {
  const { supabase, shop } = await requireShop();
  const [bookingUrl, { data: services }, { data: hours }, { count: notes }, { data: staff }] = await Promise.all([
    siteUrl().then((site) => `${site}/s/${shop.slug}`),
    supabase.from("services").select("id").eq("shop_id", shop.id).eq("active", true),
    supabase.from("opening_hours").select("weekday").eq("shop_id", shop.id).returns<{ weekday: number }[]>(),
    supabase.from("shop_info").select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    supabase.from("staff").select("name").eq("shop_id", shop.id).eq("active", true).order("created_at").returns<{ name: string }[]>(),
  ]);

  const team = (staff ?? []).map((w) => w.name);
  const rows: { href: string; icon: Icon; label: string; value: string }[] = [
    { href: "/dashboard/services", icon: ScissorsIcon, label: "Services", value: `${services?.length ?? 0} shown` },
    { href: "/dashboard/hours", icon: ClockIcon, label: "Hours and days off", value: daysSummary((hours ?? []).map((h) => h.weekday)) },
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

        <section aria-labelledby="setup" className="space-y-2">
          <h2 id="setup" className="px-1 text-[13px] font-medium">
            Set up
          </h2>
          <Card className="overflow-hidden">
            <ul>
              {rows.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="rule-top flex min-h-14 items-center gap-3 py-2 pr-3.5 pl-4 transition-colors duration-150 hover:bg-ink/4"
                  >
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
