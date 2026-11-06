import { z } from "zod";
import { AssistantError, claudeReply } from "@/lib/assistant/claude";
import { practiceReply } from "@/lib/assistant/practice";
import { isLang, LANG_HEADER, type Lang } from "@/lib/i18n/config";
import { dictFor } from "@/lib/i18n/dict";
import { aiProvider } from "@/lib/assistant/provider";
import { makeToolbox } from "@/lib/assistant/tools";
import { CHAT_LIMITS, type ChatReply, type ShopFacts } from "@/lib/assistant/types";
import { getPublicShop, shopToday } from "@/lib/booking";
import { addDays } from "@/lib/slots";
import { slugSchema } from "@/lib/validation";
import { clientIp, visitorKey } from "@/lib/visitor";

// The chat helper on a shop's public page. The browser sends the whole
// conversation each time (short, text only); nothing is stored except a
// count of messages for the limits.

const turn = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), text: z.string().trim().min(1).max(CHAT_LIMITS.maxUserChars) }),
  z.object({ role: z.literal("assistant"), text: z.string().trim().min(1).max(CHAT_LIMITS.maxAssistantChars) }),
]);

const chatRequest = z.object({
  slug: slugSchema,
  messages: z
    .array(turn)
    .min(1)
    .max(CHAT_LIMITS.maxTurns)
    .refine((m) => m.at(-1)?.role === "user", "The last message must be the customer's."),
});

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request) {
  // The proxy picked the visitor's language (their EN · RO choice, or their phone's).
  const lang = isLang(request.headers.get(LANG_HEADER)) ? (request.headers.get(LANG_HEADER) as Lang) : "en";
  const t = dictFor(lang);
  if (Number(request.headers.get("content-length") ?? 0) > 64_000) return fail(413, t.chat.errors.tooLong);
  const parsed = chatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const tooLong = parsed.error.issues.some((i) => i.code === "too_big" && i.path.at(-1) === "text");
    return fail(400, tooLong ? t.chat.errors.shorter : t.chat.errors.cantSend);
  }
  const { slug, messages } = parsed.data;

  const data = await getPublicShop(slug);
  if (!data) return fail(404, t.chat.errors.shopGone);
  const { supabase, shop, services, hours } = data;

  const { data: verdict, error: limitError } = await supabase.rpc("take_chat_turn", {
    p_shop_id: shop.id,
    // A one-way code for "this visitor at this shop", so no network address is stored.
    p_visitor: visitorKey(clientIp(request.headers), `chat:${shop.id}`),
  });
  if (limitError) {
    console.error("take_chat_turn failed:", limitError.message);
    return fail(500, t.chat.errors.notWorking);
  }
  if (verdict === "visitor_limit") return fail(429, t.chat.errors.tooMany);
  if (verdict === "shop_limit") return fail(429, t.chat.errors.resting);
  if (verdict !== "ok") return fail(404, t.chat.errors.shopGone);

  const { data: notes } = await supabase.from("shop_info").select("question, answer").eq("shop_id", shop.id).order("created_at");

  const now = new Date();
  const today = shopToday(shop.timezone, now);
  const facts: ShopFacts = {
    name: shop.name,
    about: shop.about,
    address: shop.address,
    phone: shop.phone,
    timezone: shop.timezone,
    currency: shop.currency,
    today,
    lastDay: addDays(today, shop.booking_window_days),
    services,
    hours,
    notes: notes ?? [],
    lang,
  };
  // A customer's old messages may come first; the conversation must start with them.
  const history = messages.slice(messages.findIndex((m) => m.role === "user"));
  const tools = makeToolbox(data, facts, now);

  try {
    const reply: ChatReply =
      aiProvider() === "claude" ? await claudeReply(facts, history, tools) : await practiceReply(facts, history, tools);
    return Response.json(reply);
  } catch (error) {
    if (error instanceof AssistantError) return fail(503, error.message);
    console.error("Chat helper failed:", error);
    return fail(500, t.chat.problem);
  }
}
