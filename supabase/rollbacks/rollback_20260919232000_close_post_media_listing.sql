-- Reverses supabase/migrations/20260919232000_close_post_media_listing.sql.
create policy "post-media files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-media');
