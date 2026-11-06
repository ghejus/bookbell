-- Fix for 20261114090000_shop_media.sql: inside the folder check, "name"
-- meant the shop's name (public.shops has a "name" column too), not the
-- file's name, so owners couldn't upload. Now it says objects.name.

drop policy "shop media: owner reads own folder" on storage.objects;
drop policy "shop media: owner adds to own folder" on storage.objects;
drop policy "shop media: owner replaces in own folder" on storage.objects;
drop policy "shop media: owner removes from own folder" on storage.objects;

create policy "shop media: owner reads own folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shop-media'
    and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(objects.name))[1])
  );
create policy "shop media: owner adds to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-media'
    and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(objects.name))[1])
  );
create policy "shop media: owner replaces in own folder" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'shop-media'
    and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(objects.name))[1])
  )
  with check (
    bucket_id = 'shop-media'
    and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(objects.name))[1])
  );
create policy "shop media: owner removes from own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-media'
    and exists (select 1 from public.shops s where s.owner_id = (select auth.uid()) and s.id::text = (storage.foldername(objects.name))[1])
  );
