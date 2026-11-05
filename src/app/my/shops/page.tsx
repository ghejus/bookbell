import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-sheet";
import { CaretRightIcon, StorefrontIcon } from "@/components/icons";
import { Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { accountInfo } from "@/lib/account";
import { myBookings } from "../data";

export const metadata: Metadata = { title: "Book" };

/** The Book tab: the shops this person has booked at (and their own shop), one tap from booking again. */
async function ShopsContent() {
  const [{ supabase, userId, bookings }, account] = await Promise.all([myBookings(), accountInfo()]);
  const { data: own } = await supabase.from("shops").select("slug, name, address").eq("owner_id", userId).maybeSingle();

  const shops = new Map<string, { slug: string; name: string; address: string; note: string }>();
  if (own) shops.set(own.slug, { ...own, note: "Your shop" });
  for (const b of [...bookings].reverse()) {
    if (!shops.has(b.shop_slug)) shops.set(b.shop_slug, { slug: b.shop_slug, name: b.shop_name, address: b.shop_address, note: "" });
  }
  const list = [...shops.values()];

  return (
    <>
      <PageHeader title="Book" eyebrow="Your shops" action={<AccountButton account={account} mode="customer" />} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={StorefrontIcon} title="No shops yet">
            Open the booking link a shop gave you (in a message, on their profile or by the door). Shops you book at show up here.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card className="overflow-hidden">
            <ul>
              {list.map((s) => (
                <li key={s.slug}>
                  <Link href={`/s/${s.slug}`} className="rule-top flex min-h-16 items-center gap-3 py-3 pr-3.5 pl-4 transition-colors duration-150 hover:bg-ink/4">
                    <StorefrontIcon aria-hidden className="size-5 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-medium wrap-anywhere">{s.name}</span>
                      {s.note || s.address ? <span className="block text-[13px] text-neutral-400 wrap-anywhere">{s.note || s.address}</span> : null}
                    </span>
                    <CaretRightIcon aria-hidden className="size-4 shrink-0 text-neutral-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <p className="px-1 text-[13px] text-neutral-400">To book somewhere new, open the booking link the shop gave you.</p>
        </div>
      )}
    </>
  );
}

export default function ShopsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopsContent />
    </Suspense>
  );
}
