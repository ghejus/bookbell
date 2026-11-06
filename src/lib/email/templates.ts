// What each Bookbell email says, as plain text plus simple HTML.
// No database or server code here, so the wording is easy to test.

import { whenLabel } from "../assistant/facts";
import { formatDuration, formatPrice, type Currency } from "../format";

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
};

export type Email = { subject: string; text: string; html: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "Haircut, 30 min, €25, with Maria" */
export function serviceLine(b: BookingInfo): string {
  const price = formatPrice(b.priceCents, b.currency);
  return [b.serviceName, formatDuration(b.durationMinutes), price, b.staffName ? `with ${b.staffName}` : ""]
    .filter(Boolean)
    .join(", ")
    .replaceAll(" ", " ");
}

const when = (b: BookingInfo) => whenLabel(b.startsAt, b.timezone);

/** The details block every customer email shares. */
function details(b: BookingInfo) {
  const rows: [string, string][] = [
    ["When", when(b)],
    ["What", serviceLine(b)],
    ["Where", [b.shopName, b.shopAddress].filter(Boolean).join(", ")],
  ];
  if (b.shopPhone) rows.push(["Phone", b.shopPhone]);
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
function layout({ heading, intro, body, button, footer }: { heading: string; intro: string; body: string; button?: { label: string; url: string }; footer?: string }) {
  const action = button
    ? `<p style="margin:24px 0 8px"><a href="${esc(button.url)}" style="display:inline-block;background:#7c3aed;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${esc(button.label)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="en"><body style="margin:0;background:#f3f4f6;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#111827">
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

const manageText = (b: BookingInfo) => (b.manageUrl ? `\nNeed to change or cancel? ${b.manageUrl}\n` : "");
const manageButton = (b: BookingInfo) => (b.manageUrl ? { label: "Change or cancel", url: b.manageUrl } : undefined);
const sentFor = (b: BookingInfo) => `Sent by Bookbell for ${b.shopName}. Reply to this email to reach the shop.`;

export function confirmationEmail(b: BookingInfo): Email {
  const d = details(b);
  const intro = `Hi ${b.customerName}, you’re booked at ${b.shopName}. See you then!`;
  return {
    subject: `Booked: ${b.serviceName} at ${b.shopName}, ${when(b)}`,
    text: `${intro}\n\n${d.text}\n${manageText(b)}\nThe calendar file attached adds it to your phone’s calendar.\n`,
    html: layout({ heading: "You’re booked", intro, body: d.html, button: manageButton(b), footer: `The calendar file attached adds it to your phone’s calendar. ${sentFor(b)}` }),
  };
}

export function reminderEmail(b: BookingInfo): Email {
  const d = details(b);
  const intro = `Hi ${b.customerName}, a reminder of your booking at ${b.shopName}.`;
  return {
    subject: `Reminder: ${b.serviceName} at ${b.shopName}, ${when(b)}`,
    text: `${intro}\n\n${d.text}\n${manageText(b)}\nIf you can’t make it, please cancel so someone else can have the time.\n`,
    html: layout({
      heading: "See you soon",
      intro,
      body: d.html,
      button: manageButton(b),
      footer: `If you can’t make it, please cancel so someone else can have the time. ${sentFor(b)}`,
    }),
  };
}

export function movedEmail(b: BookingInfo): Email {
  const d = details(b);
  const intro = `Hi ${b.customerName}, your booking at ${b.shopName} has a new time.`;
  return {
    subject: `New time: ${b.serviceName} at ${b.shopName}, ${when(b)}`,
    text: `${intro}\n\n${d.text}\n${manageText(b)}`,
    html: layout({ heading: "Your booking moved", intro, body: d.html, button: manageButton(b), footer: sentFor(b) }),
  };
}

/** `by`: who cancelled. The customer did it themselves, or the shop did. */
export function cancelledEmail(b: BookingInfo, by: "customer" | "shop", bookAgainUrl: string): Email {
  const d = details(b);
  const intro =
    by === "shop"
      ? `Hi ${b.customerName}, sorry: ${b.shopName} had to cancel your booking.`
      : `Hi ${b.customerName}, your booking at ${b.shopName} is cancelled.`;
  return {
    subject: `Cancelled: ${b.serviceName} at ${b.shopName}, ${when(b)}`,
    text: `${intro}\n\n${d.text}\n\nBook another time: ${bookAgainUrl}\n`,
    html: layout({ heading: "Booking cancelled", intro, body: d.html, button: { label: "Book another time", url: bookAgainUrl }, footer: sentFor(b) }),
  };
}

/** A note to the shop owner. `what`: a new booking, or a customer cancelled or moved one. */
export function ownerNoteEmail(
  b: BookingInfo,
  what: "new" | "cancelled" | "moved",
  customer: { email: string; phone: string },
  dashboardUrl: string,
): Email {
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
  const intro = `Hi ${b.customerName}, thanks for visiting ${b.shopName}. How was your ${b.serviceName}?`;
  const ask = "It takes ten seconds: tap a star, add a few words if you like. It helps the shop and other customers.";
  const url = b.manageUrl ?? "";
  return {
    subject: `How was your visit to ${b.shopName}?`,
    text: `${intro}\n\n${ask}\n\nLeave a review: ${url}\n`,
    html: layout({
      heading: "How was it?",
      intro,
      body: `<p style="margin:16px 0 0;color:#4b5563">${esc(ask)}</p>`,
      button: url ? { label: "Leave a review", url } : undefined,
      footer: sentFor(b),
    }),
  };
}

/** A time opened on a day someone is waiting for. */
export function spotOpenEmail(w: { name: string; shopName: string; serviceName: string; dayLabel: string; times: string[]; bookUrl: string }): Email {
  const times = w.times.slice(0, 6).join(", ") + (w.times.length > 6 ? " …" : "");
  const intro = `${w.name ? `Hi ${w.name}, good news` : "Good news"}: a time opened at ${w.shopName} on ${w.dayLabel}.`;
  const what = `${w.serviceName}: ${times}`;
  const note = "First come, first served: someone else may book it before you.";
  return {
    subject: `A time opened at ${w.shopName}, ${w.dayLabel}`,
    text: `${intro}\n\n${what}\n\nBook it: ${w.bookUrl}\n\n${note}\n`,
    html: layout({
      heading: "A time opened",
      intro,
      body: `<p style="margin:16px 0 0;font-weight:600">${esc(what)}</p><p style="margin:8px 0 0;color:#4b5563">${esc(note)}</p>`,
      button: { label: "Book it", url: w.bookUrl },
      footer: `You asked Bookbell to tell you about free times at ${w.shopName}.`,
    }),
  };
}
