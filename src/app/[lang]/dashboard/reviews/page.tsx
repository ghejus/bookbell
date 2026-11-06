import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowBendUpLeftIcon, ArrowSquareOutIcon, ChatCircleTextIcon } from "@/components/icons";
import { ReviewItem, StarSpread } from "@/components/review-list";
import { Sheet, SheetHeader } from "@/components/sheet";
import { Stars } from "@/components/stars";
import { Card, EmptyState, PageSkeleton } from "@/components/ui";
import { averageText, getShopRating, type PublicReview } from "@/lib/reviews";
import { requireShop } from "@/lib/shop";
import { OwnerHeader } from "../account";
import { ReplyForm } from "./reply-form";
import { getOwnerT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerT())("Reviews") };
}

type OwnerReview = {
  id: string;
  stars: number;
  body: string;
  author: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  bookings: { status: "booked" | "cancelled" | "no_show"; customer_name: string; services: { name: string } | null } | null;
};

const isId = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

async function ReviewsContent({ searchParams }: PageProps<"/[lang]/dashboard/reviews">) {
  const query = await searchParams;
  const [{ supabase, shop }, o] = await Promise.all([requireShop(), getOwnerT()]);
  const [rating, { data }] = await Promise.all([
    getShopRating(supabase, shop.id),
    supabase
      .from("reviews")
      .select("id, stars, body, author, created_at, reply, replied_at, bookings(status, customer_name, services(name))")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .returns<OwnerReview[]>(),
  ]);
  const all = data ?? [];
  const toPublic = (r: OwnerReview): PublicReview => ({ ...r, service_name: r.bookings?.services?.name ?? "" });
  const replying = isId(query.r) ? all.find((r) => r.id === query.r) : undefined;
  const waiting = all.filter((r) => !r.reply && r.bookings?.status === "booked").length;

  return (
    <>
      <OwnerHeader back title={o("Reviews")} description={o("What customers say after a visit. You can reply to each one; everyone sees your reply.")} />

      {all.length === 0 ? (
        <Card>
          <EmptyState icon={ChatCircleTextIcon} title={o("No reviews yet")}>
            {o("The day after a visit, customers can rate it from their booking link or My bookings. Only people who booked online and came can review.")}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8">
            <div className="space-y-1">
              <p className="text-[40px] leading-none font-medium tracking-tight tabular">{averageText(rating.average)}</p>
              <Stars stars={rating.average} />
              <p className="text-sm text-neutral-400">{o.n(rating.total, "{n} review on your page", "{n} reviews on your page")}</p>
            </div>
            <StarSpread counts={rating.counts} total={rating.total} />
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] text-neutral-400">
            <p>{waiting ? o("{n} without a reply", { n: waiting }) : o("You replied to every review.")}</p>
            <Link href={`/s/${shop.slug}#reviews`} className="inline-flex items-center gap-1 font-medium text-accent-400 hover:underline">
              {o("See them on your page")}
              <ArrowSquareOutIcon aria-hidden className="size-3.5" />
            </Link>
          </div>

          <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
            {all.map((r) => {
              const hidden = r.bookings?.status !== "booked";
              return (
                <li key={r.id} className={`rule-top ${hidden ? "opacity-60" : ""}`}>
                  <ReviewItem review={toPublic(r)} shopName={shop.name}>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                      {hidden ? (
                        <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300">{o("Not shown: marked as didn’t come")}</span>
                      ) : (
                        <Link
                          href={`/dashboard/reviews?r=${r.id}`}
                          scroll={false}
                          className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
                        >
                          <ArrowBendUpLeftIcon aria-hidden className="size-4" />
                          {r.reply ? o("Edit reply") : o("Reply")}
                        </Link>
                      )}
                      {r.bookings?.customer_name && r.bookings.customer_name !== r.author ? (
                        <span className="text-[13px] text-neutral-500 wrap-anywhere">{o("From {name}", { name: r.bookings.customer_name })}</span>
                      ) : null}
                    </div>
                  </ReviewItem>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {replying ? (
        <Sheet label={o("Reply to a review")} closeHref="/dashboard/reviews">
          <SheetHeader title={o("Reply")} closeHref="/dashboard/reviews" description={replying.author || o("A customer")} />
          <div className="space-y-5">
            <div className="space-y-1.5 rounded-lg bg-raised px-4 py-3">
              <Stars stars={replying.stars} />
              {replying.body ? <p className="text-sm whitespace-pre-line text-neutral-300 wrap-anywhere">{replying.body}</p> : null}
            </div>
            <ReplyForm key={replying.id} reviewId={replying.id} reply={replying.reply ?? ""} />
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

export default function ReviewsPage(props: PageProps<"/[lang]/dashboard/reviews">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ReviewsContent {...props} />
    </Suspense>
  );
}
