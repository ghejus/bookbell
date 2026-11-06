-- Shop pictures: a logo and up to 6 photos, shown on the public booking page.
--
-- Files live in the Storage bucket "shop-media", in a folder named after the
-- shop's id ("<shop id>/<file>"). Anyone can see them (public bucket); only the
-- shop's owner can add, replace or remove files in their own folder. The demo
-- shops share ready-made pictures in "demo/", uploaded once by the server.
-- Only JPEG, PNG and WebP, at most 2 MB (the app shrinks pictures before
-- uploading). No SVG: an SVG in a public bucket could carry a script.

-- ---------------------------------------------------------------- bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-media', 'shop-media', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- "Is this file in the folder of a shop the signed-in person owns?" is written
-- out in each rule. (Shops are public to read, so no special function is needed.)
create policy "shop media: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'shop-media' and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]));
create policy "shop media: owner adds to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shop-media' and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]));
create policy "shop media: owner replaces in own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'shop-media' and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'shop-media' and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]));
create policy "shop media: owner removes from own folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shop-media' and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(name))[1]));

-- ------------------------------------------------------------------ logo
alter table public.shops
  add column logo_path text
    check (
      logo_path is null
      or (char_length(logo_path) <= 200
          and (logo_path like id::text || '/%' or logo_path like 'demo/%'))
    );

-- ---------------------------------------------------------------- photos
create table public.shop_photos (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  path        text not null
    check (char_length(path) <= 200 and (path like shop_id::text || '/%' or path like 'demo/%')),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (shop_id, path)
);
create index shop_photos_shop_id_idx on public.shop_photos (shop_id, position);

alter table public.shop_photos enable row level security;

create policy "shop photos: anyone reads" on public.shop_photos
  for select to anon, authenticated using (true);
create policy "shop photos: owner adds" on public.shop_photos
  for insert to authenticated
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "shop photos: owner changes" on public.shop_photos
  for update to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));
create policy "shop photos: owner removes" on public.shop_photos
  for delete to authenticated
  using (exists (select 1 from public.shops s where s.id = shop_id and s.owner_id = (select auth.uid())));

revoke all on public.shop_photos from anon, authenticated;
grant select on public.shop_photos to anon, authenticated;
grant insert, update (position), delete on public.shop_photos to authenticated;

-- At most 6 photos a shop. One shop's photos are counted one at a time.
create function private.limit_shop_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('shop_photos:' || new.shop_id::text, 0));
  if (select count(*) from public.shop_photos p where p.shop_id = new.shop_id) >= 6 then
    raise exception 'too_many_photos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_shop_photos() from public;

create trigger shop_photos_limit
  before insert on public.shop_photos
  for each row execute function private.limit_shop_photos();
