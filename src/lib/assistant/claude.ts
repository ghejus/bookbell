import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { systemPrompt } from "./facts";
import type { ChatBooking, ChatReply, ChatTimes, ChatTurn, ShopFacts, Toolbox } from "./types";

// The real AI helper, using Claude with two tools. Claude asks for a tool,
// our server runs it (checking everything), and Claude answers with the result.

const MODEL = "claude-opus-5-5";
/** A safety stop: at most this many tool rounds per customer message. */
const MAX_ROUNDS = 5;

export class AssistantError extends Error {}

const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "find_free_times",
    description:
      "Finds free start times for one service, day by day, in the shop's time zone. Call it whenever the customer asks when they can come, or before suggesting any time.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "The id of a service from the services list." },
        from_date: { type: "string", description: "First day to search, YYYY-MM-DD in shop time. Use today's date unless the customer asked for a later day." },
        days: { type: "integer", description: "How many days to search, 1 to 14. Use 7 unless the customer needs more." },
      },
      required: ["service_id", "from_date", "days"],
      additionalProperties: false,
    },
  },
  {
    name: "propose_booking",
    description:
      "Shows the customer a booking form for one free time, after they have chosen the service and the time. It does not book: the customer types their name and email and taps Book.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "The id of a service from the services list." },
        date: { type: "string", description: "The day, YYYY-MM-DD in shop time." },
        time: { type: "string", description: "The start time, HH:MM 24-hour in shop time, exactly as find_free_times listed it." },
      },
      required: ["service_id", "date", "time"],
      additionalProperties: false,
    },
  },
];

let client: Anthropic | undefined;

export async function claudeReply(facts: ShopFacts, history: ChatTurn[], tools: Toolbox): Promise<ChatReply> {
  client ??= new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.text }));
  let times: ChatTimes | undefined;
  let booking: ChatBooking | undefined;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        // A chat helper with short answers: low effort keeps replies quick and cheap.
        output_config: { effort: "low" },
        // If a safety check wrongly declines a harmless question, the API
        // retries on a fallback model instead of failing.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Reuse the shop's instructions and tools between messages (cheaper and faster).
        cache_control: { type: "ephemeral" },
        system: systemPrompt(facts),
        tools: TOOLS,
        messages,
      });
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        console.error("Claude: the ANTHROPIC_API_KEY is not valid.");
        throw new AssistantError("The helper isn’t set up correctly right now.");
      }
      if (error instanceof Anthropic.RateLimitError) throw new AssistantError("The helper is busy right now. Please try again in a minute.");
      if (error instanceof Anthropic.APIError) {
        console.error(`Claude API error ${error.status}:`, error.message);
        throw new AssistantError("The helper had a problem answering. Please try again.");
      }
      throw error;
    }

    if (response.stop_reason === "refusal") {
      return { reply: "Sorry, I can’t help with that. I can answer questions about this shop and find you a free time." };
    }
    if (response.stop_reason === "max_tokens") throw new AssistantError("The helper’s answer got too long. Please try again.");

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;

    const calls = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (response.stop_reason !== "tool_use" || calls.length === 0) {
      const reply = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return { reply: reply || "Sorry, I didn’t catch that. Could you ask again?", times, booking };
    }

    // Run every tool Claude asked for, then send all results back in one message.
    const results = await Promise.all(
      calls.map(async (call): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        const input = (call.input ?? {}) as Record<string, unknown>;
        const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string) : "");
        let result;
        if (call.name === "find_free_times") {
          result = await tools.findFreeTimes({ serviceId: str("service_id"), fromDate: str("from_date"), days: Number(input.days) });
          if (result.ok && result.value.days.length > 0) times = result.value;
        } else if (call.name === "propose_booking") {
          result = await tools.proposeBooking({ serviceId: str("service_id"), date: str("date"), time: str("time") });
          if (result.ok) booking = result.value;
        } else {
          result = { ok: false as const, text: `Unknown tool ${call.name}.` };
        }
        return { type: "tool_result", tool_use_id: call.id, content: result.text, is_error: !result.ok };
      }),
    );
    messages.push({ role: "user", content: results });
  }

  return { reply: "Sorry, that took me too long. Could you ask in a simpler way?", times, booking };
}
