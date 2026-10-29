# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Shop owners** of small, appointment-based local businesses (any kind: barbers, salons, nail studios, dentists, tutors, repair shops). Often not technical. Often setting things up on a phone between customers. Their job: describe the shop once (services, hours, days off, common answers) and then get bookings without answering the phone.
- **Customers** of those shops (phase 3 and later). They arrive from a link the shop shared, usually on a phone, want to know "can I get in, when, and how much", and book without creating an account.
- **Portfolio reviewers** (recruiters, hiring managers, developers) who open the project from the creator's portfolio to judge whether the creator can build real software.

## Product Purpose

Rândul lets a small shop take bookings online, with an AI helper on the shop's page that answers customer questions from the owner's own notes and can book a free time. Success: an owner finishes setup in a few minutes, and a customer can book, or get an answer, without calling.

## Positioning

The AI helper only knows what the owner wrote (shop details, services, hours, and question-and-answer notes) and books through the same checks as the booking form, so it cannot promise a time that is taken or invent a policy. The database itself refuses double bookings.

## Operating Context

- Owners use the dashboard in short bursts, often on a phone, sometimes with a customer in the chair.
- Customers come from a shared link (messaging apps, social profiles, a sign on the door) and decide quickly.
- Times are always in the shop's own time zone.

## Capabilities and Constraints

- Built: owner accounts (email and password), one shop per owner, services with length and optional price, weekly opening hours with split days, days off with a private reason, public question-and-answer notes for the AI.
- Built: public booking page at `/s/<shop-address>` (pick service, day, free time; name and email, no account), and an owner Bookings list with cancel. Rules per shop: book up to 60 days ahead, at least 2 hours notice, a time every 15 minutes, at most 3 upcoming bookings per email. The database checks every rule.
- Planned: AI chat helper (phase 4), confirmation and reminder emails and staff calendars (later). Until emails exist, owners tell customers themselves about cancellations.
- Free to use. No payments for now.
- Interface language: English.
- Prices: each shop chooses euro (EUR) or Romanian lei (RON).
- Stack: Next.js 16 (App Router, Cache Components), Supabase (Postgres, Auth, row level security), Tailwind 4, hosting planned on Vercel.

## Brand Commitments

- Name: **Rândul** (from the Romanian "e rândul tău", "it's your turn"). Written "randul" in code and URLs. The name is a working choice and may change.
- Visual stance (chosen by the user on 2026-10-29): the familiar booking-app look, played straight and at full craft. It should sit alongside **Booksy** and the **Stripe Dashboard**; their finish is the quality bar.

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
