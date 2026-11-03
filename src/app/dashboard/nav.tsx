"use client";

import { CalendarDays, Clock, MessageSquareText, Store, Tags, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Shop", icon: Store },
  { href: "/dashboard/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/dashboard/services", label: "Services", icon: Tags },
  { href: "/dashboard/team", label: "Team", icon: Users },
  { href: "/dashboard/hours", label: "Hours", icon: Clock },
  { href: "/dashboard/info", label: "AI notes", icon: MessageSquareText },
];

/** Pill tabs under the top bar, for phones and tablets. */
export function TabsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-3 [mask-image:linear-gradient(to_right,#000_88%,transparent)] [scrollbar-width:none]"
    >
      {links.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-brand-700 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Left sidebar links, for large screens. */
export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="space-y-0.5">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
              active ? "bg-brand-50 text-brand-800" : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            }`}
          >
            <Icon aria-hidden className={`size-4.5 ${active ? "text-brand-700" : "text-gray-500"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
