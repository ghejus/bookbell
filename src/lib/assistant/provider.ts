import "server-only";

/**
 * Which helper answers customers:
 *   "claude"   when ANTHROPIC_API_KEY is set (the real AI)
 *   "practice" otherwise (simple word matching, free, no key needed)
 * AI_PROVIDER=practice forces practice mode even when a key is set.
 */
export function aiProvider(): "claude" | "practice" {
  const forced = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (forced === "practice") return "practice";
  return process.env.ANTHROPIC_API_KEY ? "claude" : "practice";
}
