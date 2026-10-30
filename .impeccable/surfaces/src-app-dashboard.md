---
version: 1
slug: "src-app-dashboard"
primary_target: "src/app/dashboard"
related_targets: ["src/app/(auth)","src/components"]
---

# Owner dashboard and account screens

Scope: `src/app/dashboard/*`, `src/app/(auth)/*`, shared `src/components/*`. Mode: Operate. The home page `src/app/page.tsx` is a holding page until the phase 5 landing page, which gets its own brief.

Audience and job: small-shop owners, often on a phone between customers, setting up services, hours, days off and AI notes in short bursts. Success: setup in minutes, each screen shows the one next step, nothing unclear.

Constraints: keep all form field names and server actions; English UI; prices in EUR or RON per shop.

## Direction contract

THESIS: The category standard, played straight: a calm booking-app admin at the finish level of Booksy and the Stripe Dashboard. It refuses quirk, costume and decoration; clarity, precise spacing and complete states are the whole identity.

OWN-WORLD: Cool light-grey app ground, white surfaces with 1px grey borders and one soft shadow level, ink near #111827, a single violet brand accent (#6d28d9 family) only for primary actions, current navigation and focus. Inter at a tight product scale with tabular numerals for prices, minutes and times. Rounded 12px surfaces, 8px controls, pill tabs. Lucide icons in one stroke weight. Semantic state colours (success green, danger red, amber notice) only where they carry meaning.

STORY: The owner sees where they are, what their shop already has, and the next step to finish setup; they add or change one thing and see it confirmed in place.

FIRST VIEWPORT: Phone: white top bar with the Bookbell wordmark left and an avatar menu right (log out inside), a row of pill tabs (Shop, Services, Hours, AI notes) with the current one filled violet; page title and one-line description; content as white rounded cards in a single column; the primary action as a full-width violet button. Desktop: a left sidebar replaces the tabs, content in a centred column up to 768px.

FORM: canon (the category standard), chosen by the user; quality bar Booksy and Stripe Dashboard. seed:18388ab13c1da546

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
