-- More than one worker per shop.
--
-- Each booking now belongs to one worker, and the "no overlapping bookings" rule
-- works per worker: two barbers can each take a 10:00 booking, but one barber
-- can't be booked twice at 10:00. Workers use the shop's opening hours and can
-- have their own days off (time_off rows with a staff_id). A time_off row with
-- no staff_id still closes the whole shop.

-- ---------------------------------------------------------------- staff
create table public.staff (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  -- Lets bookings and days off point at (worker, shop) together, so a worker
  -- from one shop can never be used in another shop's booking.
  constraint staff_id_shop_id_key unique (id, shop_id)
);
create index staff_shop_id_idx on public.staff (shop_id);

alter table public.staff enable row level security;

-- Same pattern as services: customers see active workers; the owner sees and changes all.
create policy "staff: read active, or own" on public.staff
  for select to anon, authenticated
  using (active or exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "staff: owner inserts" on public.staff
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "staff: owner updates" on public.staff
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "staff: owner deletes" on public.staff
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

grant select on public.staff to anon, authenticated;
grant insert, update, delete on public.staff to authenticated;

-- Every shop starts with one worker called "Me", which the owner can rename.
-- Runs as the person making the shop, so the usual locks apply.
create or replace function public.add_first_worker()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.staff (shop_id, name) values (new.id, 'Me');
  return new;
end;
$$;
revoke all on function public.add_first_worker() from public;

create trigger shops_add_first_worker
  after insert on public.shops
  for each row execute function public.add_first_worker();

-- Shops made before today get their first worker now.
insert into public.staff (shop_id, name)
select s.id, 'Me' from public.shops s
where not exists (select 1 from public.staff w where w.shop_id = s.id);

-- ------------------------------------------------------------- bookings
alter table public.bookings add column staff_id uuid;

update public.bookings b
set staff_id = (select w.id from public.staff w where w.shop_id = b.shop_id order by w.created_at limit 1)
where b.staff_id is null;

alter table public.bookings
  alter column staff_id set not null,
  -- "no action" (not "restrict") checks at the end of the statement, so deleting a
  -- whole shop, which removes its workers and bookings together, still works.
  -- Deleting just a worker who has bookings is still refused.
  add constraint bookings_staff_fk foreign key (staff_id, shop_id)
    references public.staff (id, shop_id) on delete no action;

-- The same fix for services: "restrict" could refuse deleting a whole shop.
alter table public.bookings
  drop constraint bookings_service_id_fkey,
  add constraint bookings_service_id_fkey foreign key (service_id)
    references public.services (id) on delete no action;
create index bookings_staff_id_idx on public.bookings (staff_id);

-- One worker can't have two live bookings at the same time (was: one per shop).
alter table public.bookings drop constraint bookings_no_overlap;
alter table public.bookings add constraint bookings_no_overlap exclude using gist (
  staff_id with =,
  tstzrange(starts_at, ends_at) with &&
) where (status = 'booked');

-- ------------------------------------------------------------- time off
-- Empty staff_id: the whole shop is closed. Otherwise only that worker is off.
alter table public.time_off
  add column staff_id uuid,
  add constraint time_off_staff_fk foreign key (staff_id, shop_id)
    references public.staff (id, shop_id) on delete cascade;
create index time_off_staff_id_idx on public.time_off (staff_id);

-- ------------------------------------------------------- get_busy_times
-- Now also says whose time is taken (staff_id), or empty when the whole shop is
-- closed. Still never names, emails, phones or reasons.
drop function public.get_busy_times(uuid, timestamptz, timestamptz);
create function public.get_busy_times(p_shop_id uuid, p_from timestamptz, p_to timestamptz)
returns table (starts_at timestamptz, ends_at timestamptz, staff_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at, b.ends_at, b.staff_id
  from public.bookings b
  where b.shop_id = p_shop_id
    and b.status = 'booked'
    and b.starts_at < p_to
    and b.ends_at > p_from
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

-- ----------------------------------------------------- book_appointment
-- Same rules as before, plus "who": a chosen worker (p_staff_id), or, when it is
-- empty, "anyone". For "anyone" the least busy worker that day goes first; if
-- someone else just took that worker's time, the next worker is tried.
drop function public.book_appointment(uuid, uuid, timestamptz, text, text, text);
create function public.book_appointment(
  p_shop_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text default '',
  p_staff_id uuid default null
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

  -- Not while the whole shop is closed
  if exists (
    select 1 from public.time_off t
    where t.shop_id = p_shop_id
      and t.staff_id is null
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
               and (b.starts_at at time zone v_shop.timezone)::date = v_local_start::date
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
      return v_id;
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

revoke all on function public.get_busy_times(uuid, timestamptz, timestamptz) from public;
revoke all on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid) from public;
grant execute on function public.get_busy_times(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, timestamptz, text, text, text, uuid) to anon, authenticated;
