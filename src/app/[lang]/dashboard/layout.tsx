import Link from "next/link";
import { Suspense } from "react";
import { FlashToast } from "@/components/flash-toast";
import { Logo, PageSkeleton } from "@/components/ui";
import { SidebarAccount } from "./account";
import { SidebarNav, TabBar } from "./nav";
import { getOwnerT } from "@/lib/i18n/server";

// The owner's app: a bottom tab bar on phones, a left sidebar on computers.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const o = await getOwnerT();
  return (
    <div className="flex min-h-full flex-1">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {o("Skip to content")}
      </a>

      {/* Computer sidebar */}
      <aside className="sticky top-0 hidden h-dvh print:hidden w-60 shrink-0 flex-col border-r border-hairline px-3 py-5 lg:flex">
        <Link href="/dashboard" className="mb-6 px-3">
          <Logo />
        </Link>
        <div className="flex-1 overflow-y-auto">
          <SidebarNav />
        </div>
        <Suspense>
          <SidebarAccount />
        </Suspense>
      </aside>

      <main
        id="content"
        className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-[calc(132px+env(safe-area-inset-bottom))] sm:px-6 lg:py-10 has-[[data-wide]]:max-w-7xl print:max-w-none print:p-0"
      >
        {/* Pages here read the login cookie, so they render fresh on each visit. */}
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>

      <TabBar />
      <Suspense>
        <FlashToast />
      </Suspense>
    </div>
  );
}
