-- "Written" becomes a real value of posts.type, not something Discover's
-- masonry feed infers from missing media.
--
-- Depends on 20260921160000_widen_post_type_enum.sql having already run
-- and committed — this is the first migration that actually writes
-- 'written' into a row, which only works if that value is already legal
-- (a no-op if posts.type is plain text, but required first if it's a
-- native enum: Postgres won't let a value be used in the same transaction
-- that added it, so this has to be a separate migration either way).
--
-- No new column: type already exists and (checked against every sql/ and
-- supabase/migrations/ file, and the app's own insert in ContentContext.tsx)
-- carries no CHECK constraint — every constraint on it lives in application
-- code (Post.type / NewPostInput.type in src/app/data/posts.ts and
-- ContentContext.tsx), which this branch already widens to "photo" |
-- "video" | "written" alongside this migration. Whether the column itself
-- is a native enum or plain text couldn't be confirmed from this session
-- (network-blocked — see the previous migration's comment for the query to
-- run and confirm); this migration's own UPDATE statements work identically
-- either way, since Postgres compares/assigns an enum value the same way
-- once it's legal.
--
-- Draft only — staged for review. Do not run this against Supabase until
-- it's been approved.
--
-- ── UP ──────────────────────────────────────────────────────────────────
-- Backfill: a pre-existing post with no real media was always typed
-- 'photo' regardless (the composer's `type` state defaulted to "photo" and
-- a caption-only "Write a moment"/text-only capture never changed it —
-- see Log.tsx's publish(), now fixed to compute this correctly going
-- forward, via lib/momentType.ts's classifyMomentType). This corrects
-- that mislabeling for every row it already happened to, in both
-- directions: no real media becomes 'written', and — for symmetry, though
-- the composer bug never produced this case — any row somehow typed
-- 'written' that does carry real media is corrected back to 'photo' or
-- 'video' from its media shape, using the same "video wins" rule
-- classifyMomentType applies in the app: if any of its media (media_url or
-- any element of media_urls) looks like a video file, it's 'video';
-- otherwise 'photo'. mediaUrls is documented (data/posts.ts) as one Moment
-- carrying either several photos or exactly one video, never a real mix,
-- so in practice this can only ever match one or the other — the OR below
-- exists so the rule is stated the same way classifyMomentType states it,
-- not because mixed rows are expected to exist.
update public.posts
set type = 'written'
where type <> 'written'
  and (media_url is null or media_url = '')
  and (media_urls is null or coalesce(array_length(media_urls, 1), 0) = 0);

update public.posts
set type = case
  when media_url ~* '\.(mp4|mov|webm|m4v)([?#].*)?$' then 'video'
  when media_urls is not null and exists (
    select 1 from unnest(media_urls) as u(url) where u.url ~* '\.(mp4|mov|webm|m4v)([?#].*)?$'
  ) then 'video'
  else 'photo'
end
where type = 'written'
  and (
    (media_url is not null and media_url <> '')
    or (media_urls is not null and coalesce(array_length(media_urls, 1), 0) > 0)
  );
