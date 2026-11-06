-- Daily cleanup of old "Try a demo shop" accounts.
--
-- Every demo visitor gets their own anonymous account with a sample shop.
-- After a few days nobody comes back to it, so a daily job
-- (/api/cron/cleanup) deletes it. Deleting the account deletes the shop, and
-- the shop takes its services, hours, workers, bookings and links with it.
--
-- This lists which accounts are old enough. Only the server may call it.
create function public.old_demo_accounts(p_days integer default 3, p_limit integer default 200)
returns table (user_id uuid, shop_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, s.id
  from auth.users u
  left join public.shops s on s.owner_id = u.id
  where u.is_anonymous
    and u.created_at < now() - make_interval(days => greatest(p_days, 1))
  order by u.created_at
  limit least(greatest(p_limit, 1), 1000);
$$;

revoke all on function public.old_demo_accounts(integer, integer) from public, anon, authenticated;
grant execute on function public.old_demo_accounts(integer, integer) to service_role;
