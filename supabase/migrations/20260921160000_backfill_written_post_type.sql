-- "Written" becomes a real value of posts.type, not something Discover's
-- masonry feed infers from missing media.
--
-- No new column: type already exists and (checked against every sql/ and
-- supabase/migrations/ file, and the app's own insert in ContentContext.tsx)
-- carries no CHECK constraint — every constraint on it lives in application
-- code (Post.type / NewPostInput.type in src/app/data/posts.ts and
-- ContentContext.tsx), which this branch already widens to "photo" |
-- "video" | "written" alongside this migration.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved.
--
-- ── UP ──────────────────────────────────────────────────────────────────
-- Backfill: a pre-existing post with no real media was always typed
-- 'photo' regardless (the composer's `type` state defaulted to "photo" and
-- a caption-only "Write a moment"/text-only capture never changed it —
-- see Log.tsx's publish(), now fixed to compute this correctly going
-- forward). This corrects that mislabeling for every row it already
-- happened to, in both directions: no real media becomes 'written', and —
-- for symmetry, though the composer bug never produced this case — any row
-- somehow typed 'written' that does carry real media is corrected back to
-- 'photo' or 'video' from its media shape.
update public.posts
set type = 'written'
where type <> 'written'
  and (media_url is null or media_url = '')
  and (media_urls is null or coalesce(array_length(media_urls, 1), 0) = 0);

update public.posts
set type = case when media_url ~ '\.(mp4|mov|webm|m4v)([?#].*)?$' then 'video' else 'photo' end
where type = 'written'
  and (
    (media_url is not null and media_url <> '')
    or (media_urls is not null and coalesce(array_length(media_urls, 1), 0) > 0)
  );
