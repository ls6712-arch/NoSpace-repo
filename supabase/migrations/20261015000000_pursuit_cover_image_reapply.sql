-- Pursuit cover image, applied for the first time.
--
-- This carries the contents of the pursuit_cover_image migration that was
-- committed under version 20261011000000, next to pending_cannot_join_pursuit_link
-- with the very same version. The live database recorded only
-- pending_cannot_join_pursuit_link under that version, so the cover columns,
-- constraints and storage policy below have never existed live. That file is
-- removed in the same change; this is the only copy.
--
-- A custom cover is stored as a path in the existing private "moment-media"
-- bucket (20260928184632_step1_moment_media_private.sql) rather than a new
-- bucket — same upload/signing pipeline Moments already use, no new infra.
-- When no custom cover is set, the frontend falls back to a real photo from
-- the Pursuit's own Moments (first or last, per cover_image_preference) —
-- that part needs no column of its own, it's derived client-side from posts
-- already visible to the viewer.
--
-- Safe to run once or more than once: the columns use IF NOT EXISTS, the two
-- constraints are added only when missing, and the policy is drop + create.

alter table public.pursuits
  add column if not exists cover_image_path text,
  add column if not exists cover_image_preference text not null default 'last';

do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.pursuits'::regclass
      and c.conname = 'pursuits_cover_image_preference_check'
  ) then
    alter table public.pursuits
      add constraint pursuits_cover_image_preference_check
      check (cover_image_preference in ('first', 'last'));
  end if;
end $$;

-- Same ownership shape as posts_media_paths_owned
-- (20260928184632_step1_moment_media_private.sql) — a cover path has to
-- live under the pursuit owner's own folder in the bucket, same as every
-- other upload there. A plain CHECK constraint is row-local (no FROM
-- clause, so no correlated-subquery ambiguity to qualify against) —
-- user_id here unambiguously means this row's own column.
do $$
begin
  if not exists (
    select 1 from pg_constraint c
    where c.conrelid = 'public.pursuits'::regclass
      and c.conname = 'pursuits_cover_image_path_owned'
  ) then
    alter table public.pursuits
      add constraint pursuits_cover_image_path_owned
      check (
        cover_image_path is null
        or (cover_image_path like user_id::text || '/%' and cover_image_path !~ '\.\.')
      );
  end if;
end $$;

-- The existing "moment-media: see photos of moments you can see" SELECT
-- policy only grants a non-owner read when the path appears in
-- public.posts.media_paths — a Pursuit's own cover_image_path is never in
-- that list, so a shared Pursuit's custom cover would 403 for anyone but
-- its owner. Redefining the same policy (DROP + CREATE, not editing the
-- migration that first created it) to add the parallel pursuits check,
-- reusing the exact same visibility rule the pursuits row itself already
-- uses — public.is_pursuit_participant() and the "owners, members and the
-- public (if shared) see a pursuit" policy, both from
-- 20260923110000_pursuits_measured_and_shared.sql — rather than
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
