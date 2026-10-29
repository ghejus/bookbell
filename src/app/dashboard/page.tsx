import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { buttonClass, Card, CardSection, PageHeader, PageSkeleton } from "@/components/ui";
import { getMyShop } from "@/lib/shop";
import { ShopForm } from "./shop-form";

export const metadata: Metadata = { title: "Your shop" };

async function ShopContent() {
  const { supabase, shop, email } = await getMyShop();
  const timezones = Intl.supportedValuesOf("timeZone");

  if (!shop) {
    return (
      <>
        <PageHeader
          title="Set up your shop"
          description={`Signed in as ${email}. This takes about two minutes, and you can change everything later.`}
        />
        <CardSection title="Shop details" description="Customers see these on your booking page.">
          <ShopForm shop={null} timezones={timezones} />
        </CardSection>
      </>
    );
  }

  const counts = await Promise.all(
    (["services", "opening_hours", "shop_info"] as const).map((table) =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    ),
  );
  const [services, hours, notes] = counts.map((r) => r.count ?? 0);
  const steps = [
    { done: true, label: "Create your shop", detail: "Name, web address and prices.", href: "/dashboard" },
    { done: services > 0, label: "Add your services", detail: "What customers can book and how long it takes.", href: "/dashboard/services" },
    { done: hours > 0, label: "Set your opening hours", detail: "Customers can only book inside these.", href: "/dashboard/hours" },
    { done: notes > 0, label: "Write notes for the AI helper", detail: "Parking, payment, kids: what people often ask.", href: "/dashboard/info" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <>
      <PageHeader title={shop.name} description={<>Booking page: /s/{shop.slug} (opens to customers in the next update).</>} />

      <div className="space-y-6">
        {next ? (
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-6">
              <h2 className="text-base font-semibold text-gray-900">Finish setting up</h2>
              <span className="text-sm text-gray-600 tabular">
                {doneCount} of {steps.length} done
              </span>
            </div>
            <div
              className="mx-5 mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100 sm:mx-6"
              role="progressbar"
              aria-label="Setup progress"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
            >
              <div className="h-full rounded-full bg-green-600" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-3 px-5 py-3.5 sm:px-6">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                      step.done ? "bg-green-600 text-white" : "border-2 border-gray-300"
                    }`}
                  >
                    {step.done ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium ${step.done ? "text-gray-600 line-through decoration-gray-300" : "text-gray-900"}`}>
                      <span className="sr-only">{step.done ? "Done: " : "To do: "}</span>
                      {step.label}
                    </p>
                    {!step.done ? <p className="text-sm text-gray-600">{step.detail}</p> : null}
                  </div>
                  {step === next ? (
                    <Link href={step.href} className={buttonClass("primary", { size: "sm" })}>
                      Start
                      <ArrowRight aria-hidden className="size-4" />
                    </Link>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}

        <CardSection title="Shop details" description="Customers see these on your booking page.">
          <ShopForm shop={shop} timezones={timezones} />
        </CardSection>
      </div>
    </>
  );
}

// Its own loading boundary, so switching tabs shows a placeholder right away.
export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShopContent />
    </Suspense>
  );
}
