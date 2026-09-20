-- Reverses supabase/migrations/20260919232000_close_post_media_listing.sql.
drop policy if exists "you see your own post-media files" on storage.objects;

create policy "post-media files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-media');
