-- Rollback for 20260923000000_widen_participations_kind_for_dm.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the exact prior constraint and both prior policy bodies from
-- docs/schema-baseline-20260920.sql and sql/social.sql section 7.
--
-- Not safe to run blind: if any row has kind = 'direct_message' by the
-- time this runs, re-adding the narrower participations_kind_check will
-- fail (existing rows are validated against a constraint added via ALTER
-- TABLE unless NOT VALID is used, which this deliberately doesn't — same
-- reasoning as rollback_20260922060000_widen_posts_type_check.sql). Delete
-- those rows (and any messages hanging off them, which cascade on
-- participation delete per messages.participation_id's own foreign key)
-- first if you actually mean to undo this.
--
-- ── DOWN ────────────────────────────────────────────────────────────────
alter table public.participations drop constraint if exists participations_kind_check;
alter table public.participations add constraint participations_kind_check
  check (kind = any (array['join_in'::text, 'make_together'::text, 'explore_together'::text]));

drop policy if exists "messages need an accepted participation" on public.messages;
create policy "messages need an accepted participation"
  on public.messages for select
  using (
    exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together', 'explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );

drop policy if exists "you can write in an accepted thread" on public.messages;
create policy "you can write in an accepted thread"
  on public.messages for insert to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.status = 'accepted'
        and p.kind in ('make_together', 'explore_together')
        and (auth.uid() = p.from_user or auth.uid() = p.to_user)
    )
  );
