import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, PageSkeleton } from "@/components/ui";
import type { BookingRules } from "@/lib/booking-rules";
import { requireShop } from "@/lib/shop";
import { OwnerHeader } from "../account";
import { RulesForm } from "./rules-form";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Booking rules") };
}

async function RulesContent() {
  const o = await getOwnerT();
  const { supabase, shop } = await requireShop();
  const { data: rules } = await supabase
    .from("shops")
    .select("booking_window_days, min_notice_minutes, slot_step_minutes, buffer_minutes, cancel_deadline_hours")
    .eq("id", shop.id)
    .single<BookingRules>();

  return (
    <>
      <OwnerHeader back title={o("Booking rules")} description={o("When customers can book online, and how close to the visit they can still change it.")} />
      <Card className="p-5 sm:p-6">{rules ? <RulesForm rules={rules} /> : <p className="text-sm text-neutral-400">{o("Could not load your rules. Please reload the page.")}</p>}</Card>
    </>
  );
}

export default function RulesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RulesContent />
    </Suspense>
  );
}
