# Rândul

Online booking for small shops (barbers, salons, dentists, any appointment business), with an AI helper that answers customers' questions and books times.

**Built so far (phases 1 to 3):** shop owner accounts; a dashboard to set up the shop, its services, opening hours, days off and notes for the AI helper; a public booking page for each shop at `/s/<shop-address>`; and a Bookings list for owners.
**Coming next:** the AI chat helper (phase 4), then design polish and going online (phase 5).

## The big pieces

| Piece | What it does | Where it lives |
|---|---|---|
| **Website + server** | Next.js 16 pages and server actions | `src/app/` |
| **Accounts** | Supabase Auth, email + password. `src/proxy.ts` keeps the login fresh and keeps logged-out visitors out of `/dashboard`. | `src/lib/supabase/`, `src/app/(auth)/` |
| **Database** | Supabase Postgres. Every table has row level security, so an owner can only touch their own shop. Double bookings are blocked by the database itself. | `supabase/migrations/` |
| **Booking** | Customers book at `/s/<shop-address>`. Free times come from `getFreeSlots` in `src/lib/slots.ts`. Two database functions are the only public doors: `get_busy_times` (taken times, no names) and `book_appointment` (checks every rule before saving). | `src/app/s/`, `supabase/migrations/` |
| **Form checks** | Everything typed is checked (zod) before it's saved. Time zone helpers turn "09:00 in Bucharest" into an exact moment. | `src/lib/validation.ts`, `src/lib/time.ts` |

## Set up (one time)

You need **Node 22 or newer** (`node --version`).

**Already done for this computer:** the Supabase project **Randul** (Frankfurt) is linked, its tables are built, and `.env.local` holds the project URL and public key.

To set it up again somewhere else (needs the Supabase command tool logged in: `npx supabase login` in a normal terminal window):

1. `npx supabase link --project-ref <your-project-ref>`
2. `npx supabase db push --linked` builds the tables from `supabase/migrations/`.
3. `npx supabase config push` sends the login settings in `supabase/config.toml` (site address, redirect link, 8-character passwords). Run `npx supabase config diff` first to see exactly what will change.
4. Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key (starts with `sb_publishable_`). Never put the **secret** key there: anything starting with `NEXT_PUBLIC_` is visible in the browser.

**Before real people use the site:** email confirmation is turned **off** right now so testing works without real inboxes. Turn it back on in Supabase (Authentication → Sign In / Providers → Email → Confirm email) or set `enable_confirmations = true` under `[auth.email]` in `supabase/config.toml` and run `npx supabase config push`.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3000**, click **Set up my shop**, and create an account.

## Checks

```bash
npm test         # small automatic checks (form rules, time zones, prices)
npm run test:db  # real-database tests: owners can never touch each other's shops, and every booking rule holds
npm run lint     # code style
npm run build    # full production build
```

`.env.local` is in `.gitignore`, so your keys never go to GitHub.
