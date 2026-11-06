import { Suspense } from "react";
import { CustomerTabs } from "@/components/customer-tabs";
import { FlashToast } from "@/components/flash-toast";
import { PageSkeleton } from "@/components/ui";

// The customer's side of the app: Book and My bookings, with tabs at the bottom.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main id="content" className="mx-auto w-full max-w-xl flex-1 px-4 pt-5 pb-[calc(120px+env(safe-area-inset-bottom))] sm:px-6 sm:pt-10">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
      <CustomerTabs />
      <Suspense>
        <FlashToast />
      </Suspense>
    </div>
  );
}
