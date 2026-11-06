"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarBlankIcon,
  ChartBarIcon,
  ChatCircleTextIcon,
  ClockIcon,
  HourglassIcon,
  ListChecksIcon,
  PlusIcon,
  ScissorsIcon,
  SlidersHorizontalIcon,
  StarIcon,
  StorefrontIcon,
  SunIcon,
  UsersIcon,
  UsersThreeIcon,
  type Icon,
} from "@/components/icons";

type Item = { href: string; label: string; icon: Icon; match: (path: string) => boolean };

const shopPages = ["/dashboard/shop", "/dashboard/services", "/dashboard/hours", "/dashboard/rules", "/dashboard/info", "/dashboard/team", "/dashboard/customers", "/dashboard/stats", "/dashboard/reviews", "/dashboard/waitlist", "/dashboard/shop/poster"];

const main: Item[] = [
  { href: "/dashboard", label: "Today", icon: SunIcon, match: (p) => p === "/dashboard" },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarBlankIcon, match: (p) => p === "/dashboard/calendar" },
  { href: "/dashboard/bookings", label: "Bookings", icon: ListChecksIcon, match: (p) => p === "/dashboard/bookings" },
  { href: "/dashboard/shop", label: "Shop", icon: StorefrontIcon, match: (p) => shopPages.includes(p) },
];

const business: Item[] = [
  { href: "/dashboard/customers", label: "Customers", icon: UsersThreeIcon, match: (p) => p === "/dashboard/customers" },
  { href: "/dashboard/stats", label: "Stats", icon: ChartBarIcon, match: (p) => p === "/dashboard/stats" },
  { href: "/dashboard/reviews", label: "Reviews", icon: StarIcon, match: (p) => p === "/dashboard/reviews" },
  { href: "/dashboard/waitlist", label: "Waitlist", icon: HourglassIcon, match: (p) => p === "/dashboard/waitlist" },
];

const setup: Item[] = [
  { href: "/dashboard/services", label: "Services", icon: ScissorsIcon, match: (p) => p === "/dashboard/services" },
  { href: "/dashboard/hours", label: "Hours and days off", icon: ClockIcon, match: (p) => p === "/dashboard/hours" },
  { href: "/dashboard/rules", label: "Booking rules", icon: SlidersHorizontalIcon, match: (p) => p === "/dashboard/rules" },
  { href: "/dashboard/info", label: "AI notes", icon: ChatCircleTextIcon, match: (p) => p === "/dashboard/info" },
  { href: "/dashboard/team", label: "Team", icon: UsersIcon, match: (p) => p === "/dashboard/team" },
];

export const NEW_BOOKING_HREF = "/dashboard/calendar?add=1";

function Tab({ item, path }: { item: Item; path: string }) {
  const active = item.match(path);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-150 ${active ? "text-accent-400" : "text-neutral-500 hover:text-neutral-300"}`}
    >
      <item.icon aria-hidden weight={active ? "fill" : "regular"} className="size-6" />
      {item.label}
    </Link>
  );
}

/** The bar at the bottom of the phone screen, with the round "+" in the middle. */
export function TabBar() {
  const path = usePathname();
  const [today, calendar, bookings, shop] = main;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 bg-ground/90 print:hidden px-2.5 pt-[7px] pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-lg lg:hidden"
    >
      <span aria-hidden className="rule-top absolute inset-x-0 top-0 h-px" />
      <div className="relative mx-auto flex max-w-lg items-start">
        <Tab item={today} path={path} />
        <Tab item={calendar} path={path} />
        <div className="w-[72px] shrink-0" />
        <Tab item={bookings} path={path} />
        <Tab item={shop} path={path} />
        <Link
          href={NEW_BOOKING_HREF}
          scroll={false}
          aria-label="New booking"
          className="absolute -top-[21px] left-1/2 flex size-[58px] -translate-x-1/2 items-center justify-center rounded-full border border-accent bg-surface text-accent-400 shadow-[0_0_0_5px_var(--color-ground),0_0_26px_rgb(145_132_217/0.38)] transition-colors duration-150 hover:bg-accent-900 active:bg-accent-800"
        >
          <PlusIcon aria-hidden className="size-[26px]" />
        </Link>
      </div>
    </nav>
  );
}

function SideLink({ item, path, small }: { item: Item; path: string; small?: boolean }) {
  const active = item.match(path) && (!small || path === item.href);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 ${small ? "py-1.5" : "py-2"} text-sm font-medium transition-colors duration-150 ${
        active ? "bg-accent-900 text-accent-300 shadow-[inset_0_0_0_1px_var(--color-accent-800)]" : "text-neutral-300 hover:bg-ink/7 hover:text-ink"
      }`}
    >
      <item.icon aria-hidden weight={active ? "fill" : "regular"} className={`size-[18px] ${active ? "text-accent-400" : "text-neutral-500"}`} />
      {item.label}
    </Link>
  );
}

/** Left sidebar links, for large screens. */
export function SidebarNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      <Link
        href={NEW_BOOKING_HREF}
        scroll={false}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-accent text-sm font-medium text-accent-400 shadow-glow transition-colors duration-150 hover:bg-accent/12"
      >
        <PlusIcon aria-hidden className="size-[18px]" />
        New booking
      </Link>
      <div className="space-y-0.5">
        {main.map((item) => (
          <SideLink key={item.href} item={item} path={path} />
        ))}
      </div>
      <div>
        <p className="mb-1.5 px-3 text-xs font-medium text-neutral-500">Your business</p>
        <div className="space-y-0.5">
          {business.map((item) => (
            <SideLink key={item.href} item={item} path={path} small />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 px-3 text-xs font-medium text-neutral-500">Set up</p>
        <div className="space-y-0.5">
          {setup.map((item) => (
            <SideLink key={item.href} item={item} path={path} small />
          ))}
        </div>
      </div>
    </nav>
  );
}
