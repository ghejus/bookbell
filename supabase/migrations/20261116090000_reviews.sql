-- Reviews.
--
-- 1. Only people who really came can review: the booking is still 'booked'
--    (not cancelled, not "didn't come"), it has ended, it was booked online by
--    the customer (not added by the owner, who could otherwise review their own
--    shop), and it ended at most 60 days ago. One review per booking.
-- 2. The proof is the booking's secret link (/b/<token>) or the customer's
--    account (bookings.customer_id).
-- 3. A review can be changed for 14 days after it was first written.
-- 4. The owner can write one public reply (and change it), but can't delete
--    or hide a review. If the owner later marks the visit "didn't come", the
--    review stops showing, because it no longer belongs to a real visit.
-- 5. The public only sees reviews through shop_reviews() and shop_rating(),
--    which never return the customer's email or phone.

-- ------------------------------------------------------------------ table
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null unique references public.bookings (id) on delete cascade,
  shop_id     uuid not null references public.shops (id) on delete cascade,
  stars       smallint not null check (stars between 1 and 5),
  body        text not null default '' check (char_length(body) <= 1000),
  -- "Ana P.": first name and the first letter of the last name.
  author      text not null default '' check (char_length(author) <= 60),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  reply       text check (char_length(reply) between 1 and 1000),
  replied_at  timestamptz
);
create index reviews_shop_created_idx on public.reviews (shop_id, created_at desc);
alter table public.reviews enable row level security;

-- Owners read their own shop's reviews. Nobody writes the table directly:
-- the functions below do it, with their checks.
create policy "reviews: owner reads own shop" on public.reviews
  for select to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to authenticated;

-- When the "How was it?" email went out, so it is only sent once.
alter table public.bookings add column review_asked_at timestamptz;

-- ------------------------------------------------------------- helpers
/** "Ana Maria Popescu" -> "Ana P.", "Ana" -> "Ana", "" -> "". */
create function private.review_author(p_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  with w as (select regexp_split_to_array(btrim(coalesce(p_name, '')), '\s+') as parts)
  select case
    when btrim(coalesce(p_name, '')) = '' then ''
    when cardinality(parts) = 1 then left(parts[1], 40)
    else left(parts[1], 40) || ' ' || upper(left(parts[cardinality(parts)], 1)) || '.'
  end
  from w;
$$;

/**
 * What the customer may do about a booking's review:
 *   'none'   – can't review (not a kept online visit, not over yet, or too long ago)
 *   'open'   – can write one
 *   'done'   – has written one and can still change it
 *   'locked' – has written one, too late to change
 */
create function private.review_state(p_booking public.bookings, p_review public.reviews)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_booking.status <> 'booked' or p_booking.source <> 'online' or p_booking.ends_at > now() then 'none'
    when p_review.id is not null then
      case when p_review.created_at > now() - interval '14 days' then 'done' else 'locked' end
    when p_booking.ends_at > now() - interval '60 days' then 'open'
    else 'none'
  end;
$$;

-- --------------------------------------------------------- leave_review
/**
 * Writes or changes the review for one booking. Give the secret link token, or
 * (signed in) the booking id of one of your own bookings. Errors: not_found,
 * not_yet (the visit hasn't ended), cant_review (cancelled, "didn't come",
 * added by the owner, or more than 60 days ago), locked (14 days to change it
 * are over), own_shop, bad_review (stars or length).
 */
create function public.leave_review(p_token text, p_booking_id uuid, p_stars integer, p_body text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_booking public.bookings;
  v_review public.reviews;
  v_body text := btrim(coalesce(p_body, ''));
  v_state text;
begin
  if p_stars is null or p_stars not between 1 and 5 or char_length(v_body) > 1000 then
    raise exception 'bad_review';
  end if;

  if p_token is not null then
    v_id := private.booking_for_token(p_token);
  elsif p_booking_id is not null and (select auth.uid()) is not null then
    select b.id into v_id from public.bookings b where b.id = p_booking_id and b.customer_id = (select auth.uid());
  end if;
  if v_id is null then
    raise exception 'not_found';
  end if;

  select * into v_booking from public.bookings where id = v_id for update;
  if exists (select 1 from public.shops s where s.id = v_booking.shop_id and s.owner_id = (select auth.uid())) then
    raise exception 'own_shop';
  end if;

  select * into v_review from public.reviews where booking_id = v_id;
  v_state := private.review_state(v_booking, v_review);
  if v_state = 'none' then
    if v_booking.status = 'booked' and v_booking.ends_at > now() then
      raise exception 'not_yet';
    end if;
    raise exception 'cant_review';
  elsif v_state = 'locked' then
    raise exception 'locked';
  elsif v_state = 'done' then
    update public.reviews set stars = p_stars, body = v_body, updated_at = now() where id = v_review.id;
    return v_review.id;
  end if;

  insert into public.reviews (booking_id, shop_id, stars, body, author)
  values (v_id, v_booking.shop_id, p_stars, v_body, private.review_author(v_booking.customer_name))
  returning id into v_review.id;
  return v_review.id;
end;
$$;

-- ---------------------------------------------- the customer's own review
/** For the /b/<token> page: may this booking be reviewed, and the review if written. */
create function public.review_by_token(p_token text)
returns table (
  state text,
  stars smallint,
  body text,
  reply text,
  editable_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select private.review_state(b, r), r.stars, r.body, r.reply, r.created_at + interval '14 days'
  from public.bookings b
  left join public.reviews r on r.booking_id = b.id
  where b.id = private.booking_for_token(p_token);
$$;

/** For My bookings: every one of the signed-in person's bookings that has or may get a review. */
create function public.my_reviews()
returns table (
  booking_id uuid,
  state text,
  stars smallint,
  body text,
  reply text,
  editable_until timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, private.review_state(b, r), r.stars, r.body, r.reply, r.created_at + interval '14 days'
  from public.bookings b
  left join public.reviews r on r.booking_id = b.id
  where (select auth.uid()) is not null
    and b.customer_id = (select auth.uid())
    and private.review_state(b, r) <> 'none';
$$;

-- --------------------------------------------------------- public reading
/** A shop's reviews, newest first, for the shop page. Only kept visits. */
create function public.shop_reviews(p_shop_id uuid, p_limit integer default 20, p_offset integer default 0)
returns table (
  id uuid,
  stars smallint,
  body text,
  author text,
  service_name text,
  created_at timestamptz,
  reply text,
  replied_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.stars, r.body, r.author, sv.name, r.created_at, r.reply, r.replied_at
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  join public.services sv on sv.id = b.service_id
  where r.shop_id = p_shop_id and b.status = 'booked'
  order by r.created_at desc, r.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

/** Average stars (one decimal), how many reviews, and how many of each star (index 1 = one star). */
create function public.shop_rating(p_shop_id uuid)
returns table (average numeric, total integer, counts integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select round(avg(r.stars)::numeric, 1),
         count(*)::integer,
         array[
           count(*) filter (where r.stars = 1)::integer,
           count(*) filter (where r.stars = 2)::integer,
           count(*) filter (where r.stars = 3)::integer,
           count(*) filter (where r.stars = 4)::integer,
           count(*) filter (where r.stars = 5)::integer
         ]
  from public.reviews r
  join public.bookings b on b.id = r.booking_id
  where r.shop_id = p_shop_id and b.status = 'booked';
$$;

-- ------------------------------------------------------------ owner reply
/** The owner's public reply under a review. An empty reply removes it. Errors: not_found, too_long. */
create function public.reply_to_review(p_review_id uuid, p_reply text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  if char_length(v_reply) > 1000 then
    raise exception 'too_long';
  end if;
  update public.reviews r
  set reply = v_reply, replied_at = case when v_reply is null then null else now() end
  where r.id = p_review_id
    and exists (select 1 from public.shops s where s.id = r.shop_id and s.owner_id = (select auth.uid()));
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- ================================================================ grants
revoke all on function private.review_author(text) from public;
revoke all on function private.review_state(public.bookings, public.reviews) from public;

revoke all on function public.leave_review(text, uuid, integer, text) from public;
grant execute on function public.leave_review(text, uuid, integer, text) to anon, authenticated;
revoke all on function public.review_by_token(text) from public;
grant execute on function public.review_by_token(text) to anon, authenticated;
revoke all on function public.my_reviews() from public, anon;
grant execute on function public.my_reviews() to authenticated;
revoke all on function public.shop_reviews(uuid, integer, integer) from public;
grant execute on function public.shop_reviews(uuid, integer, integer) to anon, authenticated;
revoke all on function public.shop_rating(uuid) from public;
grant execute on function public.shop_rating(uuid) to anon, authenticated;
revoke all on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;
