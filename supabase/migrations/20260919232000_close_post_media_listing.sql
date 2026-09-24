-- Storage hardening: replaces the unconditional SELECT policy on
-- storage.objects for post-media with one scoped to each uploader's own
-- folder, matching the write policies exactly. getPublicUrl() links keep
-- working (that endpoint is gated by the bucket's own `public = true`
-- flag, not by this policy), but listing/querying storage.objects for
-- someone else's folder — or the whole bucket — stops returning anything.
-- Draft only.
--
-- Confirmed by grepping all of src/: the app never calls .list(),
-- .download(), or createSignedUrl against post-media (every read goes
-- through getPublicUrl(), in exactly three places: AvatarPicker.tsx,
-- SocialContext.tsx, ContentContext.tsx), and never calls .remove() on it
-- at all. AvatarPicker.tsx does call .upload() with upsert: true, which
-- needs to check for an existing object at that path before deciding
-- insert vs. replace — that check is scoped to
-- `${user.id}/avatars/...`, i.e. always the caller's own folder, so the
-- owner-scoped SELECT policy below covers it.
drop policy if exists "post-media files are publicly readable" on storage.objects;

create policy "you see your own post-media files"
  on storage.objects for select
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
