import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AccountButton } from "@/components/account-sheet";
import { CaretRightIcon, StorefrontIcon } from "@/components/icons";
import { Card, EmptyState, PageHeader, PageSkeleton } from "@/components/ui";
import { accountInfo } from "@/lib/account";
import { getT } from "@/lib/i18n/server";
import { myBookings } from "../data";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).my.shopsTitle };
}

/** The Book tab: the shops this person has booked at (and their own shop), one tap from booking again. */
async function ShopsContent() {
  const [{ supabase, userId, bookings }, account, t] = await Promise.all([myBookings(), accountInfo(), getT()]);
  const { data: own } = await supabase.from("shops").select("slug, name, address").eq("owner_id", userId).maybeSingle();

  const shops = new Map<string, { slug: string; name: string; address: string; note: string }>();
  if (own) shops.set(own.slug, { ...own, note: t.my.yourShop });
  for (const b of [...bookings].reverse()) {
    if (!shops.has(b.shop_slug)) shops.set(b.shop_slug, { slug: b.shop_slug, name: b.shop_name, address: b.shop_address, note: "" });
  }
  const list = [...shops.values()];

  return (
    <>
      <PageHeader title={t.my.shopsTitle} eyebrow={t.my.yourShops} action={<AccountButton account={account} mode="customer" />} />
      {list.length === 0 ? (
        <Card>
          <EmptyState icon={StorefrontIcon} title={t.my.noShopsTitle}>
            {t.my.noShopsText}
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
          <p className="px-1 text-[13px] text-neutral-400">{t.my.bookNew}</p>
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
