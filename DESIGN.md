---
name: Bookbell
description: A dark, quiet booking app for small shops that lives on the phone's home screen. Design system "Nocturne".
source: design/mobile-app/Bookbell App.dc.html (Claude Design project "Mobile app design brief")
colors:
  ground: "#161826"
  surface: "#232532"
  raised: "#2b2d3b"
  ink: "#e9e9ed"
  line: "rgba(233,233,237,0.16)"
  hairline: "#3f424d"
  accent: "#9184d9"
  accent-100: "#f5f4ff"
  accent-200: "#e7e5fe"
  accent-300: "#d2cefd"
  accent-400: "#b5abfc"
  accent-500: "#968ae0"
  accent-600: "#796cbf"
  accent-700: "#5d5294"
  accent-800: "#423a6a"
  accent-900: "#2b2741"
  neutral-100: "#f3f5fe"
  neutral-200: "#e4e7f5"
  neutral-300: "#cfd3e5"
  neutral-400: "#b2b6ca"
  neutral-500: "#9397ab"
  neutral-600: "#75798c"
  neutral-700: "#595d6c"
  neutral-800: "#3f424d"
  neutral-900: "#292b31"
  danger: "#e5675e"
  danger-soft: "#3a2226"
  danger-text: "#f29a94"
  danger-ink: "#f6b4ae"
  success-soft: "#1d3328"
  success-ink: "#a7e3bd"
typography:
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 500
    letterSpacing: "-0.015em"
  eyebrow:
    fontSize: "13px"
    fontWeight: 400
    color: "{colors.neutral-400}"
  section:
    fontSize: "15px"
    fontWeight: 500
  body:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "\"cv11\", \"ss01\""
  caption:
    fontSize: "12px"
    fontWeight: 500
rounded:
  control: "8px"
  card: "8px"
  sheet: "14px"
  pill: "9999px"
icons: "Phosphor (regular; filled for the active tab)"
---

# Design System: Bookbell ("Nocturne")

## Overview

Bookbell is a phone app first: a shop owner runs their day from it between customers, and a customer books in a minute. It opens from the home screen (see `src/app/manifest.ts`) and fills the screen.

The look is **Nocturne**: a near-neutral blue-grey night ground, cards one step lighter, light text, and one soft violet accent. The accent is a **line and a glow**, never a flood: main buttons are violet outlines with a faint glow, the chosen day or time is a deep violet tint with a violet edge, and "now" is a glowing violet line. Contrast comes from the grey ramp, not from colour.

The source design lives in `design/mobile-app/`. When in doubt, open it and match it.

**Key characteristics**
- Dark everywhere: phones and computers share one look. Computers get wider layouts, not a different style.
- Inter at weight 500 for every heading and label. Hierarchy comes from size and space, never from bold.
- 8px corners on cards and controls, 14px on bottom sheets and toasts.
- Hairline card edges (`#3f424d`), no heavy shadows.
- Rows inside a card are split by a hairline that **fades out at both ends** (`rule-top` utility).
- Phosphor icons, always next to a word or with an accessible label.
- Times, prices and durations use tabular numbers.

## Colours

Defined once in `src/app/globals.css` (`@theme`). New code uses the named colours:

| Name | Use |
| --- | --- |
| `ground` | The page. Also the inside of text boxes. |
| `surface` | Cards, sheets, the toast, menus. |
| `raised` / `ink/4` | Hover on a row inside a card. |
| `ink` | Text. |
| `neutral-400` | Secondary text (descriptions, dates, hints). The lightest readable step. |
| `neutral-500` | Resting icons. |
| `neutral-600` | Placeholder text, disabled days. |
| `line` | Edges of inputs, outline buttons and chips. |
| `hairline` | Card edges. |
| `accent` | Main button edge, focus ring, chosen edge, "now" line. |
| `accent-400` | Accent text: links, main button text, active tab. |
| `accent-900` / `accent-800` | Chosen fill / stronger tint (tags, avatar edge). |
| `danger-*` | Cancel and delete: soft red fill, red edge, pink text. |
| `success-*` | "You're booked", "Copied", success messages. |

Older screens were written with Tailwind's `gray-*`, `brand-*`, `red-*`, `green-*` and `amber-*` names. Those names are re-pointed at Nocturne colours in `globals.css` (for example, `gray-900` is now the light text colour), so old and new code look the same. Prefer the named colours in new code.

**Rules**
- No pure black or white anywhere.
- Never fill a large area with the accent.
- Accent-coloured body text uses `accent-300`/`accent-400`, not `accent` itself.

## Typography

Inter (`next/font`), with `cv11` and `ss01` on.

- **Page title:** 28px / 500 / tight tracking, with an optional 13px grey **eyebrow** line above it (a date, "Your shop", "Upcoming, soonest first"). Component: `PageHeader`.
- **Section title:** 13–16px / 500 (e.g. "All of today", "1. Choose a service").
- **Body:** 14px / 400; secondary lines in `neutral-400`.
- **Big numbers:** the "Next up" name is 22px / 500, a booking's time range 24px / 500, tabular.
- **Captions:** 11–12px / 500 (tags, weekday names, "Morning / Afternoon / Evening").

## Layout and app shell

- **Phones:** a page title row (eyebrow + title + round avatar on the right), then content in 16px side padding with 22–26px between sections. A fixed **bottom tab bar** (86px, blurred `ground` at 90%, a fading hairline on top).
  - Owner tabs: **Today · Calendar · (+) · Bookings · Shop**. The **+** is a 58px round button in the middle of the bar (surface fill, violet edge, glow), opening "New booking".
  - Customer tabs: **Book · My bookings**.
  - Active tab: filled Phosphor icon + `accent-400`. Others: regular icon + `neutral-500`.
- **Shop sub-pages** (Services, Hours and days off, AI notes, Team): a "‹ Shop" back link at the top, title + description, then one card of rows.
- **Computers:** a left sidebar with the same items, content up to 768px (calendar wider).
- **Home-screen app:** `viewport-fit=cover`, a ground-coloured strip under the iPhone status bar, and bottom bars pad for the home indicator (`env(safe-area-inset-*)`).

## Elevation

- **Card:** `surface` + a 1px hairline ring (`shadow-card`).
- **Highlighted card** ("Next up"): ring in `accent-800` + a very faint violet glow.
- **Sheet:** `surface`, 14px top corners, a grab handle, ring `#595d6c` + a soft shadow upwards, over a 62% dark backdrop.
- **Toast:** slides down from the top, `surface`, 14px corners, an icon in an `accent-900` square.

## Components

- **Buttons** (`buttonClass` in `src/components/ui.tsx`): 44px (36px small), 8px corners, 14px / 500.
  - *Primary:* violet outline, `accent-400` text, soft glow; hover tints violet. Full width when it ends a form on a phone.
  - *Secondary:* `line` outline, ink text; hover `ink/7`.
  - *Ghost:* accent text, no edge.
  - *Danger:* pink text; the armed "Cancel?" / "Delete?" state is a red edge on `danger-soft`.
  - Labels follow the choice: "Choose a time" → "Book 10:30".
- **Two-tap cancel/delete** (`ConfirmDelete`): ✕ icon → "Cancel?" for 4 seconds → done.
- **Chips** (days, times, workers): `chip-off` (faint fill, `line` edge), `chip-on` (deep violet fill, violet edge, glow), `chip-shut` (dashed edge, dim text).
- **Rows in a card:** 12–13px vertical padding, `rule-top` between rows, a caret on the right when the row opens something.
- **Inputs:** 44px, `ground` fill inside a card, `line` edge; on focus a violet edge and a 3px violet ring at 20%.
- **Tags/badges:** 11px, 6px corners. "Done" / "Hidden" / "Closed" in `neutral-800`; "Booked online" in `accent-800`.
- **Empty state:** a 44px round grey icon, a short title, one sentence, and at most one button.
- **Messages:** errors in `danger-soft` with a warning icon; success in `success-soft` with a check.

## Words

Short sentences, sentence case, a full stop. Say what happens ("Cancelling frees the time for others."). Name the next step ("Tap an empty time to add a booking there.").

## Do / Don't

**Do**
- Match `design/mobile-app/` for spacing and sizes.
- Use the named colours and the `rule-top`, `chip-*` utilities.
- Give every interactive thing a hover, a pressed state and the violet focus ring.
- Test at 320px, 402px (the design's phone) and 1280px, with very long names.

**Don't**
- Don't use solid violet buttons or big violet areas.
- Don't bold past 500.
- Don't stack heavy shadows; depth is an edge plus darkness.
- Don't use pure black or white.
