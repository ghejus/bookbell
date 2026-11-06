# Bookbell

Online booking for small shops (barbers, salons, dentists, any appointment business), with a chat helper that answers customers' questions and finds free times.

**Live:** https://bookbell.vercel.app. Press **Try a demo shop** to get your own sample shop (no email needed), or open its booking page to book as a customer.

<a href="https://bookbell.vercel.app/bookbell-launch.mp4"><img src="docs/launch-film.webp" width="800" alt="Bookbell launch film: a customer books a haircut on a phone, the owner's Today screen gets the new booking, then the Bookbell logo and bookbell.vercel.app"></a>

**Launch film (20 seconds):** the preview above is silent. [Watch it with sound](https://bookbell.vercel.app/bookbell-launch.mp4) or [download it](https://github.com/ghejus/bookbell/releases/tag/launch-film). Made with [Hyperframes](https://hyperframes.heygen.com).

**Built:** shop owner accounts and a one-click demo shop; a dark phone app that opens from the home screen; a Today screen and a day/week calendar where owners add walk-ins and move bookings; a team page, so each worker has their own bookings (customers pick a worker or "anyone"); a customer list with each person’s visits, missed visits ("didn’t come") and private notes; a stats page with takings, visits, missed-visit rate, busiest days and times, and top services by week or month; a dashboard to set up the shop, its services, opening hours, days off, booking rules (notice, a gap after each booking, a deadline for online changes) and notes for the AI helper; a public booking page for each shop at `/s/<shop-address>`; customer accounts with My bookings, plus a private link to change or cancel each booking; and a chat helper on every shop page that answers questions and finds free times.
**Later ideas:** switch on the confirmation and reminder emails (the code is ready; it only needs a mail account), the real AI helper (a Claude key), payments.

## The big pieces

| Piece | What it does | Where it lives |
|---|---|---|
| **Website + server** | Next.js 16 pages and server actions | `src/app/` |
| **Accounts** | Supabase Auth, email + password. `src/proxy.ts` keeps the login fresh and keeps logged-out visitors out of `/dashboard`. | `src/lib/supabase/`, `src/app/(auth)/` |
| **Database** | Supabase Postgres. Every table has row level security, so an owner can only touch their own shop. Double bookings are blocked by the database itself. | `supabase/migrations/` |
| **Booking** | Customers book at `/s/<shop-address>`. Free times come from `getFreeSlots` in `src/lib/slots.ts`. Two database functions are the only public doors: `get_busy_times` (taken times, no names) and `book_appointment` (checks every rule before saving). | `src/app/s/`, `supabase/migrations/` |
| **Chat helper** | An "Ask a question" button on each shop page. It answers only from what the owner wrote, and shows free times as buttons. It never books by itself: it shows a booking form and the customer taps Book, so every booking goes through `book_appointment`. With no AI key it runs in **practice mode** (simple word matching, free). With `ANTHROPIC_API_KEY` set it uses Claude with two tools, `find_free_times` and `propose_booking`. `take_chat_turn` limits each visitor to 20 messages an hour and each shop to 300 a day. | `src/lib/assistant/`, `src/app/api/chat/`, `src/app/s/[slug]/chat.tsx` |
| **Form checks** | Everything typed is checked (zod) before it's saved. Time zone helpers turn "09:00 in Bucharest" into an exact moment. | `src/lib/validation.ts`, `src/lib/time.ts` |

## Set up (one time)

You need **Node 22 or newer** (`node --version`).

**Already done for this computer:** the Supabase project **Randul** (Frankfurt; named before the app became Bookbell) is linked, its tables are built, and `.env.local` holds the project URL and public key.

To set it up again somewhere else (needs the Supabase command tool logged in: `npx supabase login` in a normal terminal window):

1. `npx supabase link --project-ref <your-project-ref>`
2. `npx supabase db push --linked` builds the tables from `supabase/migrations/`.
3. `npx supabase config push` sends the login settings in `supabase/config.toml` (site address, redirect link, 8-character passwords). Run `npx supabase config diff` first to see exactly what will change.
4. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key (starts with `sb_publishable_`). Never put the **secret** key there: anything starting with `NEXT_PUBLIC_` is visible in the browser.

**AI helper (optional):** with no key, the chat helper runs in practice mode. To use the real AI, add `ANTHROPIC_API_KEY=...` to `.env.local` (a Claude key from platform.claude.com) and restart `npm run dev`. Each answer costs a little; the limits above cap how much.

**Before real people use the site:** email confirmation is turned **off** right now so testing works without real inboxes. Turn it back on in Supabase (Authentication → Sign In / Providers → Email → Confirm email) or set `enable_confirmations = true` under `[auth.email]` in `supabase/config.toml` and run `npx supabase config push`.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000**, click **Set up my shop**, and create an account.

## Going online (Vercel)

The site runs on Vercel (project `bookbell`, server region Frankfurt next to the database, set in `vercel.json`). Every push to `main` on GitHub publishes a new version.

Vercel needs three settings (Project → Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and, for Production, `NEXT_PUBLIC_SITE_URL=https://bookbell.vercel.app`. Add `ANTHROPIC_API_KEY` there to turn on the real AI helper. Supabase must list the live address too: `site_url` and `additional_redirect_urls` in `supabase/config.toml`, sent with `npx supabase config push`.

## Checks

```bash
npm test         # small automatic checks (form rules, time zones, prices, the practice helper)
npm run test:db  # real-database tests: owners can never touch each other's shops, every booking rule holds, chat limits hold
npm run lint     # code style
npm run build    # full production build
```

`npm run test:db` signs in as two test owners (`lock-test-a@` and `lock-test-b@randul-test.dev`). Their password is not in the code: add `TEST_OWNER_PASSWORD=...` to `.env.local` first (any strong password; the tests sign the owners up the first time). They also need `SUPABASE_SECRET_KEY`, because online bookings can only be made by the server.

**Worst-case test shop:** `node scripts/seed-worst-case.mjs` fills a test shop with the longest names and texts the database accepts, names in many scripts, emoji, a dozen services and a full day of bookings. Compare `/s/frizeria-stefan-fiii` (normal) with `/s/atelier-infrumusetare-wisniewska-kowalcz` (worst case) at a 320px-wide window after any layout change.

`.env.local` is in `.gitignore`, so your keys never go to GitHub.

## Known limits

- **Fake bookings:** booking needs no account. Only the website's server may book (the database refuses everyone else), and it stops forms filled in too fast, forms with the hidden trap field filled in, and more than 6 tries per hour from one network address (20 a day). One email can hold at most 3 upcoming bookings. A determined bot with many addresses could still get some made-up bookings through; the next step would be "confirm your booking by email".
- **Chat limits can be used up on purpose:** someone could spend a shop's 300 daily chat messages by sending requests directly. That switches off the helper for that shop until the next day; it can't touch bookings or cost more than the cap.
- **Emails:** customers aren't emailed yet. Owners contact customers themselves when they cancel.
