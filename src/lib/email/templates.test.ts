import { describe, expect, it } from "vitest";
import { buildIcs } from "../ics";
import { isTestAddress, maskAddress } from "./addresses";
import { cancelledEmail, confirmationEmail, ownerNoteEmail, reminderEmail, serviceLine, type BookingInfo } from "./templates";

const booking: BookingInfo = {
  bookingId: "b1",
  customerName: "Ana Popescu",
  serviceName: "Haircut",
  durationMinutes: 30,
  priceCents: 2500,
  currency: "EUR",
  staffName: "Maria",
  startsAt: "2026-11-10T08:00:00Z", // 10:00 in Bucharest
  timezone: "Europe/Bucharest",
  shopName: "Frizeria Ștefan & Fiii",
  shopAddress: "Strada Exemplu 1",
  shopPhone: "+40 700 000 000",
  manageUrl: "https://bookbell.vercel.app/b/abc",
};

describe("test addresses", () => {
  it("never get real emails", () => {
    for (const email of ["ana@example.com", "x@randul-test.dev", "a@shop.test", "a@sub.example.org", "nobody"]) {
      expect(isTestAddress(email), email).toBe(true);
    }
  });
  it("real addresses do", () => {
    for (const email of ["ana@gmail.com", "x@yahoo.com", "owner@frizeria.ro", "a@examples.com"]) {
      expect(isTestAddress(email), email).toBe(false);
    }
  });
  it("are hidden in logs", () => {
    expect(maskAddress("maria.popescu@gmail.com")).toBe("m***@gmail.com");
  });
});

describe("booking emails", () => {
  it("say what, when, who and where, in the shop's time", () => {
    const mail = confirmationEmail(booking);
    expect(mail.subject).toBe("Booked: Haircut at Frizeria Ștefan & Fiii, Tuesday 10 November, 10:00");
    expect(mail.text).toContain("What: Haircut, 30 min, €25, with Maria");
    expect(mail.text).toContain("Need to change or cancel? https://bookbell.vercel.app/b/abc");
    expect(mail.html).toContain('href="https://bookbell.vercel.app/b/abc"');
  });

  it("leave out the worker when the shop has only one", () => {
    expect(serviceLine({ ...booking, staffName: null })).toBe("Haircut, 30 min, €25");
  });

  it("make typed-in names safe in the HTML", () => {
    const mail = reminderEmail({ ...booking, customerName: '<img src=x onerror="alert(1)">' });
    expect(mail.html).not.toContain("<img");
    expect(mail.html).toContain("&lt;img");
    expect(mail.html).toContain("Frizeria Ștefan &amp; Fiii");
  });

  it("say who cancelled, and offer to book again", () => {
    const byShop = cancelledEmail({ ...booking, manageUrl: undefined }, "shop", "https://x/s/shop");
    expect(byShop.text).toContain("had to cancel");
    expect(byShop.text).toContain("Book another time: https://x/s/shop");
    expect(byShop.text).not.toContain("/b/");
    expect(cancelledEmail(booking, "customer", "https://x/s/shop").text).toContain("your booking at Frizeria Ștefan & Fiii is cancelled");
  });

  it("give the owner the customer's contact details", () => {
    const note = ownerNoteEmail(booking, "new", { email: "ana@gmail.com", phone: "+40 711" }, "https://x/dashboard/bookings");
    expect(note.subject).toBe("New booking: Ana Popescu, Tuesday 10 November, 10:00");
    expect(note.text).toContain("Customer: ana@gmail.com, +40 711");
  });
});

describe("calendar file", () => {
  it("uses the booking id, so a moved booking updates the same calendar entry", () => {
    const ics = buildIcs({ start: booking.startsAt, minutes: 30, title: "Haircut", location: "Strada 1, Cluj; et 2", shopName: "Shop", uid: "b1" });
    expect(ics).toContain("UID:b1@bookbell");
    expect(ics).toContain("DTSTART:20261110T080000Z");
    expect(ics).toContain("DTEND:20261110T083000Z");
    expect(ics).toContain("LOCATION:Strada 1\\, Cluj\\; et 2");
  });
});
