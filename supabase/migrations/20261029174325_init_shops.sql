-- Shops, their services, opening hours, days off, AI notes, and bookings.
-- Every table has row level security (RLS): owners can only touch their own shop.

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------- shops
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  timezone    text not null default 'Europe/Bucharest',
  currency    text not null default 'EUR' check (currency in ('EUR', 'RON')),
  about       text not null default '' check (char_length(about) <= 1000),
  address     text not null default '' check (char_length(address) <= 200),
  phone       text not null default '' check (char_length(phone) <= 40),
  created_at  timestamptz not null default now(),
  -- One shop per owner for now. Easy to lift later.
  constraint shops_one_per_owner unique (owner_id)
);

-- ------------------------------------------------------------- services
create table public.services (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 80),
  duration_minutes  integer not null check (duration_minutes between 5 and 480),
  price_cents       integer check (price_cents >= 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);
create index services_shop_id_idx on public.services (shop_id);

-- -------------------------------------------------------- opening hours
-- weekday: 1 = Monday ... 7 = Sunday (ISO). Times are in the shop's time zone.
-- A day can have more than one row (for example 09:00-13:00 and 14:00-18:00).
create table public.opening_hours (
  id        uuid primary key default gen_random_uuid(),
  shop_id   uuid not null references public.shops (id) on delete cascade,
  weekday   smallint not null check (weekday between 1 and 7),
  opens     time not null,
  closes    time not null,
  check (closes > opens),
  -- This unique rule starts with shop_id, so it also serves as the shop_id index.
  unique (shop_id, weekday, opens)
);

-- ------------------------------------------------------------- time off
create table public.time_off (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  reason     text not null default '' check (char_length(reason) <= 200),
  check (ends_at > starts_at)
);
create index time_off_shop_id_idx on public.time_off (shop_id);

-- ------------------------------------------- shop info (notes for the AI)
create table public.shop_info (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  question    text not null check (char_length(question) between 1 and 200),
  answer      text not null check (char_length(answer) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index shop_info_shop_id_idx on public.shop_info (shop_id);

-- ------------------------------------------------------------- bookings
create table public.bookings (
  id              uuid primary key default gen_random_uuid(),
  shop_id         uuid not null references public.shops (id) on delete cascade,
  service_id      uuid not null references public.services (id) on delete restrict,
  customer_name   text not null check (char_length(customer_name) between 1 and 80),
  customer_email  text not null check (char_length(customer_email) between 3 and 200),
  customer_phone  text not null default '' check (char_length(customer_phone) <= 40),
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          text not null default 'booked' check (status in ('booked', 'cancelled')),
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Two live bookings in the same shop can never overlap.
  constraint bookings_no_overlap exclude using gist (
    shop_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status = 'booked')
);
create index bookings_service_id_idx on public.bookings (service_id);
-- The overlap rule's index only covers live bookings, so this one serves
-- "this shop's bookings by time" (dashboard lists) and shop deletes.
create index bookings_shop_id_starts_at_idx on public.bookings (shop_id, starts_at);

-- ================================================================== RLS
alter table public.shops         enable row level security;
alter table public.services      enable row level security;
alter table public.opening_hours enable row level security;
alter table public.time_off      enable row level security;
alter table public.shop_info     enable row level security;
alter table public.bookings      enable row level security;

-- shops: anyone can read the public shop page; only the owner can change it.
create policy "shops are public" on public.shops
  for select to anon, authenticated using (true);
create policy "owner creates own shop" on public.shops
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "owner updates own shop" on public.shops
  for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
create policy "owner deletes own shop" on public.shops
  for delete to authenticated using ((select auth.uid()) = owner_id);

-- The tables below repeat one check, "does the signed-in user own this shop?":
--   exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
-- It is written inline (no SECURITY DEFINER function), so it obeys RLS on shops.
-- Each action (select / insert / update / delete) gets exactly one policy, so
-- no two permissive policies overlap.

-- services: everyone sees active ones; the owner also sees hidden ones.
create policy "services: read active, or own" on public.services
  for select to anon, authenticated
  using (active or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "services: owner inserts" on public.services
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "services: owner updates" on public.services
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "services: owner deletes" on public.services
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- opening hours: public (customers need them); only the owner changes them.
create policy "opening hours: read" on public.opening_hours
  for select to anon, authenticated using (true);
create policy "opening hours: owner inserts" on public.opening_hours
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "opening hours: owner updates" on public.opening_hours
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "opening hours: owner deletes" on public.opening_hours
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- time off: the reason can be private, so only the owner reads it.
create policy "time off: owner reads" on public.time_off
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "time off: owner inserts" on public.time_off
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "time off: owner updates" on public.time_off
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "time off: owner deletes" on public.time_off
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- shop info: public answers the AI repeats to customers; only the owner changes them.
create policy "shop info: read" on public.shop_info
  for select to anon, authenticated using (true);
create policy "shop info: owner inserts" on public.shop_info
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "shop info: owner updates" on public.shop_info
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "shop info: owner deletes" on public.shop_info
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- bookings: only the owner reads or cancels. Customers book through the server (phase 3).
create policy "bookings: owner reads" on public.bookings
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "bookings: owner updates" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

-- =============================================================== grants
-- New Supabase tables are not exposed to the Data API automatically, so we
-- grant exactly what each role needs. RLS above still decides which rows.
grant select on public.shops, public.services, public.opening_hours, public.shop_info
  to anon, authenticated;
grant insert, update, delete on public.shops, public.services, public.opening_hours,
  public.time_off, public.shop_info to authenticated;
grant select on public.time_off to authenticated;
grant select, update on public.bookings to authenticated;
