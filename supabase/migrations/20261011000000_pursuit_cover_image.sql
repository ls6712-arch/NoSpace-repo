-- Pursuit cover image: an optional custom cover, stored as a path in the
-- existing private "moment-media" bucket (20260928184632_step1_moment_media
-- _private.sql) rather than a new bucket — same upload/signing pipeline
-- Moments already use, no new infra. When no custom cover is set, the
-- frontend falls back to a real photo from the Pursuit's own Moments
-- (first or last, per cover_image_preference) — that part needs no column
-- of its own, it's derived client-side from posts already visible to the
-- viewer.
alter table public.pursuits
  add column if not exists cover_image_path text,
  add column if not exists cover_image_preference text not null default 'last';

alter table public.pursuits
  add constraint pursuits_cover_image_preference_check
  check (cover_image_preference in ('first', 'last'));

-- Same ownership shape as posts_media_paths_owned
-- (20260928184632_step1_moment_media_private.sql) — a cover path has to
-- live under the pursuit owner's own folder in the bucket, same as every
-- other upload there. A plain CHECK constraint is row-local (no FROM
-- clause, so no correlated-subquery ambiguity to qualify against) —
-- user_id here unambiguously means this row's own column.
alter table public.pursuits
  add constraint pursuits_cover_image_path_owned
  check (
    cover_image_path is null
    or (cover_image_path like user_id::text || '/%' and cover_image_path !~ '\.\.')
  );

-- The existing "moment-media: see photos of moments you can see" SELECT
-- policy only grants a non-owner read when the path appears in
-- public.posts.media_paths — a Pursuit's own cover_image_path was never in
-- that list, so a shared Pursuit's custom cover would 403 for anyone but
-- its owner. Redefining the same policy (DROP + CREATE, not editing the
-- migration that first created it — see CLAUDE.md's git rule) to add the
-- parallel pursuits check, reusing the exact same visibility rule the
-- pursuits row itself already uses — public.is_pursuit_participant() and
-- the "owners, members and the public (if shared) see a pursuit" policy,
-- both from 20260923110000_pursuits_measured_and_shared.sql — rather than
-- re-deriving it here against pursuit_members directly.
drop policy if exists "moment-media: see photos of moments you can see" on storage.objects;
create policy "moment-media: see photos of moments you can see"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'moment-media'
    and (
      (storage.foldername(storage.objects.name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.posts p
        where p.media_paths @> array[storage.objects.name]
      )
      or exists (
        select 1 from public.pursuits pu
        where pu.cover_image_path = storage.objects.name
          and (
            pu.user_id = (select auth.uid())
            or pu.shared = true
            or public.is_pursuit_participant(pu.id, (select auth.uid()))
          )
      )
    )
  );
