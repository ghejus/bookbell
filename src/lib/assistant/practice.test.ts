import { describe, expect, it, vi } from "vitest";
import { dayLabel, hoursLines, systemPrompt, whenLabel } from "./facts";
import { findDay, findNote, findService, practiceReply } from "./practice";
import type { ChatTurn, ShopFacts, Toolbox } from "./types";

const facts: ShopFacts = {
  name: "Demo Barber",
  about: "A small barber shop.",
  address: "Strada Lungă 1, Brașov",
  phone: "+40 700 000 000",
  timezone: "Europe/Bucharest",
  currency: "RON",
  today: "2026-11-02", // a Monday
  lastDay: "2027-01-01",
  services: [
    { id: "s-cut", name: "Men’s haircut", duration_minutes: 30, price_cents: 6000 },
    { id: "s-beard", name: "Beard trim", duration_minutes: 20, price_cents: 3500 },
    { id: "s-kids", name: "Kids haircut", duration_minutes: 30, price_cents: null },
  ],
  hours: [
    { weekday: 1, opens: "09:00:00", closes: "13:00:00" },
    { weekday: 1, opens: "14:00:00", closes: "18:00:00" },
    { weekday: 6, opens: "10:00:00", closes: "14:00:00" },
  ],
  notes: [
    { question: "Is there parking nearby?", answer: "Yes, free parking behind the shop." },
    { question: "Do you take card payments?", answer: "Cash and card are both fine." },
  ],
};

function fakeTools(days = [{ date: "2026-11-03", label: "Tue 3 Nov", slots: [{ iso: "2026-11-03T08:00:00.000Z", label: "10:00" }] }]) {
  const tools: Toolbox = {
    findFreeTimes: vi.fn(async ({ serviceId }) => {
      const s = facts.services.find((x) => x.id === serviceId)!;
      return { ok: true as const, text: "", value: { service: { id: s.id, name: s.name, durationMinutes: s.duration_minutes, summary: s.name }, days } };
    }),
    proposeBooking: vi.fn(async () => ({ ok: false as const, text: "" })),
  };
  return tools;
}

const ask = (...texts: string[]): ChatTurn[] => texts.map((text) => ({ role: "user", text }));

describe("practice helper", () => {
  it("answers from the owner's notes in the owner's words", async () => {
    const r = await practiceReply(facts, ask("can I park my car nearby?"), fakeTools());
    expect(r.reply).toBe("Yes, free parking behind the shop.");
  });

  it("lists services with prices", async () => {
    const r = await practiceReply(facts, ask("How much do you charge?"), fakeTools());
    expect(r.reply).toContain("Men’s haircut");
    expect(r.reply).toContain("60 lei");
    expect(r.reply).toContain("Beard trim");
  });

  it("describes one service when it is named", async () => {
    const r = await practiceReply(facts, ask("beard trim?"), fakeTools());
    expect(r.reply).toMatch(/^Beard trim takes 20 min and costs 35 lei/);
  });

  it("gives opening hours, not free times, for 'what time do you open'", async () => {
    const tools = fakeTools();
    const r = await practiceReply(facts, ask("What time do you open?"), tools);
    expect(r.reply).toContain("Monday: 09:00–13:00, 14:00–18:00");
    expect(r.reply).toContain("Sunday: closed");
    expect(tools.findFreeTimes).not.toHaveBeenCalled();
  });

  it("asks which service before looking for times", async () => {
    const tools = fakeTools();
    const r = await practiceReply(facts, ask("I want to book an appointment"), tools);
    expect(r.reply).toContain("Which service");
    expect(tools.findFreeTimes).not.toHaveBeenCalled();
  });

  it("finds free times for the named service and returns them as buttons", async () => {
    const tools = fakeTools();
    const r = await practiceReply(facts, ask("Is a kids haircut free tomorrow?"), tools);
    expect(tools.findFreeTimes).toHaveBeenCalledWith({ serviceId: "s-kids", fromDate: "2026-11-03", days: 7 });
    expect(r.times?.days[0].slots[0].label).toBe("10:00");
    expect(r.reply).toContain("Tap one to book");
  });

  it("remembers the service from an earlier message", async () => {
    const tools = fakeTools();
    await practiceReply(facts, ask("Beard trim please", "any free time on saturday?"), tools);
    expect(tools.findFreeTimes).toHaveBeenCalledWith({ serviceId: "s-beard", fromDate: "2026-11-07", days: 7 });
  });

  it("looks for times when the customer answers 'Which service?'", async () => {
    const tools = fakeTools();
    const history: ChatTurn[] = [
      { role: "user", text: "I want to book" },
      { role: "assistant", text: "Sure. Which service would you like? We offer: Men’s haircut, Beard trim, Kids haircut." },
      { role: "user", text: "beard trim" },
    ];
    const r = await practiceReply(facts, history, tools);
    expect(tools.findFreeTimes).toHaveBeenCalledWith({ serviceId: "s-beard", fromDate: undefined, days: 14 });
    expect(r.times).toBeDefined();
  });

  it("says so when nothing is free", async () => {
    const r = await practiceReply(facts, ask("book a beard trim"), fakeTools([]));
    expect(r.times).toBeUndefined();
    expect(r.reply).toContain("couldn’t find a free time");
  });

  it("admits when it doesn't understand, and offers the phone", async () => {
    const r = await practiceReply(facts, ask("What's the meaning of life?"), fakeTools());
    expect(r.reply).toContain("didn’t understand");
    expect(r.reply).toContain("+40 700 000 000");
  });
});

describe("word matching", () => {
  it("matches services by their words, ignoring accents and plurals", () => {
    expect(findService("two haircuts for my kids", facts.services)?.id).toBe("s-kids");
    expect(findService("mens haircut", facts.services)?.id).toBe("s-cut");
    expect(findService("hello", facts.services)).toBeUndefined();
  });

  it("matches notes only when enough words line up", () => {
    expect(findNote("do you take card?", facts.notes)?.answer).toBe("Cash and card are both fine.");
    expect(findNote("nearby", facts.notes)).toBeUndefined();
  });

  it("turns day words into dates (today is Monday 2 November)", () => {
    expect(findDay("today", facts.today)).toBe("2026-11-02");
    expect(findDay("tomorrow please", facts.today)).toBe("2026-11-03");
    expect(findDay("Monday", facts.today)).toBe("2026-11-02");
    expect(findDay("on Sunday", facts.today)).toBe("2026-11-08");
    expect(findDay("next week", facts.today)).toBe("2026-11-09");
    expect(findDay("whenever", facts.today)).toBeUndefined();
  });
});

describe("shop facts in plain words", () => {
  it("labels days and moments in shop time", () => {
    expect(dayLabel("2026-11-03")).toBe("Tue 3 Nov");
    expect(whenLabel("2026-11-03T08:30:00.000Z", "Europe/Bucharest")).toBe("Tuesday 3 November, 10:30");
  });

  it("lists every weekday", () => {
    expect(hoursLines(facts.hours)).toHaveLength(7);
  });

  it("joins opening blocks that touch, keeps real breaks", () => {
    const sunday = (opens: string, closes: string) => ({ weekday: 7, opens, closes });
    const lines = hoursLines([sunday("12:00:00", "13:00:00"), sunday("10:00:00", "12:00:00"), sunday("13:00:00", "14:00:00"), sunday("16:00:00", "18:00:00")]);
    expect(lines[6]).toBe("Sunday: 10:00–14:00, 16:00–18:00");
  });

  it("gives the AI the facts, notes and rules", () => {
    const p = systemPrompt(facts);
    expect(p).toContain("Demo Barber");
    expect(p).toContain("Men’s haircut, 30 min, 60 lei (id: s-cut)");
    expect(p).toContain("Q: Is there parking nearby?");
    expect(p).toContain("Today is Mon 2 Nov (2026-11-02)");
    expect(p).toContain("must not ask for their name");
  });
});
