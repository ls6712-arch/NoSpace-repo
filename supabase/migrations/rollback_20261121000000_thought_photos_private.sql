-- Undoes 20261121000000_thought_photos_private.sql. Photos already uploaded
-- under it stay in moment-media; their rows lose media_path with the column, so
-- run this only before any thought photo has been added through the new path.
drop policy if exists "moment-media: see photos on thoughts you can see" on storage.objects;
drop index if exists public.thoughts_media_path_idx;
alter table public.thoughts drop constraint if exists thoughts_media_one_source;
alter table public.thoughts drop constraint if exists thoughts_media_path_owned;
alter table public.thoughts drop column if exists media_path;
