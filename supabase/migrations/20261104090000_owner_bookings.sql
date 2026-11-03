-- The owner's calendar: adding phone and walk-in bookings, and moving bookings.
--
-- Owners book through two narrow doors (owner_add_booking, owner_move_booking)
-- instead of writing to the bookings table directly. Each door checks that the
-- signed-in person owns the shop, the service and the worker. The owner is the
-- boss of their own calendar, so the customer rules (minimum notice, booking
-- window, opening hours, 3 bookings per email) don't apply here. The "one
-- worker can't be in two places" rule still does.

-- Walk-ins may have no email address.
alter table public.bookings drop constraint bookings_customer_email_check;
alter table public.bookings add constraint bookings_customer_email_check
  check (customer_email = '' or char_length(customer_email) between 3 and 200);

-- Owners could already change their bookings (to cancel them). They now also
-- can't point a booking at a service from another shop.
drop policy "bookings: owner updates" on public.bookings;
create policy "bookings: owner updates" on public.bookings
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid()))
    and exists (select 1 from public.services sv where sv.id = service_id and sv.shop_id = bookings.shop_id)
  );

-- ---------------------------------------------------- owner_add_booking
-- Adds a booking to the signed-in owner's shop and returns its id, plus a
-- secret link token (used in the confirmation email when there is an email).
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
    insert into public.bookings (shop_id, service_id, staff_id, customer_name, customer_email, customer_phone, starts_at, ends_at)
    values (v_shop_id, p_service_id, p_staff_id, v_name, v_email, v_phone, p_starts_at,
            p_starts_at + make_interval(mins => v_duration))
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

-- --------------------------------------------------- owner_move_booking
-- Moves one of the owner's live bookings to a new start time and/or worker.
-- It keeps its length. The reminder is sent again for the new time.
create or replace function public.owner_move_booking(p_booking_id uuid, p_starts_at timestamptz, p_staff_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
begin
  select b.* into v_booking
  from public.bookings b
  join public.shops s on s.id = b.shop_id
  where b.id = p_booking_id and s.owner_id = (select auth.uid())
  for update of b;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_booking.status <> 'booked' then
    raise exception 'not_booked' using errcode = 'P0001';
  end if;
  if p_starts_at is null then
    raise exception 'invalid_details' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.staff w where w.id = p_staff_id and w.shop_id = v_booking.shop_id) then
    raise exception 'staff_not_found' using errcode = 'P0001';
  end if;

  begin
    update public.bookings
    set starts_at = p_starts_at,
        ends_at = p_starts_at + (v_booking.ends_at - v_booking.starts_at),
        staff_id = p_staff_id,
        reminder_sent_at = null
    where id = v_booking.id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken' using errcode = 'P0001';
  end;
end;
$$;

-- Only signed-in owners; each function finds "their" shop from the login itself.
revoke all on function public.owner_add_booking(uuid, uuid, timestamptz, text, text, text) from public, anon;
revoke all on function public.owner_move_booking(uuid, timestamptz, uuid) from public, anon;
grant execute on function public.owner_add_booking(uuid, uuid, timestamptz, text, text, text) to authenticated;
grant execute on function public.owner_move_booking(uuid, timestamptz, uuid) to authenticated;
