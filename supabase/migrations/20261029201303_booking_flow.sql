-- Phase 3: customers book without an account.
--
-- Customers are not logged in, so they never read or write the bookings table
-- directly (RLS keeps it owner-only). Instead they get two narrow doors:
--   get_busy_times(...)   which times are taken, with no customer details
--   book_appointment(...) books one time, after the database checks every rule
-- Both are SECURITY DEFINER on purpose (they must see bookings to work), so they
-- return only what is safe, check all input themselves, and use an empty search_path.

-- ----------------------------------------------------------- booking rules
-- Per-shop rules with sensible defaults. No settings screen yet; the defaults apply.
alter table public.shops
  add column booking_window_days integer not null default 60
    check (booking_window_days between 1 and 365),
  add column min_notice_minutes integer not null default 120
    check (min_notice_minutes between 0 and 10080),
  add column slot_step_minutes integer not null default 15
    check (slot_step_minutes in (5, 10, 15, 20, 30, 60));

-- ------------------------------------------------------- get_busy_times
-- Start and end of every taken time (live bookings and days off) that overlaps
-- the window. Never names, emails, phones or reasons. At most 62 days per call.
create or replace function public.get_busy_times(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at, b.ends_at
  from public.bookings b
  where b.shop_id = p_shop_id
    and b.status = 'booked'
    and b.starts_at < p_to
    and b.ends_at > p_from
    and p_to > p_from
    and p_to - p_from <= interval '62 days'
  union all
  select t.starts_at, t.ends_at
  from public.time_off t
  where t.shop_id = p_shop_id
    and t.starts_at < p_to
    and t.ends_at > p_from
    and p_to > p_from
    and p_to - p_from <= interval '62 days';
$$;

-- ----------------------------------------------------- book_appointment
-- Books one time for a customer and returns the new booking id.
-- Every rule is checked here, so a hand-made request can't skip the form's checks.
-- Errors use code P0001 with a short message the app turns into plain words.
create or replace function public.book_appointment(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default ''
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_id uuid;
begin
  -- Who and what
  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'shop_not_found' using errcode = 'P0001';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and shop_id = p_shop_id and active;
  if not found then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;

  -- Customer details (the table has length checks too)
  if char_length(v_name) not between 1 and 80
     or char_length(v_email) not between 3 and 200
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_phone) > 40 then
    raise exception 'invalid_details' using errcode = 'P0001';
  end if;

  if p_starts_at is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;
  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);

  -- Not too soon, not too far ahead
  if p_starts_at < now() + make_interval(mins => v_shop.min_notice_minutes) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => v_shop.booking_window_days) then
    raise exception 'too_far' using errcode = 'P0001';
  end if;

  -- Inside one block of opening hours, in the shop's own time zone, on one day
  v_local_start := p_starts_at at time zone v_shop.timezone;
  v_local_end := v_ends_at at time zone v_shop.timezone;
  if v_local_start::date <> v_local_end::date
     or not exists (
       select 1
       from public.opening_hours h
       where h.shop_id = p_shop_id
         and h.weekday = extract(isodow from v_local_start)
         and h.opens <= v_local_start::time
         and v_local_end::time <= h.closes
     ) then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  -- Not on a day off
  if exists (
    select 1 from public.time_off t
    where t.shop_id = p_shop_id
      and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'closed_then' using errcode = 'P0001';
  end if;

  -- One email can't fill a whole calendar
  if (
    select count(*) from public.bookings b
    where b.shop_id = p_shop_id
      and lower(b.customer_email) = v_email
      and b.status = 'booked'
      and b.ends_at > now()
  ) >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  insert into public.bookings (shop_id, service_id, customer_name, customer_email, customer_phone, starts_at, ends_at)
  values (p_shop_id, p_service_id, v_name, v_email, v_phone, p_starts_at, v_ends_at)
  returning id into v_id;

  return v_id;
exception
  -- The "no overlapping bookings" rule fired: someone else just took this time.
  when exclusion_violation then
    raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

-- Postgres lets everyone run new functions by default. Allow exactly the two
-- website roles instead, and nobody else.
revoke all on function public.get_busy_times(uuid, timestamptz, timestamptz) from public;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text) from public;
grant execute on function public.get_busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text) to anon, authenticated;
