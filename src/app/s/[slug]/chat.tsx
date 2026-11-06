"use client";

import { CalendarCheckIcon, CalendarPlusIcon, CircleNotchIcon, ChatCircleIcon, PaperPlaneRightIcon, XIcon } from "@/components/icons";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Field, FormMessage, SubmitButton } from "@/components/form";
import { useActionForm } from "@/components/use-action-form";
import { Badge, buttonClass } from "@/components/ui";
import { whenLabel } from "@/lib/assistant/facts";
import { calendarHref } from "@/lib/ics";
import { CHAT_LIMITS, type ChatBooking, type ChatReply, type ChatTimes, type ChatTurn } from "@/lib/assistant/types";
import { bookAppointment } from "./actions";

// The helper on a shop's page: a button in the corner that opens a chat.
// It answers from the shop's own details and shows free times as buttons.
// It never books on its own: the customer types their details and taps Book.

type Props = {
  slug: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  timezone: string;
  /** True when no AI key is set and the simple practice helper answers. */
  practice: boolean;
  /** Lift the button above a bottom tab bar. */
  raised?: boolean;
  /** When the page was made, signed by the server (stops robots). */
  ticket: string;
};

type Message = ChatTurn & {
  id: number;
  times?: ChatTimes;
  booking?: ChatBooking;
  /** Added after the customer books from this message, so the helper knows. */
  bookedNote?: string;
  /** The welcome message: shown, never sent. */
  welcome?: boolean;
};

const QUICK_QUESTIONS = [
  { label: "Prices", text: "What are your prices?" },
  { label: "Opening hours", text: "When are you open?" },
  { label: "Next free time", text: "When is the next free time?" },
];

let nextId = 1;

export function ShopChat(props: Props) {
  const { slug, shopName, practice } = props;
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: nextId++,
      role: "assistant",
      welcome: true,
      text: `Hi! Ask me anything about ${shopName}, like prices, opening hours or free times.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Focus the message box on open; give focus back to the button on close.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) field.current?.focus();
    else if (wasOpen.current) launcher.current?.focus();
    wasOpen.current = open;
  }, [open]);

  // On phones the chat fills the screen, so the page behind it shouldn't scroll.
  useEffect(() => {
    if (!open || !window.matchMedia("(max-width: 639px)").matches) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = before;
    };
  }, [open]);

  // Keep the newest message in view. A long answer opens at its first line, so it can be read from the top.
  useEffect(() => {
    const el = log.current;
    if (!el) return;
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    const newest = [...el.querySelectorAll<HTMLElement>("[data-message]")].at(-1);
    if (!pending && newest?.dataset.message === "assistant" && newest.offsetHeight > el.clientHeight - 32) {
      el.scrollTo({ top: newest.offsetTop - el.offsetTop - 16, behavior });
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, [messages, pending, open]);

  async function send(text: string) {
    const clean = text.trim().slice(0, CHAT_LIMITS.maxUserChars);
    if (!clean || pending) return;
    const mine: Message = { id: nextId++, role: "user", text: clean };
    const next = [...messages, mine];
    setMessages(next);
    setInput("");
    setError(null);
    setPending(true);

    // Only the words go to the server: the last few messages, as text.
    const history: ChatTurn[] = next
      .filter((m) => !m.welcome)
      .slice(-CHAT_LIMITS.maxTurns)
      .map((m) => ({
        role: m.role,
        text: (m.bookedNote ? `${m.text}\n(${m.bookedNote})` : m.text).slice(0, m.role === "user" ? CHAT_LIMITS.maxUserChars : CHAT_LIMITS.maxAssistantChars),
      }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, messages: history }),
      });
      const body = (await res.json().catch(() => null)) as (ChatReply & { error?: string }) | null;
      if (!res.ok || !body?.reply) throw new Error(body?.error ?? "The helper had a problem answering. Please try again.");
      setMessages((m) => [...m, { id: nextId++, role: "assistant", text: body.reply, times: body.times, booking: body.booking }]);
    } catch (e) {
      // Put the message back in the box so nothing typed is lost.
      setMessages((m) => m.filter((x) => x.id !== mine.id));
      setInput(clean);
      setError(e instanceof TypeError ? "Couldn’t reach the helper. Check your connection and try again." : (e as Error).message);
    } finally {
      setPending(false);
      field.current?.focus();
    }
  }

  const markBooked = (id: number, note: string) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, bookedNote: note } : x)));
  const onlyWelcome = messages.length === 1;

  return (
    <>
      {!open ? (
        <button
          ref={launcher}
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-30 ${props.raised ? "bottom-[calc(100px+env(safe-area-inset-bottom))]" : "bottom-[max(1rem,env(safe-area-inset-bottom))] sm:right-6 sm:bottom-6"} inline-flex h-12 items-center gap-2 rounded-full border border-accent bg-surface pr-5 pl-4 text-sm font-medium text-accent-400 shadow-[0_0_24px_rgb(145_132_217/0.3),0_8px_24px_rgb(0_0_0/0.5)] transition-colors duration-150 hover:bg-accent-900 active:bg-accent-800`}
        >
          <ChatCircleIcon aria-hidden className="size-5" />
          Ask a question
        </button>
      ) : null}

      {open ? (
        <section
          role="dialog"
          aria-labelledby={titleId}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="fixed inset-0 z-50 flex flex-col bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:inset-auto sm:right-6 sm:bottom-6 sm:pt-0 sm:pb-0 sm:h-[min(680px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-xl sm:border sm:border-gray-200 sm:shadow-lg"
        >
          <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:pt-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate font-medium text-gray-900">
                Ask {shopName}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600">
                {practice ? (
                  <>
                    <Badge>Practice mode</Badge>
                    Simple answers from the shop’s details.
                  </>
                ) : (
                  "An AI helper. It only knows what the shop wrote."
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              title="Close chat"
              className="-mr-1.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-900"
            >
              <XIcon aria-hidden className="size-5" />
            </button>
          </header>

          <div ref={log} role="log" aria-live="polite" aria-label="Conversation" className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <p key={m.id} data-message="user" className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-900 px-3 py-2 text-sm wrap-anywhere whitespace-pre-wrap text-accent-100 ring-1 ring-accent-800 ring-inset">
                  {m.text}
                </p>
              ) : (
                <div key={m.id} data-message="assistant" className="space-y-3">
                  {/* The helper's words are shown as plain text, never as HTML. */}
                  <p className="w-fit max-w-[85%] rounded-lg bg-gray-100 px-3 py-2 text-sm wrap-anywhere whitespace-pre-wrap text-gray-900">{m.text}</p>
                  {m.booking ? (
                    <ChatBookingForm {...props} booking={m.booking} onBooked={(note) => markBooked(m.id, note)} />
                  ) : m.times ? (
                    <TimeChoices {...props} times={m.times} onBooked={(note) => markBooked(m.id, note)} />
                  ) : null}
                </div>
              ),
            )}

            {onlyWelcome && !pending ? (
              <div className="flex flex-wrap gap-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q.label} type="button" onClick={() => send(q.text)} className={buttonClass("secondary", { size: "sm" })}>
                    {q.label}
                  </button>
                ))}
              </div>
            ) : null}

            {pending ? (
              <p className="flex w-fit items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-600">
                <CircleNotchIcon aria-hidden className="size-4 motion-safe:animate-spin" />
                Thinking…
              </p>
            ) : null}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-gray-100 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            {error ? (
              <div className="mb-3">
                <FormMessage state={{ error }} />
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <label htmlFor={`${titleId}-input`} className="sr-only">
                Your question
              </label>
              <input
                ref={field}
                id={`${titleId}-input`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={CHAT_LIMITS.maxUserChars}
                placeholder="Type a question…"
                autoComplete="off"
                enterKeyHint="send"
                className="block h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-surface px-3 text-base text-gray-900 shadow-sm transition-colors duration-150 placeholder:text-gray-500 hover:border-gray-400 focus:border-brand-600 focus:ring-3 focus:ring-brand-100 focus:outline-none sm:text-sm"
              />
              <button type="submit" disabled={pending} aria-label="Send" title="Send" className={`${buttonClass("primary")} w-11 shrink-0 px-0`}>
                <PaperPlaneRightIcon aria-hidden className="size-4.5" />
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  );
}

type BookedFn = (note: string) => void;

/** Free times as buttons. Picking one opens the booking form right below. */
function TimeChoices(props: Props & { times: ChatTimes; onBooked: BookedFn }) {
  const { times, timezone } = props;
  const [picked, setPicked] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // One row per day keeps the chat calm; the page's steps show every time.
  const SHOWN = 4;

  const choices = done ? null : (
    <>
      {times.days.map((day) => (
        <div key={day.date}>
          <p className="mb-2 text-xs font-medium text-gray-600 tabular">{day.label}</p>
          <div className="grid grid-cols-4 gap-2">
            {day.slots.slice(0, SHOWN).map((s) => {
              const active = s.iso === picked;
              return (
                <button
                  key={s.iso}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${day.label}, ${s.label}`}
                  onClick={() => setPicked(active ? null : s.iso)}
                  className={`flex h-9 items-center justify-center rounded-lg border text-sm font-medium tabular shadow-sm transition-colors duration-150 ${
                    active ? "chip-on" : "chip-off"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {times.days.some((d) => d.slots.length > SHOWN) ? (
        <p className="text-sm text-gray-600">More times are in the booking steps on the page.</p>
      ) : null}
    </>
  );

  return (
    <div className="space-y-3">
      {choices}
      {picked ? (
        <ChatBookingForm
          key={picked}
          {...props}
          booking={{ service: times.service, startsAt: picked, whenLabel: whenLabel(picked, timezone) }}
          onBooked={(note) => {
            // After booking only the receipt stays, so a stray tap can't replace it.
            setDone(true);
            props.onBooked(note);
          }}
        />
      ) : null}
    </div>
  );
}

/** Name and email for one chosen time, booked through the same checks as the page's form. */
function ChatBookingForm(props: Props & { booking: ChatBooking; onBooked: BookedFn }) {
  const { booking, shopId } = props;
  const { state, pending, formProps } = useActionForm(bookAppointment);
  // Keep the first ticket, like the page's form does.
  const [ticket] = useState(props.ticket);
  const booked = state?.message === "booked" && state.values ? state.values : null;
  const time = booking.whenLabel.split(", ").pop();
  const { onBooked } = props;
  const told = useRef(false);
  const form = formProps.ref;

  // Bring the form into view when it opens, so the tap on a time is never "lost" below the fold.
  useEffect(() => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    form.current?.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
  }, [form]);

  // Tell the conversation once, so the helper knows about the booking.
  useEffect(() => {
    if (!booked || told.current) return;
    told.current = true;
    onBooked(`The customer booked ${booking.service.name} on ${booking.whenLabel}.`);
  }, [booked, booking, onBooked]);

  if (booked) {
    return (
      <div role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-900 ring-1 ring-green-200 ring-inset">
        <p className="flex items-center gap-2 font-medium">
          <CalendarCheckIcon aria-hidden className="size-4.5" />
          You’re booked
        </p>
        <p className="mt-1">{booking.service.summary}</p>
        <p className="font-medium tabular">{booking.whenLabel}</p>
        <p className="mt-1 text-green-800">
          Booked for {booked.customer_email}.{" "}
          {booked.manage_path ? (
            <Link href={booked.manage_path} className="font-medium underline hover:text-green-950">
              Change or cancel
            </Link>
          ) : (
            "If you can’t make it, please let the shop know."
          )}
        </p>
        <a
          href={calendarHref({
            start: booking.startsAt,
            minutes: booking.service.durationMinutes,
            title: booking.service.name,
            location: props.shopAddress,
            shopName: props.shopName,
          })}
          download="booking.ics"
          className={`${buttonClass("secondary", { size: "sm" })} mt-3`}
        >
          <CalendarPlusIcon aria-hidden className="size-4" />
          Add to calendar
        </a>
      </div>
    );
  }

  return (
    <form {...formProps} className="space-y-4 rounded-lg bg-gray-50 p-4">
      <div className="text-sm">
        <p className="font-medium text-gray-900">{booking.service.summary}</p>
        <p className="text-gray-700 tabular">{booking.whenLabel}</p>
      </div>
      <input type="hidden" name="shop_id" value={shopId} />
      <input type="hidden" name="service_id" value={booking.service.id} />
      <input type="hidden" name="starts_at" value={booking.startsAt} />
      <Field label="Your name" name="customer_name" autoComplete="name" required maxLength={80} />
      <Field label="Email" name="customer_email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required maxLength={200} hint="Only the shop sees it." />
      <Field label="Phone" name="customer_phone" type="tel" autoComplete="tel" maxLength={40} />
      {/* Hidden from people; only bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <input type="hidden" name="ticket" value={ticket} />
      <FormMessage state={state} />
      <div className="[&>button]:w-full">
        <SubmitButton pending={pending} pendingText="Booking…">
          {`Book ${time}`}
        </SubmitButton>
      </div>
    </form>
  );
}
