---
name: Rândul
description: A calm booking-app admin for small shops, played straight at Booksy and Stripe Dashboard finish.
colors:
  brand-50: "#f5f3ff"
  brand-100: "#ede9fe"
  brand-200: "#ddd6fe"
  brand-600: "#7c3aed"
  brand-700: "#6d28d9"
  brand-800: "#5b21b6"
  ground: "#f3f4f6"
  surface: "#ffffff"
  surface-sunken: "#f9fafb"
  hairline: "#f3f4f6"
  border: "#e5e7eb"
  border-control: "#d1d5db"
  border-control-hover: "#9ca3af"
  ink: "#111827"
  ink-soft: "#374151"
  ink-muted: "#4b5563"
  icon-muted: "#6b7280"
  success: "#16a34a"
  success-bg: "#f0fdf4"
  success-ring: "#bbf7d0"
  success-ink: "#166534"
  danger: "#dc2626"
  danger-deep: "#b91c1c"
  danger-bg: "#fef2f2"
  danger-ring: "#fecaca"
  danger-ink: "#991b1b"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    fontFeature: "\"cv11\", \"ss01\""
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
  wordmark:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
rounded:
  control: "8px"
  surface: "12px"
  pill: "9999px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "20px"
  lg: "24px"
  page-x: "16px"
  page-x-sm: "24px"
  content-max: "768px"
  content-max-public: "672px"
  sidebar: "240px"
components:
  button-primary:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.surface}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-800}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-sunken}"
  button-ghost:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.ground}"
  button-delete-confirm:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "20px"
  tab-pill:
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  tab-pill-active:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.surface}"
  sidebar-link-active:
    backgroundColor: "{colors.brand-50}"
    textColor: "{colors.brand-800}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  time-chip:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  service-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "12px 16px"
  service-row-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
  day-cell:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    width: "56px"
    height: "64px"
  day-cell-selected:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.surface}"
  day-cell-unavailable:
    rounded: "{rounded.control}"
    width: "56px"
    height: "64px"
  slot-button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    height: "44px"
  slot-button-selected:
    backgroundColor: "{colors.brand-700}"
    textColor: "{colors.surface}"
  link-field:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  badge:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  avatar:
    backgroundColor: "{colors.brand-100}"
    textColor: "{colors.brand-800}"
    rounded: "{rounded.pill}"
    size: "36px"
---

# Design System: Rândul

## Overview

**Creative North Star: "The Quiet Front Desk"**

Rândul is the category standard, played straight. It looks like the booking admin a shop owner already expects from Booksy or the Stripe Dashboard: a cool light-grey ground, white cards, near-black ink, and one violet accent. There is no costume and no decoration. Clarity, exact spacing and complete states (loading, empty, error, success, busy) are the whole identity.

Density is product-tight and phone-first. One column of white cards sits in a centred column up to 768px; on phones the primary action stretches full width so it can be hit with a thumb between customers. Every message is a short sentence in sentence case with a full stop, and every example is neutral enough to fit any shop.

**Key Characteristics:**
- Grey ground, white bordered cards, one soft shadow level.
- One violet accent, reserved for primary actions, current navigation, the current selection and focus.
- Inter at a small product scale; tabular numerals for every time, price and duration.
- 12px surfaces, 8px controls, full pills for tabs, badges and the avatar.
- Lucide icons at one stroke weight, always paired with a visible word or an accessible label.
- Semantic green and red only where they mean done, saved, error or delete.

## Colors

A cool neutral grey scale carries almost everything; violet appears rarely, and green and red only when they carry meaning.

### Primary
- **Rândul Violet** (brand-700): fill of the primary button, the active pill tab, inline text links and the wordmark. Hover and press deepen to **Deep Violet** (brand-800).
- **Focus Violet** (brand-600): the 2px focus outline (offset 2px) on every focusable element, and the focused input border.
- **Violet Wash** (brand-50 / brand-100 / brand-200): current sidebar link background (brand-50 with brand-800 text), the input focus ring (3px brand-100), text selection, and the account avatar (brand-100, brand-200 on hover).

### Neutral
- **Cool Ground** (ground): the app background behind every card.
- **White Surface** (surface): cards, top bar, sidebar, inputs, menus.
- **Sunken Grey** (surface-sunken): time chips, secondary-button hover, disabled inputs.
- **Hairline** (hairline): dividers between full-bleed rows inside cards.
- **Border Grey** (border): card, top-bar and sidebar outlines.
- **Control Grey** (border-control, darkening to border-control-hover on hover): input and secondary-button strokes, unchecked step circles.
- **Ink** (ink): headings, values, primary text.
- **Soft Ink** (ink-soft): navigation labels and ghost buttons.
- **Muted Ink** (ink-muted): descriptions, hints, secondary lines. The lightest colour allowed for readable text.
- **Icon Grey** (icon-muted): resting icons, the select chevron, placeholder text.

### Semantic
- **Done Green** (success, with success-bg / success-ring / success-ink): completed setup steps, the setup progress bar, and success messages.
- **Delete Red** (danger, danger-deep, with danger-bg / danger-ring / danger-ink): the armed "Delete?" button, hover state of delete icons, and error messages.

### Named Rules
**The One Violet Rule.** Violet marks only what you can act on now or where you are: the primary button, text links, the current tab or sidebar link, the current selection, and focus. On the booking page the current selection is the chosen service row (violet border and ring), the chosen day cell and the chosen slot button (violet fill, white text); everything not chosen stays white. The wordmark and the avatar are the only identity uses. The hours time chip stays grey, done states are green, empty-state discs are grey.

**The Meaning-Only Colour Rule.** Green and red appear only to say done, saved, failed or delete. Never use them for decoration or categories.

## Typography

**Body Font:** Inter (via next/font, with ui-sans-serif, system-ui, sans-serif), with stylistic sets `cv11` and `ss01` on.

**Character:** One neutral grotesque at a tight product scale. Hierarchy comes from weight and size steps, not from a second family.

### Hierarchy
- **Headline** (700, 1.5rem, tight tracking, balanced wrap): the page title, one per screen. Auth cards use the same style at 1.25rem.
- **Title** (600, 1rem): card titles and list item names.
- **Body** (400, 0.875rem): descriptions, hints and messages, in Muted Ink; page descriptions cap at `max-w-prose`.
- **Label** (500, 0.875rem): field labels, nav links, button text (buttons use 600). "(optional)" follows in 400 Muted Ink.
- **Caption** (500, 0.75rem): badges, the weekday name in a day cell, and the Morning / Afternoon / Evening group captions above slot buttons (Muted Ink, sentence case, never uppercase).
- **Step heading** (Title style, numbered "1. Choose a service"): the public booking page's steps; the number is part of the heading text, not a separate label.
- Inputs use 1rem on phones (stops iOS zoom) and 0.875rem from 640px up.

### Named Rules
**The Tabular Numbers Rule.** Every time, price, duration and count is set with tabular numerals (`<time>` or the `.tabular` class) so columns line up. Prices and durations use no-break spaces so "30 min" and "25 RON" never split across lines.

**The Sentence Case Rule.** Titles, buttons and messages are sentence case, and every message ends with a full stop. No uppercase labels, no letter-spaced small caps.

## Layout

Phone first. Below 1024px a sticky white top bar (56px tall) holds the wordmark left and the round avatar menu right, with a horizontally scrolling row of pill tabs beneath it. From 1024px a 240px white sidebar with a right border replaces the top bar: wordmark, icon-and-word nav links, and the email plus Log out at the bottom.

Content lives in one centred column (max 768px) with 16px side padding (24px from 640px) and 24px top padding (40px from 1024px). Cards stack with 24px gaps. Inside a card, padding is 20px (24px from 640px); forms stack fields 20px apart and go two or three columns from 640px. Full-width buttons shrink to fit and align right from 640px. Auth screens use a single 384px column under a larger wordmark.

**The Full-Bleed Rows Rule.** Lists inside a card run edge to edge as rows divided by hairlines, with the card's own padding inside each row. Never nest a bordered box inside a card.

**The Label Column Rule.** Week rows use a fixed 6rem label column; the day name is 36px tall to align with the first chip, and chips wrap within the second column. Bookings rows use a 3rem time column: the time, the name and the cancel button share the top line, and the details run full width beneath the name so the armed button never squeezes them.

The public booking page has no app chrome: one centred column (max 672px, 16px side padding, 24px from 640px; 32px top padding, 48px from 640px), the shop header, the steps stacked 24px apart, and a centred "Booking by Rândul" footer. The day strip scrolls sideways edge to edge on phones and becomes a seven-column grid from 640px. Owner lists that span days are grouped under small 600 day headings, each day with its own card.

## Elevation & Depth

Mostly flat. Depth comes from the grey ground against white surfaces with 1px borders, plus one soft card shadow. Controls carry a barely-there shadow; only floating menus lift further.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px 0 rgb(17 24 39 / 0.05), 0 1px 3px 0 rgb(17 24 39 / 0.06)`): every card.
- **Control** (Tailwind `shadow-sm`): inputs, primary and secondary buttons.
- **Popover** (Tailwind `shadow-lg`): the avatar menu and the skip link, the only things that float.

### Named Rules
**The One Surface Level Rule.** Cards never stack on cards. If something needs to look separate inside a card, use a hairline divider or a grey chip, not another border and shadow.

## Shapes

Three radii: 12px for surfaces (cards, menus, skeleton blocks, selectable service rows), 8px for anything you press or type into (buttons, inputs, chips, day cells, slot buttons, nav links, messages), and full pills for tabs, badges, the avatar, step circles and progress bars. Strokes are 1px grey; badges and messages use an inset 1px ring instead of a border.

## Components

### Buttons
Calm and solid; one primary per form.
- **Shape:** gently rounded (8px); 44px tall at normal size, 36px small.
- **Primary:** violet fill, white 600 text, 16px side padding; full width on phones when it ends a form.
- **Hover / Focus:** colour deepens over 150ms; focus shows the 2px violet outline.
- **Busy:** a spinning loader plus "Saving…", "Adding…" or "Booking…". Small buttons keep their word so the row doesn't jump.
- **Label follows the choice:** a primary that needs a prior pick says what is missing ("Choose a time") and then names the action with the value ("Book 14:30"). Tapping it early shows a "Please choose a time." error rather than staying disabled.
- **Link pending:** a link that loads a new view (service row, day cell, prev/next arrows) shows a small Icon Grey spinner inside itself while the next view loads, motion-safe only.
- **Secondary:** white fill with a grey stroke, for optional helpers like "Fill Mon–Fri, 09:00–17:00".
- **Ghost:** no fill, Soft Ink text, grey wash on hover. Used for worded row actions like Hide and Show, with a longer accessible label.
- **Disabled:** 60% opacity, not-allowed cursor.

### Two-Tap Delete (signature)
A 36px grey trash icon turns red on hover. The first tap swaps it for a red "Delete?" button; a second tap deletes. It resets after 4 seconds, so a stray tap never deletes anything. The same control cancels a booking: an X icon, "Cancel?" when armed and "Cancelling…" while busy.

### Chips
- **Time chip (hours):** Sunken Grey fill, inset grey ring, 8px radius, tabular "09:00–17:00", and a 36px X icon button to remove it. It shows saved opening hours, not a choice, so it is never violet. It is a different component from the slot button below.

### Booking Controls (public booking page)
The customer's three choices. Each is white when open and violet when it is the current selection.
- **Service row:** a white selectable row with 12px radius, Border Grey outline and the Card shadow; name in 600 with the duration below in Muted Ink, price on the right in 600 tabular. Hover darkens the border to Control Grey; selected gets a violet (brand-700) border plus a 1px violet ring. Rows stack 10px apart.
- **Day cell:** 56px × 64px (fills its grid column from 640px), 8px radius; caption weekday over a 1.125rem 600 tabular day number. Open: white with a Control Grey stroke, darkening on hover. Selected: violet fill and border, white text. Unavailable: a dashed Border Grey outline, no fill, dimmed text, and not a link. Prev / next arrows are 36px ghost icon links with an accessible label, beside the month range.
- **Slot button:** a visually hidden radio styled as a 44px white button, 8px radius, Control Grey stroke, control shadow, 500 tabular time; three columns on phones, four from 640px, 8px gaps, grouped under caption headings. Selected: violet fill and border, white text. Focus shows the 2px Focus Violet outline on the visible button.
- **Time zone:** stated once under the day strip as the city name ("Times are Bucharest time."). The month range beside the step heading uses short months ("Oct – Nov 2026") and neither wraps.
- **Shop header:** the about text keeps the owner's line breaks and shows four lines, then a violet "Show more" text button (only when it is really cut off). Address and phone icons sit at the first line of their text and never shrink.

### Chat Helper (public booking page)
- **Launcher:** a 48px violet pill in the bottom-right corner (16px from the edges on phones, 24px from 640px, above the safe area) with a MessageCircle icon and "Ask a question", Popover shadow. It is the one floating thing on the page, so it is the one pill-shaped button. The page footer has extra bottom room so the launcher never covers it.
- **Window:** full screen on phones (white, no radius, the page behind stops scrolling); from 640px a 400px × up to 680px floating surface in the same corner, 12px radius, Border Grey outline, Popover shadow. Header: "Ask <shop>" in Title style, then either a neutral "Practice mode" badge with "Simple answers from the shop’s details." or "An AI helper. It only knows what the shop wrote." in Muted Ink, and a 36px ghost X. Escape closes it and focus returns to the launcher.
- **Messages:** 8px radius, 0.875rem, at most 85% wide, plain text only. The customer's are Ink with white text on the right; the helper's are Ground grey with Ink text on the left. Never violet: violet stays for actions. A "Thinking…" bubble with a spinner shows while waiting.
- **Quick questions:** small secondary buttons ("Prices", "Opening hours", "Next free time") under the welcome message only.
- **Time buttons:** 36px slot buttons, four per row, one row per day under a caption day label ("Sat 31 Oct"); white with Control Grey stroke, violet fill when chosen. A Muted Ink line points to the page's steps for more times.
- **Booking form in chat:** a Sunken Grey block (8px radius, no border) with the service summary in 600 and the time below, then name, email and phone fields and a full-width "Book 10:30" primary. It scrolls into view when it opens. After booking it becomes a Done Green receipt (wash, inset ring, CalendarCheck) with a small secondary "Add to calendar", and the time buttons above it disappear.
- **Errors:** the standard red message box above the message field; the typed message goes back into the field.

### Booked Receipt
Replaces the form in place and hides the steps above it. Centred: a 44px Done Green wash disc with a CalendarCheck icon, "You’re booked" in 1.125rem 600, the service summary, the date and time in 600 tabular, one Muted Ink line, then a secondary "Add to calendar" button (.ics download). Below a hairline: the shop address with a MapPin and a violet tap-to-call text link, then a violet "Book another time" link.

### Copy Link
A read-only 44px field on Sunken Grey (Control Grey stroke, 8px radius) that selects itself on focus, beside a secondary "Copy link" button. After copying the button reads "Copied." with a green check for 2.5 seconds; a hidden status line announces it.

### Badges
- **Neutral pill:** grey fill, Soft Ink, inset ring, caption type. Used for "Closed" and "Hidden".

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** white with a 1px Border Grey outline and the Card shadow.
- **Card section:** Title, optional Muted Ink description, then content 20px below.
- **Internal Padding:** 20px, 24px from 640px.

### Inputs / Fields
- **Style:** white, 1px Control Grey stroke, 8px radius, 44px tall, 12px side padding, control shadow; stroke darkens on hover.
- **Focus:** border turns Focus Violet with a 3px Violet Wash ring.
- **Label and hint:** label 6px above; hint in Muted Ink 6px below, linked by `aria-describedby`. Fields that are not required say "(optional)".
- **Selects:** browser arrow removed; a Lucide ChevronDown in Icon Grey sits 12px from the right. Opening times are 24-hour choices in 15-minute steps.
- **Date and time:** the native picker, with the chosen moment echoed below in en-GB style ("Thu, 31 Dec 2026, 18:00").
- **Error / Success:** a message box under the fields: red or green wash, inset ring, 8px radius, with a CircleAlert or Check icon. Typed values stay after an error; forms clear only after success.

### Navigation
- **Tabs:** Shop, Bookings, Services, Hours, AI notes, in that order, in both the pill row and the sidebar.
- **Pill tabs (phones):** 500 text, 6px × 14px padding; the current tab is filled violet with white text, the rest get a grey wash on hover. The row's right edge fades out (a mask from 88% width) so a cut-off tab reads as scrollable.
- **Sidebar (desktop):** icon plus word, 8px radius; the current link is a Violet Wash with Deep Violet text and a violet icon.
- **Avatar menu:** a 36px violet-tint circle with the email's first letter; it opens a 256px white menu (12px radius, Popover shadow) with the email and Log out.

### Empty State
A 44px grey disc with a grey Lucide icon, a 600 title, and one Muted Ink sentence with a neutral example, centred inside a card. An optional secondary button may follow it. The title takes the heading level its page needs: h2 inside a page, h1 on the 404 page, which is a single 384px column under the wordmark.

### Setup Checklist
A card with "N of 4 done" (tabular), a 6px green progress bar, and full-bleed rows. Done steps get a filled green check circle and struck-through muted text; open steps get an empty grey ring. Only the next step shows a small violet "Start" button with an arrow.

### Loading
Grey rounded blocks with the same shapes as the page header and cards, pulsing only when reduced motion is off.

### Long and unusual data
Checked against a worst-case test shop (`scripts/seed-worst-case.mjs`) at 320px. Long words, links and emails wrap (`overflow-wrap: anywhere`) instead of widening the page. Emails are never cut off with "…" in owner screens, because the owner needs the whole address; they break before "@" and dots. On phones a service's price moves under its name, beside the duration, so the name keeps its room. A price of zero reads "Free". Icons beside text that can wrap are top-aligned and never shrink.

## Do's and Don'ts

### Do:
- **Do** keep violet for primary actions, text links, the current nav item, the current selection (service row, day cell, slot button) and focus (brand-700 fill, brand-600 focus outline).
- **Do** put lists inside cards as full-bleed rows divided by hairlines.
- **Do** set every time, price and duration with tabular numerals and no-break spaces.
- **Do** write labels for actions ("Hide", "Show", "Add hours") and give short buttons a longer accessible label.
- **Do** use two taps for delete, resetting after 4 seconds.
- **Do** keep typed values when a form fails, and clear the form only after it succeeds.
- **Do** write messages in sentence case ending with a full stop, with examples that fit any shop.
- **Do** make the main form button full width on phones and right-aligned from 640px.

### Don't:
- **Don't** colour the hours time chip, empty-state discs or done states violet; they are grey, grey and green. Only a slot button or day cell that is the current selection turns violet.
- **Don't** nest a bordered box inside a card.
- **Don't** use eye icons for Hide and Show; use worded ghost buttons.
- **Don't** show the browser's default select arrow; use the ChevronDown.
- **Don't** add a second accent, gradients, or a heavier shadow on resting surfaces.
- **Don't** use uppercase or letter-spaced labels above headings.
- **Don't** colour chat bubbles violet; the customer's are Ink, the helper's are Ground grey.
