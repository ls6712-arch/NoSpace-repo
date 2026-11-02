-- Log a Moment: nothing is required, and every log can punch a card.
--
-- Run AFTER 20261106000000_space_events_listing_fields.sql. Applied only with the founder's
-- written approval naming this file (CLAUDE.md).
--
-- 1. posts.hobby_slug may be null. Picking a Corner (or a Pursuit) is optional in Log now, and
--    a Moment with nothing picked used to be filed under the first visible Space
--    (defaultSpaceSlug()), which nobody chose. With nothing picked the Moment now has no Space.
--    A new check keeps the one combination nothing can handle: a Corner without a Space. Every
--    function that reads posts.hobby_slug was read live on Nov 2, 2026; each one that writes or
--    joins on a Corner already guards on corner/sub_hobby being set (sync_corner_moment_count,
--    apply_release_effects, corner_activity_30d, my_corner_affinity, home_suggestions,
--    discover_*), and private.corner_key_of() returns null for a null Space, so a Moment with no
--    Space earns no Regular and touches no Corner count.
--
-- 2. public.log_progress(): what Log, Posted and the Home card show, read with exactly the rules
--    the Stub triggers use (20261101134307_stubs_four_kinds.sql):
--      corners   one row per Corner the signed-in person logged in this New York month, with the
--                distinct New York days that count (private.moment_counts: a photo or video), whether
--                today already counts, and whether this month's Regular is already kept.
--      pursuits  every open Pursuit they own or have joined: target_moments, every Moment in it
--                (what pursuit_auto_finish counts), and their own distinct days in it (what
--                issue_finish_stubs counts for a Pursuit with no goal), plus today.
--    Never another person's days. Signed out it returns null.
--
-- 3. A Corner or Pursuit added after posting counts at once. Posted offers "Counts toward" when
--    nothing was picked; that is an update, and the Stub triggers ran only on insert, so a 10th
--    day added that way waited for the next Moment, and a Pursuit goal reached that way never
--    finished on its own. The same two functions now also run after an update that changes the
--    Space, Corner or Pursuit. Both are already safe to run again for the same Moment: a Regular
--    or drop Stub is inserted only when none exists (on conflict do nothing), and
--    pursuit_auto_finish only sets finished_at while it is null.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Verification: supabase/verification/log_punch_cards_check.sql.
-- Rollback: rollback_20261107000000_log_punch_cards.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. A Moment may have no Space, but never a Corner without one
-- ─────────────────────────────────────────────────────────────────────────
alter table public.posts alter column hobby_slug drop not null;

alter table public.posts
  add constraint posts_corner_needs_space
  check (
    hobby_slug is not null
    or (nullif(corner, '') is null and nullif(sub_hobby, '') is null)
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2. log_progress()
-- ─────────────────────────────────────────────────────────────────────────
create function public.log_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := private.ny_day(now());
  v_month date := date_trunc('month', private.ny_day(now()))::date;
  v_corners jsonb;
  v_pursuits jsonb;
begin
  if v_uid is null then
    return null;
  end if;

  v_corners := coalesce((
    select jsonb_agg(jsonb_build_object(
             'key', d.k,
             'days', d.days,
             'today', d.today,
             'kept', exists (select 1 from public.stubs s
                              where s.user_id = v_uid and s.kind = 'regular'
                                and s.corner_key = d.k and s.period = v_month))
           order by d.days desc, d.k)
      from (
        select m.k, count(distinct m.day)::integer as days, bool_or(m.day = v_today) as today
          from (
            select private.corner_key_of(po.hobby_slug, coalesce(nullif(po.corner, ''), nullif(po.sub_hobby, ''))) as k,
                   private.ny_day(coalesce(pp.occurred_at, po.created_at)) as day
              from public.posts po
              left join public.post_private pp on pp.post_id = po.id
             where po.user_id = v_uid
               and private.moment_counts(po.type, po.media_url, po.media_paths, po.created_at, coalesce(pp.occurred_at, po.created_at))
               and private.ny_day(coalesce(pp.occurred_at, po.created_at)) >= v_month
               and private.ny_day(coalesce(pp.occurred_at, po.created_at)) < (v_month + interval '1 month')::date
          ) m
         where m.k is not null
         group by m.k
      ) d
  ), '[]'::jsonb);

  v_pursuits := coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', pu.id,
             'owner', pu.user_id = v_uid,
             'target', pu.target_moments,
             'moments', (select count(*)::integer from public.posts po where po.pursuit_id = pu.id),
             'days', (select count(distinct private.ny_day(coalesce(pp.occurred_at, po.created_at)))::integer
                        from public.posts po
                        left join public.post_private pp on pp.post_id = po.id
                       where po.pursuit_id = pu.id and po.user_id = v_uid),
             'today', exists (select 1 from public.posts po
                               left join public.post_private pp on pp.post_id = po.id
                              where po.pursuit_id = pu.id and po.user_id = v_uid
                                and private.ny_day(coalesce(pp.occurred_at, po.created_at)) = v_today))
           order by pu.started_at desc)
      from public.pursuits pu
     where pu.finished_at is null
       and pu.archived_at is null
       and pu.let_go_at is null
       and pu.is_plan = false
       and (pu.user_id = v_uid
            or exists (select 1 from public.pursuit_members pm
                        where pm.pursuit_id = pu.id and pm.user_id = v_uid and pm.status = 'joined'))
  ), '[]'::jsonb);

  return jsonb_build_object('month', v_month, 'today', v_today, 'corners', v_corners, 'pursuits', v_pursuits);
end;
$$;

revoke all on function public.log_progress() from public, anon;
grant execute on function public.log_progress() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The Stub triggers also run when a Corner or Pursuit is added later
-- ─────────────────────────────────────────────────────────────────────────
create trigger posts_zz_award_moment_stubs_on_update
  after update of hobby_slug, corner, sub_hobby, pursuit_id on public.posts
  for each row
  when (old.hobby_slug is distinct from new.hobby_slug
        or old.corner is distinct from new.corner
        or old.sub_hobby is distinct from new.sub_hobby
        or old.pursuit_id is distinct from new.pursuit_id)
  execute function private.award_moment_stubs();

create trigger posts_pursuit_auto_finish_on_update
  after update of pursuit_id on public.posts
  for each row
  when (new.pursuit_id is not null and old.pursuit_id is distinct from new.pursuit_id)
  execute function private.pursuit_auto_finish();
