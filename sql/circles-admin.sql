-- Sushii: let an admin delete a Circle.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Requires sql/categories.sql (for is_admin()),
-- sql/circles.sql, sql/circle-invites.sql and sql/circle-threads.sql.
--
-- Why this needs its own functions
--   * Nobody can delete a Circle today: circles.sql gives the owner insert,
--     select and update, but no delete policy at all.
--   * Deleting the row is not enough. circle_members cascades, but
--     circle_invites has no foreign key, and a Circle's threads are ordinary
--     rows in `posts` that point at it with no foreign key either. A bare
--     delete would leave invites and threads pointing at nothing.
--
-- The id offset
--   The app numbers real Circles as (circles.id + 1,000,000) so they never
--   collide with the small demo-Circle ids that live in code, and it stores
--   that offset number in posts.circle_id (see CirclesContext.tsx and
--   ContentContext.tsx). Every function here takes the RAW circles.id and does
--   the offset itself, so nobody has to remember it.
--
-- What happens to the Circle's threads
--   Chosen by the admin, per delete:
--     'keep_private'  (default) the threads stay, are unhooked from the
--                     Circle (circle_id and circle_tab cleared) and remain
--                     readable only by whoever wrote them. They keep
--                     visibility 'circle' on purpose: a 'circle' post with no
--                     Circle attached matches none of the read rules except
--                     "your own", whereas 'friends' would hand them to the
--                     author's connections. The app shows such a post with
--                     the label "A Circle" and no name.
--                     Requires sql/fix-post-read-policy.sql to be in place.
--     'delete'        the threads are deleted with the Circle.
--   Threads are NEVER made public: they were posted into a room people may
--   have believed was small.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. What still points at a Circle
--    SECURITY DEFINER so a Members-only thread still counts even though the
--    admin couldn't read it under row-level security. Admin-only.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.circle_usage(p_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  return jsonb_build_object(
    'members', (select count(*) from public.circle_members where circle_id = p_id),
    'invites', (select count(*) from public.circle_invites where circle_id = p_id),
    'threads', (select count(*) from public.posts          where circle_id = p_id + 1000000)
  );
end;
$$;

revoke all on function public.circle_usage(bigint) from public, anon;
grant execute on function public.circle_usage(bigint) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Delete a Circle
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.admin_delete_circle(
  p_id bigint,
  p_threads text default 'keep_private'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n_threads int;
  n_invites int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Only an admin can do that.';
  end if;

  if p_threads not in ('keep_private', 'delete') then
    raise exception 'Choose what happens to the threads: keep_private or delete.';
  end if;

  if not exists (select 1 from public.circles where id = p_id) then
    raise exception 'That Circle doesn''t exist. (Demo Circles are built into the app and can''t be deleted here.)';
  end if;

  if p_threads = 'keep_private' then
    update public.posts
       set circle_id = null,
           circle_tab = null,
           -- circle contributions default to hidden from the author's own
           -- Moments; once they're the author's own private posts they
           -- should show up there. visibility stays 'circle' (see header).
           hidden_from_moments = false
     where circle_id = p_id + 1000000;
  else
    delete from public.posts where circle_id = p_id + 1000000;
  end if;
  get diagnostics n_threads = row_count;

  delete from public.circle_invites where circle_id = p_id;
  get diagnostics n_invites = row_count;

  -- circle_members cascades from this.
  delete from public.circles where id = p_id;

  return jsonb_build_object('threads', n_threads, 'invites', n_invites, 'mode', p_threads);
end;
$$;

revoke all on function public.admin_delete_circle(bigint, text) from public, anon;
grant execute on function public.admin_delete_circle(bigint, text) to authenticated;
