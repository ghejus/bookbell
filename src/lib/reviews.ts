import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { en } from "./i18n/en";
import type { Lang } from "./i18n/config";
import { mark } from "./i18n/owner";
import type { Dict } from "./i18n/dict";

// Reviews: only people who really came can write one (the database checks).
// See supabase/migrations/20261116090000_reviews.sql.

/** What the customer may do: none (can't), open (can write), done (wrote it, can still change), locked (too late to change). */
export type ReviewState = "none" | "open" | "done" | "locked";

/** The customer's own review of one booking. */
export type OwnReview = {
  state: ReviewState;
  stars: number | null;
  body: string | null;
  reply: string | null;
  editable_until: string | null;
};

/** One review as everyone sees it on the shop page. */
export type PublicReview = {
  id: string;
  stars: number;
  body: string;
  author: string;
  service_name: string;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
};

export type Rating = { average: number; total: number; /** How many of each: index 0 = one star … index 4 = five stars. */ counts: number[] };

export const REVIEW_MAX = 1000;
/** Reviews shown on the shop page itself; the rest are on /s/<slug>/reviews. */
export const REVIEWS_ON_SHOP_PAGE = 3;
export const REVIEWS_PER_PAGE = 20;

export const STAR_WORDS = ["Bad", "Not great", "OK", "Good", "Great"] as const;

/**
 * The name shown on a review: "Ana Maria Popescu" -> "Ana P.", "Ana" -> "Ana".
 * The same rule as private.review_author in the database (used for demo reviews).
 */
export function reviewAuthor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0].slice(0, 40);
  return parts.length === 1 ? first : `${first} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** 4 -> "4 out of 5 stars", for screen readers. */
export const starsLabel = (stars: number) => `${stars} out of 5 stars`;

/** 4.75 -> "4.8", 5 -> "5.0". Romanian writes a comma: "4,8", "5,0". */
export const averageText = (average: number, lang: Lang = "en") => {
  const text = average.toFixed(1);
  return lang === "ro" ? text.replace(".", ",") : text;
};

/** "23 reviews", "1 review". */
export const reviewCount = (n: number) => `${n} review${n === 1 ? "" : "s"}`;

/** Stars and words, with messages in the visitor's language. */
export const reviewSchemaFor = (t: Dict) =>
  z.object({
    stars: z.coerce.number({ error: t.reviews.errors.tapStar }).int().min(1, t.reviews.errors.tapStar).max(5, t.reviews.errors.tapStar),
    body: z.string().trim().max(REVIEW_MAX, t.reviews.errors.tooLong).optional().default(""),
  });

export const reviewSchema = reviewSchemaFor(en);

export const replySchema = z.object({
  id: z.uuid(),
  // The owner sees this in their language (owner-ro.ts); 1000 is REVIEW_MAX.
  reply: z.string().trim().max(REVIEW_MAX, mark("Please keep it under 1000 characters.")).default(""),
});

/** Average and counts; zero reviews gives { average: 0, total: 0 }. */
export async function getShopRating(db: SupabaseClient, shopId: string): Promise<Rating> {
  const { data, error } = await db.rpc("shop_rating", { p_shop_id: shopId }).maybeSingle<{ average: number | string | null; total: number; counts: number[] }>();
  if (error) throw new Error(`Could not load the rating: ${error.message}`);
  return { average: Number(data?.average ?? 0), total: data?.total ?? 0, counts: data?.counts ?? [0, 0, 0, 0, 0] };
}

/** A page of a shop's reviews, newest first. */
export async function getShopReviews(db: SupabaseClient, shopId: string, limit: number, offset = 0): Promise<PublicReview[]> {
  const { data, error } = await db.rpc("shop_reviews", { p_shop_id: shopId, p_limit: limit, p_offset: offset });
  if (error) throw new Error(`Could not load reviews: ${error.message}`);
  return (data ?? []) as PublicReview[];
}
