---
version: 1
slug: "src-app-s-slug"
primary_target: "src/app/s/[slug]"
related_targets: ["src/app/dashboard/bookings"]
---

# Public booking page and owner bookings list

Scope: `src/app/s/[slug]/*` (customer booking page) and `src/app/dashboard/bookings/page.tsx` (owner list). Mode: Operate (customers and owners each complete one task). This is an extension inside the established Rândul world in DESIGN.md: no new visual world, no concept round.

Audience and job:
- Customers arrive from a link the shop shared, usually on a phone, not logged in. Job: pick a service, a day and a free time, leave a name and email, and get a clear confirmation. Success: booked in under a minute, or told plainly why a time can't be booked.
- Owners open Bookings to see what's coming, contact a customer, or cancel.

Flow (pinned by the project plan): 1. service, 2. day (two weeks at a time, closed days shown but not clickable), 3. time plus details on one card, then an in-place confirmation. Times are always the shop's time zone, stated once.

Constraints: no customer account; the database re-checks every rule; taken times never reveal who booked; a hidden honeypot field stops simple bots; owners cancel with the two-tap pattern. Prices in the shop's currency.

Inherits from DESIGN.md: grey ground, white cards, violet only for the primary action, the selected service, selected day, selected time and links; green for the booked confirmation; tabular numerals for times, dates and prices; no boxes inside boxes.

Unresolved: customer emails (confirmation, reminders, cancel link) are a later phase, so owners are told to contact customers themselves when cancelling.
