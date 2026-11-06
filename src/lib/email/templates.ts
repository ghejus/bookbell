// What each Bookbell email says, as plain text plus simple HTML.
// No database or server code here, so the wording is easy to test.
// Customer emails come in the customer's language (English or Romanian);
// notes to the shop owner are in English for now.

import { whenLabel } from "../assistant/facts";
import { formatDuration, formatPrice, type Currency } from "../format";
import type { Lang } from "../i18n/config";

export type BookingInfo = {
  bookingId: string;
  customerName: string;
  serviceName: string;
  durationMinutes: number;
  priceCents: number | null;
  currency: Currency;
  /** Only shown when the shop has more than one person. */
  staffName: string | null;
  startsAt: string;
  timezone: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  /** The customer's private "change or cancel" page. */
  manageUrl?: string;
  /** The customer's language (English when not set). */
  lang?: Lang;
};

export type Email = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Every sentence in the customer emails, in each language. */
const WORDS = {
  en: {
    with: (name: string) => `with ${name}`,
    when: "When",
    what: "What",
    where: "Where",
    phone: "Phone",
    needChange: (url: string) => `Need to change or cancel? ${url}`,
    changeOrCancel: "Change or cancel",
    sentFor: (shop: string) => `Sent by Bookbell for ${shop}. Reply to this email to reach the shop.`,
    calendarNote: "The calendar file attached adds it to your phone’s calendar.",
    booked: {
      intro: (name: string, shop: string) => `Hi ${name}, you’re booked at ${shop}. See you then!`,
      subject: (service: string, shop: string, when: string) => `Booked: ${service} at ${shop}, ${when}`,
      heading: "You’re booked",
    },
    reminder: {
      intro: (name: string, shop: string) => `Hi ${name}, a reminder of your booking at ${shop}.`,
      subject: (service: string, shop: string, when: string) => `Reminder: ${service} at ${shop}, ${when}`,
      heading: "See you soon",
      note: "If you can’t make it, please cancel so someone else can have the time.",
    },
    moved: {
      intro: (name: string, shop: string) => `Hi ${name}, your booking at ${shop} has a new time.`,
      subject: (service: string, shop: string, when: string) => `New time: ${service} at ${shop}, ${when}`,
      heading: "Your booking moved",
    },
    cancelled: {
      byShop: (name: string, shop: string) => `Hi ${name}, sorry: ${shop} had to cancel your booking.`,
      byCustomer: (name: string, shop: string) => `Hi ${name}, your booking at ${shop} is cancelled.`,
      subject: (service: string, shop: string, when: string) => `Cancelled: ${service} at ${shop}, ${when}`,
      heading: "Booking cancelled",
      again: "Book another time",
      againText: (url: string) => `Book another time: ${url}`,
    },
    review: {
      intro: (name: string, shop: string, service: string) => `Hi ${name}, thanks for visiting ${shop}. How was your ${service}?`,
      ask: "It takes ten seconds: tap a star, add a few words if you like. It helps the shop and other customers.",
      subject: (shop: string) => `How was your visit to ${shop}?`,
      heading: "How was it?",
      button: "Leave a review",
      text: (url: string) => `Leave a review: ${url}`,
    },
    spot: {
      intro: (name: string, shop: string, day: string) => `${name ? `Hi ${name}, good news` : "Good news"}: a time opened at ${shop} on ${day}.`,
      note: "First come, first served: someone else may book it before you.",
      subject: (shop: string, day: string) => `A time opened at ${shop}, ${day}`,
      heading: "A time opened",
      button: "Book it",
      text: (url: string) => `Book it: ${url}`,
      footer: (shop: string) => `You asked Bookbell to tell you about free times at ${shop}.`,
    },
  },
  ro: {
    with: (name: string) => `cu ${name}`,
    when: "Când",
    what: "Ce",
    where: "Unde",
    phone: "Telefon",
    needChange: (url: string) => `Trebuie s-o schimbi sau s-o anulezi? ${url}`,
    changeOrCancel: "Schimbă sau anulează",
    sentFor: (shop: string) => `Trimis de Bookbell pentru ${shop}. Răspunde la acest email ca să scrii salonului.`,
    calendarNote: "Fișierul de calendar atașat o adaugă în calendarul telefonului.",
    booked: {
      intro: (name: string, shop: string) => `Salut, ${name}! Te-ai programat la ${shop}. Ne vedem atunci!`,
      subject: (service: string, shop: string, when: string) => `Programare: ${service} la ${shop}, ${when}`,
      heading: "Programarea e făcută",
    },
    reminder: {
      intro: (name: string, shop: string) => `Salut, ${name}! Îți amintim de programarea la ${shop}.`,
      subject: (service: string, shop: string, when: string) => `Reamintire: ${service} la ${shop}, ${when}`,
      heading: "Ne vedem curând",
      note: "Dacă nu poți ajunge, te rugăm s-o anulezi, ca altcineva să poată lua ora.",
    },
    moved: {
      intro: (name: string, shop: string) => `Salut, ${name}! Programarea ta la ${shop} are o oră nouă.`,
      subject: (service: string, shop: string, when: string) => `Oră nouă: ${service} la ${shop}, ${when}`,
      heading: "Programarea s-a mutat",
    },
    cancelled: {
      byShop: (name: string, shop: string) => `Salut, ${name}! Ne pare rău: ${shop} a trebuit să-ți anuleze programarea.`,
      byCustomer: (name: string, shop: string) => `Salut, ${name}! Programarea ta la ${shop} e anulată.`,
      subject: (service: string, shop: string, when: string) => `Anulată: ${service} la ${shop}, ${when}`,
      heading: "Programare anulată",
      again: "Fă o altă programare",
      againText: (url: string) => `Fă o altă programare: ${url}`,
    },
    review: {
      intro: (name: string, shop: string, service: string) => `Salut, ${name}! Mulțumim că ai trecut pe la ${shop}. Cum a fost ${service}?`,
      ask: "Durează zece secunde: apasă pe o stea și adaugă câteva cuvinte, dacă vrei. Ajută salonul și ceilalți clienți.",
      subject: (shop: string) => `Cum a fost la ${shop}?`,
      heading: "Cum a fost?",
      button: "Lasă o recenzie",
      text: (url: string) => `Lasă o recenzie: ${url}`,
    },
    spot: {
      intro: (name: string, shop: string, day: string) => `${name ? `Salut, ${name}! Vești bune` : "Vești bune"}: s-a eliberat o oră la ${shop}, ${day}.`,
      note: "Primul venit, primul servit: altcineva o poate lua înaintea ta.",
      subject: (shop: string, day: string) => `S-a eliberat o oră la ${shop}, ${day}`,
      heading: "S-a eliberat o oră",
      button: "Programează",
      text: (url: string) => `Programează: ${url}`,
      footer: (shop: string) => `Ai cerut Bookbell să te anunțe despre ore libere la ${shop}.`,
    },
  },
};

const wordsFor = (b: { lang?: Lang }) => WORDS[b.lang ?? "en"];

/** "Haircut, 30 min, €25, with Maria" (Romanian: "Tuns, 30 min, 25 lei, cu Maria") */
export function serviceLine(b: BookingInfo, lang: Lang = b.lang ?? "en"): string {
  const price = formatPrice(b.priceCents, b.currency, lang);
  return [b.serviceName, formatDuration(b.durationMinutes), price, b.staffName ? WORDS[lang].with(b.staffName) : ""]
    .filter(Boolean)
    .join(", ")
    .replaceAll(String.fromCharCode(160), " ");
}

const when = (b: BookingInfo) => whenLabel(b.startsAt, b.timezone, b.lang ?? "en");

/** The details block every customer email shares. */
function details(b: BookingInfo) {
  const w = wordsFor(b);
  const rows: [string, string][] = [
    [w.when, when(b)],
    [w.what, serviceLine(b)],
    [w.where, [b.shopName, b.shopAddress].filter(Boolean).join(", ")],
  ];
  if (b.shopPhone) rows.push([w.phone, b.shopPhone]);
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#4b5563;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:4px 0;color:#111827;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join("");
  return { text, html: `<table role="presentation" style="border-collapse:collapse;margin:16px 0">${html}</table>` };
}

/** The shared frame: a white card on a light grey ground, like the app. */
function layout({
  heading,
  intro,
  body,
  button,
  footer,
  lang = "en",
}: {
  heading: string;
  intro: string;
  body: string;
  button?: { label: string; url: string };
  footer?: string;
  lang?: Lang;
}) {
  const action = button
    ? `<p style="margin:24px 0 8px"><a href="${esc(button.url)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(button.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="${lang}"><body style="margin:0;background:#f3f4f6;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<p style="margin:0 0 16px;font-weight:600;color:#6d28d9">Bookbell</p>
<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;padding:24px">
<h1 style="margin:0 0 8px;font-size:20px">${esc(heading)}</h1>
<p style="margin:0">${esc(intro)}</p>
${body}${action}
</div>
${footer ? `<p style="margin:16px 4px 0;font-size:13px;color:#4b5563">${esc(footer)}</p>` : ""}
</div></body></html>`;
}

const manageText = (b: BookingInfo) => (b.manageUrl ? `\n${wordsFor(b).needChange(b.manageUrl)}\n` : "");
const manageButton = (b: BookingInfo) => (b.manageUrl ? { label: wordsFor(b).changeOrCancel, url: b.manageUrl } : undefined);
const sentFor = (b: BookingInfo) => wordsFor(b).sentFor(b.shopName);

export function confirmationEmail(b: BookingInfo): Email {
  const w = wordsFor(b);
  const d = details(b);
  const intro = w.booked.intro(b.customerName, b.shopName);
  return {
    subject: w.booked.subject(b.serviceName, b.shopName, when(b)),
    text: `${intro}\n\n${d.text}\n${manageText(b)}\n${w.calendarNote}\n`,
    html: layout({ heading: w.booked.heading, intro, body: d.html, button: manageButton(b), footer: `${w.calendarNote} ${sentFor(b)}`, lang: b.lang }),
  };
}

export function reminderEmail(b: BookingInfo): Email {
  const w = wordsFor(b);
  const d = details(b);
  const intro = w.reminder.intro(b.customerName, b.shopName);
  return {
    subject: w.reminder.subject(b.serviceName, b.shopName, when(b)),
    text: `${intro}\n\n${d.text}\n${manageText(b)}\n${w.reminder.note}\n`,
    html: layout({
      heading: w.reminder.heading,
      intro,
      body: d.html,
      button: manageButton(b),
      footer: `${w.reminder.note} ${sentFor(b)}`,
      lang: b.lang,
    }),
  };
}

export function movedEmail(b: BookingInfo): Email {
  const w = wordsFor(b);
  const d = details(b);
  const intro = w.moved.intro(b.customerName, b.shopName);
  return {
    subject: w.moved.subject(b.serviceName, b.shopName, when(b)),
    text: `${intro}\n\n${d.text}\n${manageText(b)}`,
    html: layout({ heading: w.moved.heading, intro, body: d.html, button: manageButton(b), footer: sentFor(b), lang: b.lang }),
  };
}

/** `by`: who cancelled. The customer did it themselves, or the shop did. */
export function cancelledEmail(b: BookingInfo, by: "customer" | "shop", bookAgainUrl: string): Email {
  const w = wordsFor(b);
  const d = details(b);
  const intro = by === "shop" ? w.cancelled.byShop(b.customerName, b.shopName) : w.cancelled.byCustomer(b.customerName, b.shopName);
  return {
    subject: w.cancelled.subject(b.serviceName, b.shopName, when(b)),
    text: `${intro}\n\n${d.text}\n\n${w.cancelled.againText(bookAgainUrl)}\n`,
    html: layout({
      heading: w.cancelled.heading,
      intro,
      body: d.html,
      button: { label: w.cancelled.again, url: bookAgainUrl },
      footer: sentFor(b),
      lang: b.lang,
    }),
  };
}

/** A note to the shop owner (in English). `what`: a new booking, or a customer cancelled or moved one. */
export function ownerNoteEmail(
  booking: BookingInfo,
  what: "new" | "cancelled" | "moved",
  customer: { email: string; phone: string },
  dashboardUrl: string,
): Email {
  const b = { ...booking, lang: "en" as const };
  const d = details(b);
  const headline = { new: "New booking", cancelled: "Booking cancelled", moved: "Booking moved" }[what];
  const intro = {
    new: `${b.customerName} booked online.`,
    cancelled: `${b.customerName} cancelled their booking. The time is free again.`,
    moved: `${b.customerName} moved their booking to a new time.`,
  }[what];
  const contact = [customer.email, customer.phone].filter(Boolean).join(", ");
  return {
    subject: `${headline}: ${b.customerName}, ${when(b)}`,
    text: `${intro}\n\n${d.text}\nCustomer: ${contact}\n\nYour bookings: ${dashboardUrl}\n`,
    html: layout({
      heading: headline,
      intro,
      body: d.html + `<p style="margin:0;color:#4b5563">Customer: ${esc(contact)}</p>`,
      button: { label: "Open my bookings", url: dashboardUrl },
      footer: "You get these notes because you own this shop on Bookbell.",
    }),
  };
}

/** The day after a visit: "How was it?", with a link to leave a review. */
export function reviewAskEmail(b: BookingInfo): Email {
  const w = wordsFor(b);
  const intro = w.review.intro(b.customerName, b.shopName, b.serviceName);
  const url = b.manageUrl ?? "";
  return {
    subject: w.review.subject(b.shopName),
    text: `${intro}\n\n${w.review.ask}\n\n${w.review.text(url)}\n`,
    html: layout({
      heading: w.review.heading,
      intro,
      body: `<p style="margin:16px 0 0;color:#4b5563">${esc(w.review.ask)}</p>`,
      button: url ? { label: w.review.button, url } : undefined,
      footer: sentFor(b),
      lang: b.lang,
    }),
  };
}

/** A time opened on a day someone is waiting for. */
export function spotOpenEmail(s: {
  name: string;
  shopName: string;
  serviceName: string;
  dayLabel: string;
  times: string[];
  bookUrl: string;
  lang?: Lang;
}): Email {
  const w = wordsFor(s).spot;
  const times = s.times.slice(0, 6).join(", ") + (s.times.length > 6 ? " …" : "");
  const intro = w.intro(s.name, s.shopName, s.dayLabel);
  const what = `${s.serviceName}: ${times}`;
  return {
    subject: w.subject(s.shopName, s.dayLabel),
    text: `${intro}\n\n${what}\n\n${w.text(s.bookUrl)}\n\n${w.note}\n`,
    html: layout({
      heading: w.heading,
      intro,
      body: `<p style="margin:16px 0 0;font-weight:600">${esc(what)}</p><p style="margin:8px 0 0;color:#4b5563">${esc(w.note)}</p>`,
      button: { label: w.button, url: s.bookUrl },
      footer: w.footer(s.shopName),
      lang: s.lang,
    }),
  };
}
