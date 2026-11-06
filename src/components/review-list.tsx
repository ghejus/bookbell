import { Stars } from "@/components/stars";
import { starsLabel, type PublicReview } from "@/lib/reviews";

const reviewDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** One review: stars, who and when, their words, and the shop's reply under it. */
export function ReviewItem({ review, shopName, children }: { review: PublicReview; shopName: string; children?: React.ReactNode }) {
  return (
    <article className="space-y-2 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Stars stars={review.stars} />
        <p className="min-w-0 text-sm wrap-anywhere">
          <span className="font-medium">{review.author || "A customer"}</span>
          <span className="text-neutral-400">
            {" "}
            · <time dateTime={review.created_at}>{reviewDate.format(new Date(review.created_at))}</time>
          </span>
        </p>
      </div>
      <p className="text-[13px] text-neutral-400 wrap-anywhere">{review.service_name}</p>
      {review.body ? <p className="text-[15px] leading-relaxed whitespace-pre-line wrap-anywhere">{review.body}</p> : null}
      {review.reply ? (
        <div className="mt-1 border-l-2 border-accent-700 pl-3 text-sm">
          <p className="mb-0.5 font-medium wrap-anywhere">Reply from {shopName}</p>
          <p className="whitespace-pre-line text-neutral-300 wrap-anywhere">{review.reply}</p>
        </div>
      ) : null}
      {children}
    </article>
  );
}

/** Reviews in a card, one under the other. */
export function ReviewList({ reviews, shopName }: { reviews: PublicReview[]; shopName: string }) {
  return (
    <ul className="overflow-hidden rounded-lg bg-surface shadow-card">
      {reviews.map((r) => (
        <li key={r.id} className="rule-top">
          <ReviewItem review={r} shopName={shopName} />
        </li>
      ))}
    </ul>
  );
}

/** How many people gave each number of stars, as plain bars (5 stars on top). */
export function StarSpread({ counts, total }: { counts: number[]; total: number }) {
  return (
    <ul className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((n) => {
        const count = counts[n - 1] ?? 0;
        const share = total ? count / total : 0;
        return (
          <li key={n} className="flex items-center gap-2.5 text-[13px]">
            <span className="sr-only">
              {starsLabel(n)}: {count}
            </span>
            <span aria-hidden className="w-3 text-right text-neutral-400 tabular">
              {n}
            </span>
            <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
              <span className="block h-full rounded-full bg-accent-500" style={{ width: `${Math.round(share * 100)}%` }} />
            </span>
            <span aria-hidden className="w-8 text-neutral-400 tabular">
              {count}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
