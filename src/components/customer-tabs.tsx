"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheckIcon, StorefrontIcon } from "@/components/icons";
import { useT } from "@/lib/i18n/client";

/** The customer's bar at the bottom of the phone screen: Book and My bookings. */
export function CustomerTabs() {
  const path = usePathname();
  const t = useT();
  const tabs = [
    { href: "/my/shops", label: t.tabs.book, icon: StorefrontIcon, active: path.startsWith("/my/shops") || path.startsWith("/s/") },
    { href: "/my", label: t.tabs.myBookings, icon: CalendarCheckIcon, active: path === "/my" },
  ];
  return (
    <nav
      aria-label={t.tabs.main}
      className="fixed inset-x-0 bottom-0 z-40 bg-ground/90 px-2.5 pt-[7px] pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-lg"
    >
      <span aria-hidden className="rule-top absolute inset-x-0 top-0 h-px" />
      <div className="mx-auto flex max-w-sm items-start">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors duration-150 ${t.active ? "text-accent-400" : "text-neutral-500 hover:text-neutral-300"}`}
          >
            <t.icon aria-hidden weight={t.active ? "fill" : "regular"} className="size-6" />
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
