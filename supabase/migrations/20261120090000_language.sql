-- Languages (English and Romanian).
--
-- Each booking and waitlist wish remembers the customer's language, so the
-- emails about it are in that language. Each shop remembers its owner's
-- language, for the emails the owner gets.

alter table public.bookings add column lang text not null default 'en' check (lang in ('en', 'ro'));
alter table public.waitlist add column lang text not null default 'en' check (lang in ('en', 'ro'));
alter table public.shops add column lang text not null default 'en' check (lang in ('en', 'ro'));

-- ---------------------------------------------------------- join_waitlist
-- Same as before (20261118090000_waitlist.sql), plus the customer's language.
drop function public.join_waitlist(uuid, uuid, date, text);
create function public.join_waitlist(p_service_id uuid, p_staff_id uuid, p_day date, p_phone text, p_lang text default 'en')
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
  v_lang text := case when p_lang in ('en', 'ro') then p_lang else 'en' end;
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
    update public.waitlist set phone = case when v_phone <> '' then v_phone else phone end, lang = v_lang where id = v_id;
    return v_id;
  end if;

  if (select count(*) from public.waitlist w where w.customer_id = v_uid and w.day >= v_today - 1) >= 5 then
    raise exception 'too_many_waits';
  end if;

  insert into public.waitlist (shop_id, service_id, staff_id, day, customer_id, name, email, phone, lang)
  values (
    v_shop.id, p_service_id, p_staff_id, p_day, v_uid,
    left(coalesce(v_user.raw_user_meta_data ->> 'full_name', ''), 120),
    left(coalesce(v_user.email, ''), 254),
    v_phone,
    v_lang
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.join_waitlist(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.join_waitlist(uuid, uuid, date, text, text) to authenticated;
