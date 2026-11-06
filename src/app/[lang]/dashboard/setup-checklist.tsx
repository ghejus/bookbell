import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { buttonClass, Card } from "@/components/ui";
import type { requireShop } from "@/lib/shop";
import { mark } from "@/lib/i18n/owner";
import { getOwnerT } from "@/lib/i18n/server";

type Ctx = Awaited<ReturnType<typeof requireShop>>;

/** How far the owner got with setting up. */
export async function setupSteps({ supabase, shop }: Pick<Ctx, "supabase" | "shop">) {
  const counts = await Promise.all(
    (["services", "opening_hours", "shop_info"] as const).map((table) =>
      supabase.from(table).select("id", { count: "exact", head: true }).eq("shop_id", shop.id),
    ),
  );
  const [services, hours, notes] = counts.map((r) => r.count ?? 0);
  return [
    { done: true, label: mark("Create your shop"), detail: mark("Name, web address and prices."), href: "/dashboard/shop" },
    { done: services > 0, label: mark("Add your services"), detail: mark("What customers can book and how long it takes."), href: "/dashboard/services" },
    { done: hours > 0, label: mark("Set your opening hours"), detail: mark("Customers can only book inside these."), href: "/dashboard/hours" },
    { done: notes > 0, label: mark("Write notes for the AI helper"), detail: mark("Parking, payment, kids: what people often ask."), href: "/dashboard/info" },
  ];
}

/** "Finish setting up": the steps left, with a Start button on the next one. Nothing once all are done. */
export async function SetupChecklist({ steps }: { steps: Awaited<ReturnType<typeof setupSteps>> }) {
  const o = await getOwnerT();
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-[18px] pt-[18px]">
        <h2 className="text-base font-medium">{o("Finish setting up")}</h2>
        <span className="text-sm text-neutral-400 tabular">
          {o("{done} of {all} done", { done: doneCount, all: steps.length })}
        </span>
      </div>
      <div
        className="mx-[18px] mt-3 h-1 overflow-hidden rounded-full bg-neutral-800"
        role="progressbar"
        aria-label={o("Setup progress")}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
      >
        <div className="h-full rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4">
        {steps.map((step) => (
          <li key={step.label} className="rule-top flex items-center gap-3 px-[18px] py-3.5">
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                step.done ? "bg-success-soft text-success-ink" : "border-[1.5px] border-neutral-700"
              }`}
            >
              {step.done ? <CheckIcon aria-hidden weight="bold" className="size-3.5" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${step.done ? "text-neutral-500 line-through decoration-neutral-700" : ""}`}>
                <span className="sr-only">{step.done ? o("Done: ") : o("To do: ")}</span>
                {o(step.label)}
              </p>
              {!step.done ? <p className="text-[13px] text-neutral-400">{o(step.detail)}</p> : null}
            </div>
            {step === next ? (
              <Link href={step.href} className={buttonClass("primary", { size: "sm" })}>
                {o("Start")}
                <ArrowRightIcon aria-hidden className="size-4" />
              </Link>
            ) : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}
