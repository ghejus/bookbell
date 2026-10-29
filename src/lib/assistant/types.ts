// Shapes shared by the chat helper's server code and the chat box in the browser.

import type { Currency } from "@/lib/format";

/** One line of the conversation, as the browser sends it back each time. */
export type ChatTurn = { role: "user" | "assistant"; text: string };

export type ChatService = { id: string; name: string; durationMinutes: number; summary: string };

/** Free times the chat box shows as buttons under the helper's answer. */
export type ChatTimes = {
  service: ChatService;
  days: { date: string; label: string; slots: { iso: string; label: string }[] }[];
};

/** A time the helper suggests booking. The customer still types their details and taps Book. */
export type ChatBooking = { service: ChatService; startsAt: string; whenLabel: string };

export type ChatReply = { reply: string; times?: ChatTimes; booking?: ChatBooking };

/** Everything the helper may know about a shop: only what the owner made public. */
export type ShopFacts = {
  name: string;
  about: string;
  address: string;
  phone: string;
  timezone: string;
  currency: Currency;
  /** Today in the shop's time zone, "YYYY-MM-DD". */
  today: string;
  /** Last day that can be booked, "YYYY-MM-DD". */
  lastDay: string;
  services: { id: string; name: string; duration_minutes: number; price_cents: number | null }[];
  hours: { weekday: number; opens: string; closes: string }[];
  notes: { question: string; answer: string }[];
};

type ToolResult<T> = { ok: true; value: T; text: string } | { ok: false; text: string };

/**
 * The two things the helper can do. Both re-check everything on the server.
 * `text` is what the AI reads; `value` is what the chat box shows.
 */
export interface Toolbox {
  findFreeTimes(input: { serviceId: string; fromDate?: string; days?: number }): Promise<ToolResult<ChatTimes>>;
  proposeBooking(input: { serviceId: string; date: string; time: string }): Promise<ToolResult<ChatBooking>>;
}

export const CHAT_LIMITS = {
  /** Messages kept and sent back each time (older ones drop off). */
  maxTurns: 20,
  maxUserChars: 500,
  maxAssistantChars: 2000,
} as const;
