# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Shop owners** of small, appointment-based local businesses (any kind: barbers, salons, nail studios, dentists, tutors, repair shops). Often not technical. Often setting things up on a phone between customers. Their job: describe the shop once (services, hours, days off, common answers) and then get bookings without answering the phone.
- **Customers** of those shops (phase 3 and later). They arrive from a link the shop shared, usually on a phone, want to know "can I get in, when, and how much", and book without creating an account. Since 2026-11-05 they can also make a customer account, so all their bookings show up in "My bookings" (booking without one still works).
- **Portfolio reviewers** (recruiters, hiring managers, developers) who open the project from the creator's portfolio to judge whether the creator can build real software.

## Product Purpose

Bookbell lets a small shop take bookings online, with an AI helper on the shop's page that answers customer questions from the owner's own notes and can book a free time. Success: an owner finishes setup in a few minutes, and a customer can book, or get an answer, without calling.

## Positioning

The AI helper only knows what the owner wrote (shop details, services, hours, and question-and-answer notes) and books through the same checks as the booking form, so it cannot promise a time that is taken or invent a policy. The database itself refuses double bookings.

## Operating Context

- Owners use the dashboard in short bursts, often on a phone, sometimes with a customer in the chair.
- Customers come from a shared link (messaging apps, social profiles, a sign on the door) and decide quickly.
- Times are always in the shop's own time zone.

## Capabilities and Constraints

- Built: owner accounts (email and password), one shop per owner, services with length and optional price, weekly opening hours with split days, days off with a private reason, public question-and-answer notes for the AI.
- Built: public booking page at `/s/<shop-address>` (pick service, day, free time; name and email, no account), and an owner Bookings list with cancel. Rules per shop: book up to 60 days ahead, at least 2 hours notice, a time every 15 minutes, at most 3 upcoming bookings per email. The database checks every rule.
- Built: a chat helper on every shop page ("Ask a question"). It answers from the shop details and the owner's notes, shows free times as buttons, and opens a booking form; the customer always taps Book themselves. With no AI key it runs in practice mode (simple word matching, labelled "Practice mode"); with a Claude key it uses the real AI. Limits: 20 messages per visitor per hour, 300 per shop per day.
- Planned: confirmation and reminder emails and staff calendars (later). Until emails exist, owners tell customers themselves about cancellations.
- Free to use. No payments for now.
- Interface language: English.
- Languages: English and Romanian (informal "tu"). Visitors pick with the EN · RO switch (account panel, page footers, log-in pages); the first visit follows the phone's language. Addresses don't change (the proxy serves a hidden /en or /ro version), so printed QR codes keep working. Bookings and waitlist wishes remember the language for emails. The owner dashboard is still English (next step); shop content (service names, notes, reviews) stays as the owner or customer wrote it.
- Waitlist: on a full day (open, but every time taken) a signed-in customer (not a demo account) can join that day's waitlist for a service, with one worker or anyone, up to 5 days at once. Nothing runs in the background: My bookings checks the free times when opened and shows "A time opened" with a Book it button; the owner's Waitlist page lists who waits, with phone and email. Booking at that shop on that day removes the wish. When emails are on, a cancel or move also emails the people waiting for that day, once each.
- Reviews: only people who booked online and came (not cancelled, not "didn't come") can leave stars and a few words, up to 60 days after the visit, and change them for 14 days. Owners can reply once (and edit it) but can't delete or hide a review; marking a visit "didn't come" hides its review. Owner-added walk-ins can't be reviewed, so owners can't review their own shop.
- Prices: each shop chooses euro (EUR) or Romanian lei (RON).
- Stack: Next.js 16 (App Router, Cache Components), Supabase (Postgres, Auth, row level security), Tailwind 4, hosting planned on Vercel.

## Brand Commitments

- Name: **Bookbell**, like the little bell on a shop door that rings when a customer walks in; here it rings for a new booking. Chosen by the user on 2026-10-30 (the earlier working name was Bookbell, which still appears in old database files and test email addresses). Written "bookbell" in code and URLs.
- Visual stance (updated by the user on 2026-11-05): a dark phone app, design system **Nocturne**, from the user's own Claude Design file (`design/mobile-app/`). It is used everywhere, phones and computers, and opens from the home screen like a real app (no app stores). The finish of **Booksy** and the **Stripe Dashboard** is still the quality bar. Before this, Bookbell had a light look (2026-10-29).

## Evidence on Hand

- No real shops, customers, testimonials, or usage numbers exist yet. Do not invent them. Demo content must be labeled as demo.

## Product Principles

- Setup in minutes: every screen has one clear next step, and an empty screen says what to add.
- The owner's words, not the AI's: the helper repeats what the owner wrote and says so when it doesn't know.
- Trust by construction: no double bookings, no shop can see another shop's data, private notes stay private.
- Phone first for both owners and customers.

## Accessibility & Inclusion

- Owners may not be technical: plain language, no jargon, errors that say how to fix the problem.
- Usable one-handed on a phone; keyboard and screen-reader friendly forms.
