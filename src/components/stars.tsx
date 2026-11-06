import { StarIcon } from "@/components/icons";
import { getT } from "@/lib/i18n/server";

/**
 * A row of five stars, filled up to `stars` (rounded to the nearest whole star).
 * Screen readers hear "4 out of 5 stars" once, not five pictures.
 */
export async function Stars({ stars, size = "size-4", className = "" }: { stars: number; size?: string; className?: string }) {
  const filled = Math.round(stars);
  const t = await getT();
  return (
    <span role="img" aria-label={t.reviews.starsLabel(filled)} className={`inline-flex shrink-0 items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon
          key={n}
          aria-hidden
          weight="fill"
          className={`${size} ${n <= filled ? "text-accent-400" : "text-neutral-700"}`}
        />
      ))}
    </span>
  );
}
