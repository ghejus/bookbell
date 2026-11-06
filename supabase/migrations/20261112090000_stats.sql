-- The owner's Stats page: one call returns the numbers for a time range.
--
-- Runs as the caller (security invoker), so the usual locks (RLS) keep it to
-- the signed-in owner's own shop. Bookings count by when they start. Days and
-- hours are in the shop's own time zone. Money uses the price each booking
-- was made at (bookings.price_cents).
--
--   kept          visits that happened ('booked' and already over)
--   upcoming      still to come in the range
--   no_shows      marked "didn't come"
--   cancelled     cancelled
--   online        booked online (not cancelled)
--   active        not cancelled (kept + upcoming + no-shows)
--   revenue_cents takings from kept visits
--   booked_cents  takings still to come in the range
--   customers     different people with a kept or upcoming visit
--   by_weekday    [{day: 1..7 (Mon..Sun), n}]   kept + upcoming
--   by_hour       [{hour: 0..23, n}]            kept + upcoming
--   top_services  up to 5 [{name, n, cents}]    kept + upcoming
create function public.owner_stats(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with b as (
    select bk.status, bk.source, bk.ends_at, bk.price_cents, bk.customer_key, bk.service_id,
           bk.starts_at at time zone s.timezone as local_start
    from public.bookings bk
    join public.shops s on s.id = bk.shop_id and s.owner_id = (select auth.uid())
    where bk.starts_at >= p_from
      and bk.starts_at < p_to
      and p_to > p_from
      and p_to - p_from <= interval '400 days'
  ),
  live as (select * from b where status = 'booked')
  select jsonb_build_object(
    'kept', (select count(*) from live where ends_at <= now()),
    'upcoming', (select count(*) from live where ends_at > now()),
    'no_shows', (select count(*) from b where status = 'no_show'),
    'cancelled', (select count(*) from b where status = 'cancelled'),
    'online', (select count(*) from b where status <> 'cancelled' and source = 'online'),
    'active', (select count(*) from b where status <> 'cancelled'),
    'revenue_cents', (select coalesce(sum(price_cents), 0) from live where ends_at <= now()),
    'booked_cents', (select coalesce(sum(price_cents), 0) from live where ends_at > now()),
    'customers', (select count(distinct customer_key) from live),
    'by_weekday', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d, 'n', n) order by d), '[]'::jsonb)
      from (select extract(isodow from local_start)::integer as d, count(*) as n from live group by 1) x
    ),
    'by_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'n', n) order by h), '[]'::jsonb)
      from (select extract(hour from local_start)::integer as h, count(*) as n from live group by 1) x
    ),
    'top_services', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'n', n, 'cents', cents) order by n desc, name), '[]'::jsonb)
      from (
        select sv.name, count(*) as n, coalesce(sum(live.price_cents), 0) as cents
        from live join public.services sv on sv.id = live.service_id
        group by sv.name
        order by count(*) desc, sv.name
        limit 5
      ) x
    )
  );
$$;

revoke all on function public.owner_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.owner_stats(timestamptz, timestamptz) to authenticated;
