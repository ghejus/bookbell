-- Customers and no-shows.
--
-- 1. A booking can now be marked 'no_show' ("didn't come") by the owner, but
--    only once it has started. A booking that is still 'booked' after it ends
--    counts as a visit, so nothing ever has to flip it to "done".
-- 2. Each booking keeps the price it was booked at (price_cents), so changing
--    a service's price later doesn't change past takings.
-- 3. Each booking gets a customer_key, so one person's visits group together:
--    their email, else their phone number's digits, else their name (walk-ins
--    the owner typed in with only a name).
-- 4. Owners can keep a private note about each customer (customer_notes).
-- 5. owner_customers() lists the signed-in owner's customers with visit counts.

-- ------------------------------------------------------------- no-show
alter table public.bookings drop constraint bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('booked', 'cancelled', 'no_show'));

-- Same as before (20261104090000_owner_bookings.sql), plus: "didn't come"
-- only for a booking that has started.
drop policy "bookings: owner updates" on public.bookings;
create policy "bookings: owner updates" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
    and exists (select 1 from public.services sv where sv.id = service_id and sv.shop_id = bookings.shop_id)
    and (status <> 'no_show' or starts_at <= now())
  );

-- ---------------------------------------------------------------- price
alter table public.bookings add column price_cents integer check (price_cents >= 0);

update public.bookings b
set price_cents = sv.price_cents
from public.services sv
where sv.id = b.service_id;

create function private.set_booking_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select sv.price_cents into new.price_cents from public.services sv where sv.id = new.service_id;
  return new;
end;
$$;

create trigger bookings_set_price
  before insert on public.bookings
  for each row execute function private.set_booking_price();

-- --------------------------------------------------------- customer_key
alter table public.bookings add column customer_key text generated always as (
  case
    when customer_email <> '' then 'e:' || lower(customer_email)
    when char_length(regexp_replace(customer_phone, '[^0-9]', '', 'g')) >= 6
      then 'p:' || regexp_replace(customer_phone, '[^0-9]', '', 'g')
    else 'n:' || lower(btrim(customer_name))
  end
) stored;
create index bookings_shop_customer_idx on public.bookings (shop_id, customer_key);

-- ------------------------------------------------------- customer_notes
create table public.customer_notes (
  shop_id       uuid not null references public.shops (id) on delete cascade,
  customer_key  text not null check (char_length(customer_key) between 3 and 220),
  note          text not null check (char_length(note) <= 2000),
  updated_at    timestamptz not null default now(),
  primary key (shop_id, customer_key)
);
alter table public.customer_notes enable row level security;

create policy "customer notes: owner only" on public.customer_notes
  for all to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

revoke all on public.customer_notes from anon, authenticated;
grant select, insert, update, delete on public.customer_notes to authenticated;

-- ------------------------------------------------------- owner_customers
-- The signed-in owner's customers, most recent first. Runs as the caller, so
-- the usual locks (RLS) keep it to their own shop.
create function public.owner_customers()
returns table (
  customer_key text,
  name text,
  email text,
  phone text,
  visits integer,
  no_shows integer,
  cancelled integer,
  spent_cents bigint,
  last_visit timestamptz,
  next_visit timestamptz,
  note text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select b.customer_key,
         (array_agg(b.customer_name order by b.starts_at desc))[1],
         coalesce((array_agg(b.customer_email order by b.starts_at desc) filter (where b.customer_email <> ''))[1], ''),
         coalesce((array_agg(b.customer_phone order by b.starts_at desc) filter (where b.customer_phone <> ''))[1], ''),
         (count(*) filter (where b.status = 'booked' and b.ends_at <= now()))::integer,
         (count(*) filter (where b.status = 'no_show'))::integer,
         (count(*) filter (where b.status = 'cancelled'))::integer,
         coalesce(sum(b.price_cents) filter (where b.status = 'booked' and b.ends_at <= now()), 0)::bigint,
         max(b.starts_at) filter (where b.status = 'booked' and b.ends_at <= now()),
         min(b.starts_at) filter (where b.status = 'booked' and b.ends_at > now()),
         n.note
  from public.bookings b
  join public.shops s on s.id = b.shop_id and s.owner_id = (select auth.uid())
  left join public.customer_notes n on n.shop_id = b.shop_id and n.customer_key = b.customer_key
  group by b.customer_key, n.note
  order by greatest(
             max(b.starts_at) filter (where b.status = 'booked' and b.ends_at <= now()),
             min(b.starts_at) filter (where b.status = 'booked' and b.ends_at > now()),
             max(b.starts_at)
           ) desc nulls last
  limit 2000;
$$;

revoke all on function public.owner_customers() from public, anon;
grant execute on function public.owner_customers() to authenticated;
