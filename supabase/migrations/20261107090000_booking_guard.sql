-- Booking guard: robots can no longer skip the booking form.
--
-- Before, any browser could call book_appointment straight from the outside
-- with the public key, which skipped the form's hidden checks (the trap field
-- and the "filled in too fast" check). Now only the website's server may call
-- it (service_role). The server first checks the form, then asks
-- take_booking_turn whether this visitor may try again, then books.
--
-- Because the server calls it, the database can no longer see who is signed
-- in (auth.uid()). The server passes the signed-in customer as p_customer_id
-- instead (it replaces p_save_to_account).

-- ------------------------------------------------------- booking_turns
-- One row per booking try. "visitor" is a one-way code the server makes from
-- the visitor's network address, so no address is stored.
create table public.booking_turns (
  id          bigint generated always as identity primary key,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  visitor     text not null check (char_length(visitor) between 8 and 128),
  created_at  timestamptz not null default now()
);
create index booking_turns_visitor_created_at_idx on public.booking_turns (visitor, created_at);
create index booking_turns_shop_id_created_at_idx on public.booking_turns (shop_id, created_at);
create index booking_turns_created_at_idx on public.booking_turns (created_at);

-- RLS on, no policies, no grants: only take_booking_turn touches it.
alter table public.booking_turns enable row level security;

-- Returns 'ok', 'visitor_limit', 'shop_limit' or 'shop_not_found'.
-- Limits are fixed here, so a caller can't raise them:
--   6 tries per visitor per shop per hour
--   20 tries per visitor per day, at all shops together
--   60 tries per shop per hour (many robots at once)
-- It is a separate call before book_appointment on purpose: a failed booking
-- undoes everything it wrote, so a count kept inside it would vanish.
create function public.take_booking_turn(p_shop_id uuid, p_visitor text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_visitor text := btrim(coalesce(p_visitor, ''));
begin
  if not exists (select 1 from public.shops where id = p_shop_id) then
    return 'shop_not_found';
  end if;
  if char_length(v_visitor) not between 8 and 128 then
    raise exception 'invalid_visitor' using errcode = 'P0001';
  end if;

  -- One visitor's tries are counted one at a time.
  perform pg_advisory_xact_lock(hashtextextended('booking_turn:' || v_visitor, 0));

  -- Old tries are never needed again.
  delete from public.booking_turns where created_at < now() - interval '2 days';

  if (
    select count(*) from public.booking_turns
    where shop_id = p_shop_id and visitor = v_visitor and created_at > now() - interval '1 hour'
  ) >= 6
  or (
    select count(*) from public.booking_turns
    where visitor = v_visitor and created_at > now() - interval '1 day'
  ) >= 20 then
    return 'visitor_limit';
  end if;

  if (
    select count(*) from public.booking_turns
    where shop_id = p_shop_id and created_at > now() - interval '1 hour'
  ) >= 60 then
    return 'shop_limit';
  end if;

  insert into public.booking_turns (shop_id, visitor) values (p_shop_id, v_visitor);
  return 'ok';
end;
$$;

-- ---------------------------------------------------- book_appointment
-- Same as before (20261105090000_customer_accounts.sql), except the customer
-- account comes from the server (p_customer_id) instead of auth.uid().
drop function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid, boolean);
create function public.book_appointment(
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

-- ================================================================ grants
-- Supabase gives new functions to anon and authenticated by default, and
-- "revoke from public" doesn't undo that, so both are named here.
revoke all on function public.take_booking_turn(uuid, text) from public, anon, authenticated;
grant execute on function public.take_booking_turn(uuid, text) to service_role;

revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid, uuid) to service_role;
