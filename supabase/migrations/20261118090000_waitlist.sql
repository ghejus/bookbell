-- Waitlist.
--
-- When a day is full, a signed-in customer can ask to be told if a time opens
-- on that day (for one service, with one worker or anyone). Nothing runs in the
-- background: My bookings checks the free times each time it opens, and shows
-- "A time opened" with a Book it button. The owner sees who is waiting, so
-- they can call people. When emails are on, a cancel or move also emails the
-- people waiting for that day (once each: notified_at).
--
-- 1. waitlist: one row per wish. Customers read and remove their own rows;
--    owners read and remove their shop's rows. Rows are added only through
--    join_waitlist(), which checks everything.
-- 2. Booking at that shop on that day removes the customer's wish (trigger).
-- 3. get_days_off(): the shop's days off, so the booking page can tell a full
--    day (open, but every time taken) from a closed one.
-- 4. Old wishes (days that have passed) are removed by the daily cleanup job.

-- ------------------------------------------------------------------ table
create table public.waitlist (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  service_id   uuid not null references public.services (id) on delete cascade,
  -- null = anyone at the shop
  staff_id     uuid references public.staff (id) on delete cascade,
  -- the day wanted, in the shop's time zone
  day          date not null,
  -- null only for the demo shop's sample wishes
  customer_id  uuid references auth.users (id) on delete cascade,
  name         text not null default '' check (char_length(name) <= 120),
  email        text not null default '' check (char_length(email) <= 254),
  phone        text not null default '' check (char_length(phone) <= 40),
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);
create unique index waitlist_one_wish on public.waitlist
  (customer_id, service_id, coalesce(staff_id, '00000000-0000-0000-0000-000000000000'::uuid), day)
  where customer_id is not null;
create index waitlist_shop_day_idx on public.waitlist (shop_id, day);
create index waitlist_customer_idx on public.waitlist (customer_id) where customer_id is not null;
alter table public.waitlist enable row level security;

create policy "waitlist: read own, or own shop's" on public.waitlist
  for select to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
  );
create policy "waitlist: remove own, or own shop's" on public.waitlist
  for delete to authenticated
  using (
    customer_id = (select auth.uid())
    or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
  );

revoke all on public.waitlist from anon, authenticated;
grant select, delete on public.waitlist to authenticated;

-- ---------------------------------------------------------- join_waitlist
/**
 * Puts the signed-in customer on the waitlist for one day. Joining twice
 * returns the same wish. Errors: not_signed_in, demo_account,
 * service_not_found, staff_not_found, own_shop, bad_day (passed, or outside
 * the shop's booking window), too_many_waits (5 open wishes at most).
 */
create function public.join_waitlist(p_service_id uuid, p_staff_id uuid, p_day date, p_phone text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_shop public.shops;
  v_user auth.users;
  v_today date;
  v_id uuid;
  v_phone text := left(btrim(coalesce(p_phone, '')), 40);
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;
  select * into v_user from auth.users where id = v_uid;
  if v_user.is_anonymous then
    raise exception 'demo_account';
  end if;

  select s.* into v_shop
  from public.services sv
  join public.shops s on s.id = sv.shop_id
  where sv.id = p_service_id and sv.active;
  if v_shop.id is null then
    raise exception 'service_not_found';
  end if;
  if v_shop.owner_id = v_uid then
    raise exception 'own_shop';
  end if;
  if p_staff_id is not null and not exists (
    select 1 from public.staff w where w.id = p_staff_id and w.shop_id = v_shop.id and w.active
  ) then
    raise exception 'staff_not_found';
  end if;

  v_today := (now() at time zone v_shop.timezone)::date;
  if p_day is null or p_day < v_today or p_day > v_today + v_shop.booking_window_days then
    raise exception 'bad_day';
  end if;

  select w.id into v_id
  from public.waitlist w
  where w.customer_id = v_uid and w.service_id = p_service_id
    and w.staff_id is not distinct from p_staff_id and w.day = p_day;
  if v_id is not null then
    if v_phone <> '' then
      update public.waitlist set phone = v_phone where id = v_id;
    end if;
    return v_id;
  end if;

  if (select count(*) from public.waitlist w where w.customer_id = v_uid and w.day >= v_today - 1) >= 5 then
    raise exception 'too_many_waits';
  end if;

  insert into public.waitlist (shop_id, service_id, staff_id, day, customer_id, name, email, phone)
  values (
    v_shop.id, p_service_id, p_staff_id, p_day, v_uid,
    left(coalesce(v_user.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(v_user.email, ''), 254),
    v_phone
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- --------------------------------------- booked that day: wish fulfilled
create function private.waitlist_done()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.waitlist w
  using public.shops s
  where s.id = new.shop_id
    and w.shop_id = new.shop_id
    and w.customer_id = new.customer_id
    and w.day = (new.starts_at at time zone s.timezone)::date;
  return null;
end;
$$;

create trigger bookings_waitlist_done
  after insert or update of customer_id on public.bookings
  for each row
  when (new.customer_id is not null and new.status = 'booked')
  execute function private.waitlist_done();

-- ------------------------------------------------------------ get_days_off
/** The shop's days off between two times (no reasons): whole shop (staff_id null) or one worker. */
create function public.get_days_off(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, staff_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select t.starts_at, t.ends_at, t.staff_id
  from public.time_off t
  where t.shop_id = p_shop_id
    and t.starts_at < p_to
    and t.ends_at > p_from
    and p_to > p_from
    and p_to - p_from <= interval '62 days';
$$;

-- ================================================================ grants
revoke all on function public.join_waitlist(uuid, uuid, date, text) from public, anon;
grant execute on function public.join_waitlist(uuid, uuid, date, text) to authenticated;
revoke all on function private.waitlist_done() from public;
revoke all on function public.get_days_off(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_days_off(uuid, timestamptz, timestamptz) to anon, authenticated;
