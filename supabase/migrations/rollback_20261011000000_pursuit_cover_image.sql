-- Rollback for 20261011000000_pursuit_cover_image.sql.
drop policy if exists "moment-media: see photos of moments you can see" on storage.objects;
create policy "moment-media: see photos of moments you can see"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'moment-media'
         and ((storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
              or exists (select 1 from public.posts p
                         where p.media_paths @> array[storage.objects.name])));

alter table public.pursuits
  drop constraint if exists pursuits_cover_image_path_owned,
  drop constraint if exists pursuits_cover_image_preference_check,
  drop column if exists cover_image_path,
  drop column if exists cover_image_preference;
