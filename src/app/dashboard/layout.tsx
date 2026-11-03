import Link from "next/link";
import { Suspense } from "react";
import { Logo, PageSkeleton } from "@/components/ui";
import { AccountMenu, DemoNotice, SidebarAccount } from "./account";
import { SidebarNav, TabsNav } from "./nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-6 px-3">
          <Logo />
        </Link>
        <div className="flex-1">
          <SidebarNav />
        </div>
        <Suspense>
          <SidebarAccount />
        </Suspense>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone and tablet top bar */}
        <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 lg:hidden">
          <div className="flex h-14 items-center justify-between">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <Suspense fallback={<span className="size-9 rounded-full bg-gray-100" />}>
              <AccountMenu />
            </Suspense>
          </div>
          <TabsNav />
        </header>

        <main id="content" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 lg:py-10 has-[[data-wide]]:max-w-7xl">
          {/* Pages here read the login cookie, so they render fresh on each visit. */}
          <Suspense>
            <DemoNotice />
          </Suspense>
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
