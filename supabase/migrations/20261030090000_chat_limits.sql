-- Phase 4: limits for the AI chat helper on the public shop page.
--
-- Each chat message a customer sends costs one "turn". The website asks
-- take_chat_turn(...) before it lets the AI answer, and the database says
-- yes or no. Limits are fixed here, not sent by the caller, so a hand-made
-- request can't raise them:
--   20 turns per visitor per shop per hour (stops one person spamming)
--   300 turns per shop per day (protects the AI bill)
-- "visitor" is a one-way hash the website makes from the visitor's network
-- address and the shop, so no address is ever stored.

create table public.chat_turns (
  id          bigint generated always as identity primary key,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  visitor     text not null check (char_length(visitor) between 8 and 128),
  created_at  timestamptz not null default now()
);
create index chat_turns_shop_id_created_at_idx on public.chat_turns (shop_id, created_at);
create index chat_turns_shop_visitor_created_at_idx on public.chat_turns (shop_id, visitor, created_at);

-- RLS on, no policies, no grants: nobody reads or writes this table directly.
-- Only take_chat_turn below touches it.
alter table public.chat_turns enable row level security;

-- Returns 'ok', 'visitor_limit', 'shop_limit' or 'shop_not_found'.
create or replace function public.take_chat_turn(p_shop_id uuid, p_visitor text)
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

  -- One shop's turns are counted one at a time, so two quick messages
  -- can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtextextended(p_shop_id::text, 0));

  -- Old turns are never needed again.
  delete from public.chat_turns
  where shop_id = p_shop_id and created_at < now() - interval '2 days';

  if (
    select count(*) from public.chat_turns
    where shop_id = p_shop_id and visitor = v_visitor and created_at > now() - interval '1 hour'
  ) >= 20 then
    return 'visitor_limit';
  end if;

  if (
    select count(*) from public.chat_turns
    where shop_id = p_shop_id and created_at > now() - interval '1 day'
  ) >= 300 then
    return 'shop_limit';
  end if;

  insert into public.chat_turns (shop_id, visitor) values (p_shop_id, v_visitor);
  return 'ok';
end;
$$;

revoke all on function public.take_chat_turn(uuid, text) from public;
grant execute on function public.take_chat_turn(uuid, text) to anon, authenticated;
