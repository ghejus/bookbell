-- Emails and the "manage my booking" link.
--
-- Each booking gets secret links (/b/<token>) that let the customer see, cancel
-- or move it without an account. Only a fingerprint (sha256) of each token is
-- stored, so even someone who could read the database can't rebuild the links.
-- A booking can have more than one link (the confirmation email has one, the
-- reminder email gets a fresh one), so the links live in their own table.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ------------------------------------------------------------ booking links
create table public.booking_links (
  token_hash  bytea primary key,
  booking_id  uuid not null references public.bookings (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index booking_links_booking_id_idx on public.booking_links (booking_id);
-- RLS on, and no policies: nobody reads this table through the website.
-- Only the functions below (and the server's secret key) use it.
alter table public.booking_links enable row level security;

-- When the reminder email went out, so it is only sent once.
alter table public.bookings add column reminder_sent_at timestamptz;

/** The fingerprint stored for a token. */
create or replace function private.token_hash(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

/** Makes a new secret link for a booking and returns the token (shown once, never stored). */
create or replace function private.new_manage_token(p_booking_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into public.booking_links (token_hash, booking_id) values (private.token_hash(v_token), p_booking_id);
  return v_token;
end;
$$;

/** The booking a token belongs to, or null for an unknown or malformed token. */
create or replace function private.booking_for_token(p_token text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select l.booking_id
  from public.booking_links l
  where p_token ~ '^[0-9a-f]{48}$'
    and l.token_hash = private.token_hash(p_token);
$$;

-- ------------------------------------------------- shared time rules
-- The rules for "may this booking start at this time?", used both when booking
-- and when moving a booking, so the two can never disagree. Raises the same
-- short error codes the app already turns into plain words.
create or replace function private.check_booking_time(
  p_shop public.shops,
  p_duration_minutes integer,
  p_starts_at timestamptz
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if p_starts_at is null then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;
  v_ends_at := p_starts_at + make_interval(mins => p_duration_minutes);

  -- Not too soon, not too far ahead
  if p_starts_at < now() + make_interval(mins => p_shop.min_notice_minutes) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;
  if p_starts_at > now() + make_interval(days => p_shop.booking_window_days) then
    raise exception 'too_far' using errcode = 'P0001';
  end if;

  -- Inside one block of opening hours, in the shop's own time zone, on one day
  v_local_start := p_starts_at at time zone p_shop.timezone;
  v_local_end := v_ends_at at time zone p_shop.timezone;
  if v_local_start::date <> v_local_end::date
     or not exists (
       select 1
       from public.opening_hours h
       where h.shop_id = p_shop.id
         and h.weekday = extract(isodow from v_local_start)
         and h.opens <= v_local_start::time
         and v_local_end::time <= h.closes
     ) then
    raise exception 'outside_hours' using errcode = 'P0001';
  end if;

  -- Not while the whole shop is closed
  if exists (
    select 1 from public.time_off t
    where t.shop_id = p_shop.id
      and t.staff_id is null
      and tstzrange(t.starts_at, t.ends_at) && tstzrange(p_starts_at, v_ends_at)
  ) then
    raise exception 'closed_then' using errcode = 'P0001';
  end if;
end;
$$;

-- ----------------------------------------------------- book_appointment
-- Same as before, but the time rules live in private.check_booking_time, and
-- it now returns the booking id plus the secret token for the customer's link.
drop function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid);
create function public.book_appointment(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_staff_id uuid default null
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

    begin
      insert into public.bookings (shop_id, service_id, staff_id, customer_name, customer_email, customer_phone, starts_at, ends_at)
      values (p_shop_id, p_service_id, v_staff, v_name, v_email, v_phone, p_starts_at, v_ends_at)
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

-- ------------------------------------------------ get_booking_by_token
-- What the customer's private page (and their emails) show. Only this one
-- booking, and only things the customer already knows or may see.
create or replace function public.get_booking_by_token(p_token text)
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
  shop_currency text
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
         s.id, s.slug, s.name, s.address, s.phone, s.timezone, s.currency
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  join public.services sv on sv.id = b.service_id
  join public.staff w on w.id = b.staff_id
  where b.id = private.booking_for_token(p_token);
$$;

-- --------------------------------------------- cancel_booking_by_token
-- The customer cancels. Only a live booking that hasn't started yet.
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
  update public.bookings set status = 'cancelled' where id = v_booking.id;
end;
$$;

-- ----------------------------------------- reschedule_booking_by_token
-- The customer moves their booking to a new time, with the same worker and
-- service. Every rule for a new booking applies to the new time.
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

-- ------------------------------------------------- issue_manage_token
-- A fresh link for the reminder email. Only the server (secret key) may call it.
create or replace function public.issue_manage_token(p_booking_id uuid)
returns text
language sql
volatile
security definer
set search_path = ''
as $$
  select private.new_manage_token(p_booking_id);
$$;

-- ================================================================ grants
revoke all on function private.token_hash(text) from public;
revoke all on function private.new_manage_token(uuid) from public;
revoke all on function private.booking_for_token(text) from public;
revoke all on function private.check_booking_time(public.shops, integer, timestamptz) from public;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid) from public;
revoke all on function public.get_booking_by_token(text) from public;
revoke all on function public.cancel_booking_by_token(text) from public;
revoke all on function public.reschedule_booking_by_token(text, timestamptz) from public;
revoke all on function public.issue_manage_token(uuid) from public, anon, authenticated;

grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid) to anon, authenticated;
grant execute on function public.get_booking_by_token(text) to anon, authenticated;
grant execute on function public.cancel_booking_by_token(text) to anon, authenticated;
grant execute on function public.reschedule_booking_by_token(text, timestamptz) to anon, authenticated;
grant execute on function public.issue_manage_token(uuid) to service_role;

-- The server's secret key (service_role) runs the daily reminder job and looks
-- up shop owners' emails. It gets only what that needs.
grant select on public.shops, public.services, public.staff to service_role;
grant select, update (reminder_sent_at) on public.bookings to service_role;

-- ------------------------------------------------------- daily email cap
-- Gmail allows about 500 emails a day. Bookbell stops at a lower number so a
-- flood of fake bookings can never get the sending account blocked.
create table private.email_counter (
  day   date primary key,
  sent  integer not null default 0
);

/** Counts one email for today; false once today's limit is reached. Server key only. */
create or replace function public.take_email_slot(p_limit integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sent integer;
begin
  insert into private.email_counter as c (day, sent)
  values (current_date, 1)
  on conflict (day) do update set sent = c.sent + 1
  returning c.sent into v_sent;
  return v_sent <= p_limit;
end;
$$;
revoke all on function public.take_email_slot(integer) from public, anon, authenticated;
grant execute on function public.take_email_slot(integer) to service_role;
