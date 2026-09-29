insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('moment-media', 'moment-media', false, 26214400,
        array['image/jpeg','image/png','image/gif','image/webp','image/heic','image/heif',
              'video/mp4','video/webm','video/quicktime'])
on conflict (id) do nothing;

alter table public.posts
  add column if not exists media_paths text[] not null default '{}';

create or replace function private.media_paths_owned(paths text[], owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(p like owner::text || '/%' and p !~ '\.\.'), true)
  from unnest(paths) as p
$$;

alter table public.posts
  add constraint posts_media_paths_owned
  check (private.media_paths_owned(media_paths, user_id));

create index if not exists posts_media_paths_gin on public.posts using gin (media_paths);

create policy "moment-media: upload into your own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'moment-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "moment-media: replace your own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'moment-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'moment-media'
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "moment-media: delete your own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'moment-media'
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "moment-media: see photos of moments you can see"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'moment-media'
         and ((storage.foldername(name))[1] = (select auth.uid())::text
              or exists (select 1 from public.posts p
                         where p.media_paths @> array[name])));
