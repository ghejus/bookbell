import type { Metadata } from "next";
import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CaretLeftIcon, CaretRightIcon, ChatCircleTextIcon } from "@/components/icons";
import { ReviewList, StarSpread } from "@/components/review-list";
import { Stars } from "@/components/stars";
import { Card, EmptyState, Logo, PageSkeleton } from "@/components/ui";
import { getPublicShop, getShopMeta } from "@/lib/booking";
import { getT, pageLang } from "@/lib/i18n/server";
import { averageText, getShopRating, getShopReviews, REVIEWS_PER_PAGE } from "@/lib/reviews";

export async function generateMetadata({ params }: PageProps<"/[lang]/s/[slug]/reviews">): Promise<Metadata> {
  const { slug } = await params;
  const [shop, t] = await Promise.all([getShopMeta(slug), getT()]);
  return shop ? { title: t.reviews.metaTitle(shop.name) } : { title: t.shop.notFound };
}

async function ReviewsContent({ params, searchParams }: PageProps<"/[lang]/s/[slug]/reviews">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  await connection();
  const [data, t, lang] = await Promise.all([getPublicShop(slug), getT(), pageLang()]);
  if (!data) notFound();
  const { shop, supabase } = data;

  const rating = await getShopRating(supabase, shop.id);
  const pages = Math.max(1, Math.ceil(rating.total / REVIEWS_PER_PAGE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(String(query.page ?? "1"), 10) || 1));
  const reviews = await getShopReviews(supabase, shop.id, REVIEWS_PER_PAGE, (page - 1) * REVIEWS_PER_PAGE);
  const pageHref = (n: number) => `/s/${shop.slug}/reviews${n > 1 ? `?page=${n}` : ""}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/s/${shop.slug}`}
          className="-ml-2.5 inline-flex h-10 items-center gap-0.5 rounded-lg pr-2.5 pl-1 text-[15px] font-medium text-accent-400 transition-colors duration-150 hover:bg-accent/10"
        >
          <CaretLeftIcon aria-hidden className="size-5" />
          <span className="max-w-[16rem] truncate">{shop.name}</span>
        </Link>
        <h1 className="mt-1 text-[28px] leading-tight font-medium tracking-tight text-balance wrap-anywhere">{t.reviews.title}</h1>
      </div>

      {rating.total === 0 ? (
        <Card>
          <EmptyState icon={ChatCircleTextIcon} title={t.reviews.noneTitle}>
            {t.reviews.noneText}
          </EmptyState>
        </Card>
      ) : (
        <>
          <Card className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-8 sm:p-6">
            <div className="space-y-1">
              <p className="text-[40px] leading-none font-medium tracking-tight tabular">{averageText(rating.average, lang)}</p>
              <Stars stars={rating.average} />
              <p className="text-sm text-neutral-400">{t.reviews.count(rating.total)}</p>
            </div>
            <StarSpread counts={rating.counts} total={rating.total} />
          </Card>

          <ReviewList reviews={reviews} shopName={shop.name} />

          {pages > 1 ? (
            <nav aria-label={t.reviews.more} className="flex items-center justify-between gap-3 text-sm">
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 font-medium text-accent-400 hover:bg-accent/10">
                  <CaretLeftIcon aria-hidden className="size-4" />
                  {t.reviews.newer}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-neutral-400 tabular">
                {t.reviews.page(page, pages)}
              </span>
              {page < pages ? (
                <Link href={pageHref(page + 1)} className="-mr-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 font-medium text-accent-400 hover:bg-accent/10">
                  {t.reviews.older}
                  <CaretRightIcon aria-hidden className="size-4" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

export default async function Page(props: PageProps<"/[lang]/s/[slug]/reviews">) {
  const t = await getT();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<PageSkeleton />}>
          <ReviewsContent {...props} />
        </Suspense>
      </main>
      <footer className="pt-6 pb-10 text-center text-[13px] text-neutral-400">
        {t.common.bookingBy}{" "}
        <Link href="/" className="font-medium hover:underline">
          <Logo className="text-sm" />
        </Link>
        <div className="mt-2 flex justify-center">
          <LanguageSwitch />
        </div>
      </footer>
    </div>
  );
}
