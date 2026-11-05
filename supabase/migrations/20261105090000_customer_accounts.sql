-- Customer accounts: "My bookings".
--
-- A booking made while signed in remembers who made it (customer_id), so the
-- customer sees all their bookings in one place. Booking without an account
-- still works exactly as before.
--
-- Safety: bookings are never linked to an account just because the email
-- matches. Sign-ups don't confirm the email, so anyone could sign up with
-- someone else's address. A guest booking joins an account only by its
-- secret link (claim_booking_by_token), which only the customer has.
--
-- Also: each booking now says how it came in (source), so the owner sees
-- "Booked online" or "Added by you".

-- ------------------------------------------------------------- columns
alter table public.bookings
  add column customer_id uuid references auth.users (id) on delete set null,
  add column source text not null default 'online' check (source in ('online', 'owner'));
create index bookings_customer_id_idx on public.bookings (customer_id) where customer_id is not null;

-- Bookings without an email were walk-ins the owner typed in.
update public.bookings set source = 'owner' where customer_email = '';

-- Owners change their bookings directly only to cancel them (moving goes
-- through owner_move_booking). So that is the only column they may write:
-- nobody can quietly change whose booking it is, or how it came in.
revoke update on public.bookings from anon, authenticated;
grant update (status) on public.bookings to authenticated;

-- ---------------------------------------------------- book_appointment
-- Same as before (20261103120000_manage_link.sql), plus: the signed-in
-- person (if any) is stored as the customer. p_save_to_account = false
-- leaves it out (the demo uses it to fill a sample shop with other people's
-- bookings).
drop function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid);
create function public.book_appointment(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_staff_id uuid default null,
  p_save_to_account boolean default true
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
              case when p_save_to_account then (select auth.uid()) end, 'online')
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

-- --------------------------------------------------- owner_add_booking
-- Same as before (20261104090000_owner_bookings.sql), plus: marked as added
-- by the owner, and never linked to the owner's own account as the customer.
create or replace function public.owner_add_booking(
  p_service_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text default '',
  p_customer_phone text default ''
)
returns table (booking_id uuid, manage_token text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_shop_id uuid;
  v_duration integer;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_email text := lower(btrim(coalesce(p_customer_email, '')));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
  v_id uuid;
begin
  select s.id into v_shop_id from public.shops s where s.owner_id = (select auth.uid());
  if v_shop_id is null then
    raise exception 'shop_not_found' using errcode = 'P0001';
  end if;

  select sv.duration_minutes into v_duration
  from public.services sv where sv.id = p_service_id and sv.shop_id = v_shop_id;
  if v_duration is null then
    raise exception 'service_not_found' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff w where w.id = p_staff_id and w.shop_id = v_shop_id) then
    raise exception 'staff_not_found' using errcode = 'P0001';
  end if;

  if char_length(v_name) not between 1 and 80
     or (v_email <> '' and (char_length(v_email) not between 3 and 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'))
     or char_length(v_phone) > 40
     or p_starts_at is null then
    raise exception 'invalid_details' using errcode = 'P0001';
  end if;

  begin
    insert into public.bookings (shop_id, service_id, staff_id, customer_name, customer_email, customer_phone, starts_at, ends_at, source)
    values (v_shop_id, p_service_id, p_staff_id, v_name, v_email, v_phone, p_starts_at,
            p_starts_at + make_interval(mins => v_duration), 'owner')
    returning id into v_id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;

  booking_id := v_id;
  manage_token := private.new_manage_token(v_id);
  return next;
end;
$$;

-- ---------------------------------------------------------- my_bookings
-- The signed-in person's own bookings, at every shop, newest last.
-- Only what the customer already knows (the same fields as their private page).
create or replace function public.my_bookings()
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
  shop_currency text
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
         s.slug, s.name, s.address, s.timezone, s.currency
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  join public.services sv on sv.id = b.service_id
  join public.staff w on w.id = b.staff_id
  where (select auth.uid()) is not null
    and b.customer_id = (select auth.uid())
  order by b.starts_at;
$$;

-- ----------------------------------------------------- my_booking_link
-- A fresh secret link for one of your own bookings. "Change time" and
-- "Cancel" in My bookings then use the same page and rules as the link in
-- the confirmation email.
create or replace function public.my_booking_link(p_booking_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.bookings b where b.id = p_booking_id and b.customer_id = (select auth.uid())
  ) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return private.new_manage_token(p_booking_id);
end;
$$;

-- ----------------------------------------------- claim_booking_by_token
-- "Add to My bookings" on the private booking page: links a booking made as
-- a guest to the signed-in account. Holding the secret link is the proof.
create or replace function public.claim_booking_by_token(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := private.booking_for_token(p_token);
  v_owner uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_signed_in' using errcode = 'P0001';
  end if;
  select customer_id into v_owner from public.bookings where id = v_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_owner is not null and v_owner <> (select auth.uid()) then
    raise exception 'other_account' using errcode = 'P0001';
  end if;
  update public.bookings set customer_id = (select auth.uid()) where id = v_id;
end;
$$;

-- ------------------------------------------------- booking_saved_by_token
-- For the private booking page: is this booking in the signed-in person's
-- My bookings ('mine'), in someone else's ('other'), or in nobody's ('none')?
create or replace function public.booking_saved_by_token(p_token text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
           when b.customer_id is null then 'none'
           when b.customer_id = (select auth.uid()) then 'mine'
           else 'other'
         end
  from public.bookings b
  where b.id = private.booking_for_token(p_token);
$$;

-- ================================================================ grants
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid, boolean) from public;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid, boolean) to anon, authenticated;

revoke all on function public.my_bookings() from public;
revoke all on function public.my_booking_link(uuid) from public;
revoke all on function public.claim_booking_by_token(text) from public;
revoke all on function public.booking_saved_by_token(text) from public;

grant execute on function public.my_bookings() to authenticated;
grant execute on function public.my_booking_link(uuid) to authenticated;
grant execute on function public.claim_booking_by_token(text) to authenticated;
grant execute on function public.booking_saved_by_token(text) to anon, authenticated;
