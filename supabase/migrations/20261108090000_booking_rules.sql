-- Booking rules the owner can set (the "Booking rules" page):
--   buffer_minutes         a gap kept free after each booking (cleaning, a
--                          breather); online bookings can't start inside it
--   cancel_deadline_hours  customers can't cancel or change a booking online
--                          this many hours before it starts (they call instead)
-- Owners themselves are never held to either rule: their own adds and moves
-- (owner_add_booking, owner_move_booking) only refuse real overlaps.

alter table public.shops
  add column buffer_minutes integer not null default 0
    check (buffer_minutes between 0 and 120 and buffer_minutes % 5 = 0),
  add column cancel_deadline_hours integer not null default 0
    check (cancel_deadline_hours between 0 and 168);

-- ------------------------------------------------------------ gap_clash
-- True when a booking for this worker from p_starts_at to p_ends_at would sit
-- inside the gap before or after one of their other bookings. The bookings
-- table only refuses real overlaps, so this check takes a lock per worker
-- first: two people booking the same worker at once are checked one after
-- the other, and the second one sees the first.
create function private.gap_clash(
  p_shop public.shops,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_ignore uuid
)
returns boolean
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_gap interval := make_interval(mins => p_shop.buffer_minutes);
begin
  perform pg_advisory_xact_lock(hashtextextended('booking_staff:' || p_staff_id::text, 0));
  if p_shop.buffer_minutes = 0 then
    return false;
  end if;
  return exists (
    select 1 from public.bookings b
    where b.staff_id = p_staff_id
      and b.status = 'booked'
      and b.id is distinct from p_ignore
      and tstzrange(b.starts_at - v_gap, b.ends_at + v_gap) && tstzrange(p_starts_at, p_ends_at)
  );
end;
$$;

-- -------------------------------------------------- check_change_deadline
-- Raises 'too_close' when a customer tries to cancel or move a booking
-- inside the shop's deadline.
create function private.check_change_deadline(p_booking public.bookings)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_hours integer;
begin
  select s.cancel_deadline_hours into v_hours from public.shops s where s.id = p_booking.shop_id;
  if p_booking.starts_at < now() + make_interval(hours => coalesce(v_hours, 0)) then
    raise exception 'too_close' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.gap_clash(public.shops, uuid, timestamptz, timestamptz, uuid) from public;
revoke all on function private.check_change_deadline(public.bookings) from public;

-- ------------------------------------------------------- get_busy_times
-- Same as before (20261103090000_staff.sql), except each booking counts as
-- taken from (start - gap) to (end + gap), so the free-time finder keeps the
-- gaps free without knowing about them. Days off are not widened.
create or replace function public.get_busy_times(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, staff_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at - make_interval(mins => s.buffer_minutes),
         b.ends_at + make_interval(mins => s.buffer_minutes),
         b.staff_id
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  where b.shop_id = p_shop_id
    and b.status = 'booked'
    and b.starts_at - make_interval(mins => s.buffer_minutes) < p_to
    and b.ends_at + make_interval(mins => s.buffer_minutes) > p_from
    and p_to > p_from
    and p_to - p_from <= interval '62 days'
  union all
  select t.starts_at, t.ends_at, t.staff_id
  from public.time_off t
  where t.shop_id = p_shop_id
    and t.starts_at < p_to
    and t.ends_at > p_from
    and p_to > p_from
    and p_to - p_from <= interval '62 days';
$$;

-- ---------------------------------------------------- book_appointment
-- Same as before (20261107090000_booking_guard.sql), plus the gap rule.
create or replace function public.book_appointment(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_staff_id uuid default null,
  p_customer_id uuid default null
)
returns table (booking_id uuid, manage_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop public.shops%rowtype;
  v_service public.services%rowtype;
  v_ends_at timestamptz;
  v_local_date date;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_candidates uuid[];
  v_staff uuid;
  v_someone_off boolean := false;
  v_someone_busy boolean := false;
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

  -- Notice, booking window, opening hours, whole-shop days off
  perform private.check_booking_time(v_shop, v_service.duration_minutes, p_starts_at);
  v_ends_at := p_starts_at + make_interval(mins => v_service.duration_minutes);
  v_local_date := (p_starts_at at time zone v_shop.timezone)::date;

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

  -- Which workers to try
  if p_staff_id is not null then
    if not exists (select 1 from public.staff w where w.id = p_staff_id and w.shop_id = p_shop_id and w.active) then
      raise exception 'staff_not_found' using errcode = 'P0001';
    end if;
    v_candidates := array[p_staff_id];
  else
    select array_agg(w.id order by (
             select count(*) from public.bookings b
             where b.staff_id = w.id
               and b.status = 'booked'
               and (b.starts_at at time zone v_shop.timezone)::date = v_local_date
           ), w.created_at, w.id)
    into v_candidates
    from public.staff w
    where w.shop_id = p_shop_id and w.active;
    if v_candidates is null then
      raise exception 'no_staff' using errcode = 'P0001';
    end if;
  end if;

  foreach v_staff in array v_candidates loop
    -- Skip a worker who has their own day off then
    if exists (
      select 1 from public.time_off t
      where t.staff_id = v_staff
        and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts_at, v_ends_at)
    ) then
      v_someone_off := true;
      continue;
    end if;

    -- Too close to this worker's other bookings (the shop's gap rule)
    if private.gap_clash(v_shop, v_staff, p_starts_at, v_ends_at, null) then
      v_someone_busy := true;
      continue;
    end if;

    begin
      insert into public.bookings (shop_id, service_id, staff_id, customer_name, customer_email, customer_phone, starts_at, ends_at, customer_id, source)
      values (p_shop_id, p_service_id, v_staff, v_name, v_email, v_phone, p_starts_at, v_ends_at,
              p_customer_id, 'online')
      returning id into v_id;
      booking_id := v_id;
      manage_token := private.new_manage_token(v_id);
      return next;
      return;
    exception
      -- The "no overlapping bookings" rule fired: this worker is busy then.
      when exclusion_violation then
        v_someone_busy := true;
    end;
  end loop;

  -- Nobody could take it. If everyone was simply off, say the shop is closed then.
  if v_someone_off and not v_someone_busy then
    raise exception 'closed_then' using errcode = 'P0001';
  end if;
  raise exception 'slot_taken' using errcode = 'P0001';
end;
$$;

-- --------------------------------------------- cancel_booking_by_token
-- Same as before (20261103120000_manage_link.sql), plus the deadline.
create or replace function public.cancel_booking_by_token(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select * into v_booking from public.bookings
  where id = private.booking_for_token(p_token)
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'not_booked' using errcode = 'P0001';
  end if;
  if v_booking.starts_at <= now() then
    raise exception 'too_late' using errcode = 'P0001';
  end if;
  perform private.check_change_deadline(v_booking);
  update public.bookings set status = 'cancelled' where id = v_booking.id;
end;
$$;

-- ----------------------------------------- reschedule_booking_by_token
-- Same as before, plus the deadline and the gap rule at the new time.
create or replace function public.reschedule_booking_by_token(p_token text, p_starts_at timestamptz)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_shop public.shops%rowtype;
  v_duration integer;
  v_ends_at timestamptz;
begin
  select * into v_booking from public.bookings
  where id = private.booking_for_token(p_token)
  for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'not_booked' using errcode = 'P0001';
  end if;
  if v_booking.starts_at <= now() then
    raise exception 'too_late' using errcode = 'P0001';
  end if;
  perform private.check_change_deadline(v_booking);
  if not exists (select 1 from public.staff w where w.id = v_booking.staff_id and w.active) then
    raise exception 'staff_not_found' using errcode = 'P0001';
  end if;

  select * into v_shop from public.shops where id = v_booking.shop_id;
  v_duration := (extract(epoch from (v_booking.ends_at - v_booking.starts_at)) / 60)::integer;
  perform private.check_booking_time(v_shop, v_duration, p_starts_at);
  v_ends_at := p_starts_at + make_interval(mins => v_duration);

  if exists (
    select 1 from public.time_off t
    where t.staff_id = v_booking.staff_id
      and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'closed_then' using errcode = 'P0001';
  end if;

  if private.gap_clash(v_shop, v_booking.staff_id, p_starts_at, v_ends_at, v_booking.id) then
    raise exception 'slot_taken' using errcode = 'P0001';
  end if;

  begin
    update public.bookings
    set starts_at = p_starts_at, ends_at = v_ends_at, reminder_sent_at = null
    where id = v_booking.id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;
end;
$$;

-- ------------------------------------------------ get_booking_by_token
-- Same as before, plus change_until: after this, the customer can no longer
-- cancel or move it online.
drop function public.get_booking_by_token(text);
create function public.get_booking_by_token(p_token text)
returns table (
  booking_id uuid,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  customer_name text,
  customer_email text,
  customer_phone text,
  service_id uuid,
  service_name text,
  duration_minutes integer,
  price_cents integer,
  staff_id uuid,
  staff_name text,
  team_size integer,
  shop_id uuid,
  shop_slug text,
  shop_name text,
  shop_address text,
  shop_phone text,
  shop_timezone text,
  shop_currency text,
  change_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.starts_at, b.ends_at, b.customer_name, b.customer_email, b.customer_phone,
         sv.id, sv.name, sv.duration_minutes, sv.price_cents,
         w.id, w.name,
         (select count(*)::integer from public.staff x where x.shop_id = s.id and x.active),
         s.id, s.slug, s.name, s.address, s.phone, s.timezone, s.currency,
         b.starts_at - make_interval(hours => s.cancel_deadline_hours)
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  join public.services sv on sv.id = b.service_id
  join public.staff w on w.id = b.staff_id
  where b.id = private.booking_for_token(p_token);
$$;

-- ---------------------------------------------------------- my_bookings
-- Same as before (20261105090000_customer_accounts.sql), plus change_until.
drop function public.my_bookings();
create function public.my_bookings()
returns table (
  booking_id uuid,
  status text,
  starts_at timestamptz,
  ends_at timestamptz,
  service_name text,
  price_cents integer,
  staff_name text,
  team_size integer,
  shop_slug text,
  shop_name text,
  shop_address text,
  shop_timezone text,
  shop_currency text,
  change_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.status, b.starts_at, b.ends_at,
         sv.name, sv.price_cents,
         w.name,
         (select count(*)::integer from public.staff x where x.shop_id = s.id and x.active),
         s.slug, s.name, s.address, s.timezone, s.currency,
         b.starts_at - make_interval(hours => s.cancel_deadline_hours)
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  join public.services sv on sv.id = b.service_id
  join public.staff w on w.id = b.staff_id
  where (select auth.uid()) is not null
    and b.customer_id = (select auth.uid())
  order by b.starts_at;
$$;

-- ================================================================ grants
revoke all on function public.get_booking_by_token(text) from public;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
revoke all on function public.my_bookings() from public, anon;
grant execute on function public.my_bookings() to authenticated;
