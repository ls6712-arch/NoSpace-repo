-- Member gate: deny by default for anyone who is not a member.
--
-- Who is who (founder, Nov 2, 2026):
--   member          private.is_active(auth.uid()): an active profile that finished onboarding or
--                   gave an 18+ birthdate. The only people who can use Spaces, Moments, comments,
--                   messages and everything else.
--   Stubby account  signed in with a real login (not anonymous) but not a member yet. Can use
--                   Stubby, save to the calendar, make its own one-off plans and finish onboarding.
--   guest           an anonymous Supabase user (auth.users.is_anonymous). Can use Stubby, and read
--                   or write only its own Stubby rows (20261111000100_stubby_guests.sql).
--   signed out      the anon role. Unchanged by this migration except that RPCs are now gated too.
--
-- Runs AFTER the hotfix 20261111000000_member_rpc_gate.sql, which already added
-- private.is_anonymous(), private.is_member(), private.access_allowlist with its RPC rows, the RPC
-- gate (private.request_gate) and finish_onboarding(). This migration adds the rest.
--
-- What this migration does (numbers as in the full design; 2, 3, 7 and 8 are in the hotfix):
--   1. private.is_anonymous(), private.is_member(), private.is_stubby_account(): the three checks,
--      read from the database (auth.users, profiles), never from anything the client sends.
--   2. private.access_allowlist: the explicit list of what non-members may reach. Mirrored in
--      supabase/security/access-allowlist.json; src/app/lib/accessAllowlist.test.ts fails CI when
--      the two differ or when a migration adds a table, view, function, bucket or edge function
--      that is reachable without being on the list.
--   3. private.request_gate(): PostgREST's db_pre_request. Every /rpc/ call by the anon role or by
--      a non-member is refused (42501) unless the function is on the allowlist. Security definer
--      functions skip RLS, so this is the check that covers all 108 of them at once.
--   4. A restrictive "members only" policy on every public table, so the same rule holds for
--      PostgREST, Realtime (postgres_changes reads through RLS) and any other path. The tables a
--      non-member needs get their own narrower restrictive policies instead (own rows only).
--   5. Storage and Realtime broadcast/presence: restrictive members-only policies.
--   6. handle_new_user() no longer makes a profile for an anonymous user (they were going to show
--      up in People search). When a guest signs up, the profile is made then, marked
--      signed_up_from = 'stubby', so the app knows not to send them into onboarding.
--   7. onboarding_completed is no longer writable by the client: finish_onboarding() sets it, and
--      only when an 18+ birthdate is on file. Before this, anyone could skip the age step with one
--      direct update and become a member.
--   8. Trigger functions lose EXECUTE for anon and authenticated (they never needed it: a trigger
--      fires whatever the caller's privileges). Clears 7 security advisor warnings.
--
-- Checked against the live project on Nov 2, 2026 with read-only queries: 66 public tables, all
-- with RLS on; no views in public; 14 restrictive "active accounts only" INSERT policies; 0
-- pending accounts; no db_pre_request set on authenticator; buckets message-media, post-media
-- (public), moment-media; no realtime.messages policies; pg_cron installed.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Verification: supabase/verification/member_gate_check.sql.
-- Rollback: rollback_20261111000050_member_gate.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Who is calling (private.is_anonymous() and private.is_member() come from the hotfix)
-- ─────────────────────────────────────────────────────────────────────────

-- Signed in with a real login, has a profile, not a member yet.
create or replace function private.is_stubby_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not private.is_anonymous()
     and exists (select 1 from public.profiles p where p.id = auth.uid())
     and not private.is_active(auth.uid())
$$;

revoke all on function private.is_stubby_account() from public;
grant execute on function private.is_stubby_account() to anon, authenticated, service_role;

-- The same answer for the app and the edge functions, so neither keeps its own copy of the rule.
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'guest', auth.uid() is null or private.is_anonymous(),
    'member', private.is_member(),
    -- 21+ picks (bars, tastings) only with a birthdate on file at least 21 years ago (founder,
    -- Nov 2, 2026). A guest never has one.
    'adult21', auth.uid() is not null and not private.is_anonymous() and exists (
      select 1 from public.profile_private pp
      where pp.user_id = auth.uid()
        and pp.birthdate is not null
        and pp.birthdate <= (current_date - interval '21 years')::date
    )
  )
$$;

revoke all on function public.my_access() from public, anon;
grant execute on function public.my_access() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The allowlist (the table and the RPC rows come from the hotfix)
-- ─────────────────────────────────────────────────────────────────────────

insert into private.access_allowlist (kind, name, reason) values
  ('rpc_guest', 'my_access', 'own guest and member status'),
  -- Tables a non-member may reach, each through its own restrictive policy below.
  ('table_nonmember', 'app_config', 'public settings: read only'),
  ('table_nonmember', 'calendar_entries', 'Stubby account: own calendar entries'),
  ('table_nonmember', 'calendar_feed_tokens', 'Stubby account: own calendar link'),
  ('table_nonmember', 'categories', 'public list: read only'),
  ('table_nonmember', 'city_picks', 'published picks: read only'),
  ('table_nonmember', 'corner_categories', 'public list: read only'),
  ('table_nonmember', 'corners', 'Corner names for picks: read only'),
  ('table_nonmember', 'personal_picks', 'guest and Stubby account: own picks'),
  ('table_nonmember', 'profile_private', 'Stubby account: own row, for onboarding'),
  ('table_nonmember', 'profile_settings', 'Stubby account: own row'),
  ('table_nonmember', 'profiles', 'Stubby account: own row'),
  ('table_nonmember', 'pursuit_members', 'Stubby account: own one-off plans'),
  ('table_nonmember', 'pursuit_sessions', 'Stubby account: own one-off plans'),
  ('table_nonmember', 'pursuits', 'Stubby account: own one-off plans'),
  ('table_nonmember', 'stubby_asks', 'guest and Stubby account: own asks'),
  ('table_nonmember', 'terms_acceptances', 'Stubby account: own row'),
  -- Tables with a policy for the public or anon role, as of Nov 2, 2026. Most are own-row
  -- policies written without "to authenticated", which anon can never match (no auth.uid()).
  ('table_anon', 'app_config', 'public settings'),
  ('table_anon', 'bookmarks', 'own rows only'),
  ('table_anon', 'categories', 'public list'),
  ('table_anon', 'category_suggestions', 'own rows only'),
  ('table_anon', 'connections', 'own rows only'),
  ('table_anon', 'conversation_reads', 'own rows only'),
  ('table_anon', 'corner_categories', 'public list'),
  ('table_anon', 'corners', 'needs auth.uid()'),
  ('table_anon', 'drops', 'public once open'),
  ('table_anon', 'hobby_follows', 'needs auth.uid()'),
  ('table_anon', 'messages', 'needs an accepted participation'),
  ('table_anon', 'moderation_queue', 'admins only'),
  ('table_anon', 'moment_drafts', 'own rows only'),
  ('table_anon', 'notifications', 'own rows only'),
  ('table_anon', 'participations', 'own rows, or open requests'),
  ('table_anon', 'post_likes', 'needs auth.uid()'),
  ('table_anon', 'post_reflections', 'own rows only'),
  ('table_anon', 'posts', 'public Moments'),
  ('table_anon', 'private_logs', 'own rows only'),
  ('table_anon', 'profile_follows', 'needs auth.uid()'),
  ('table_anon', 'profile_links', 'needs auth.uid()'),
  ('table_anon', 'profile_settings', 'own rows only'),
  ('table_anon', 'profiles', 'public profiles'),
  ('table_anon', 'pursuit_progress', 'shared Pursuits'),
  ('table_anon', 'pursuits', 'shared Pursuits'),
  ('table_anon', 'reactions', 'own rows only'),
  ('table_anon', 'space_corners', 'public Spaces'),
  ('table_anon', 'space_events', 'open Spaces'),
  ('table_anon', 'space_join_requests', 'own rows only'),
  ('table_anon', 'space_members', 'roster follows the Space'),
  ('table_anon', 'space_moments', 'public Space Moments'),
  ('table_anon', 'spaces', 'public Spaces'),
  ('table_anon', 'thoughts', 'follows the Moment');

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Tables: members only, unless on the allowlist
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  t record;
begin
  for t in
    select pt.tablename
    from pg_tables pt
    where pt.schemaname = 'public'
      and not exists (
        select 1 from private.access_allowlist a
        where a.kind = 'table_nonmember' and a.name = pt.tablename
      )
    order by pt.tablename
  loop
    execute format(
      'create policy "members only" on public.%I as restrictive for all to authenticated using ((select private.is_member())) with check ((select private.is_member()))',
      t.tablename
    );
  end loop;
end
$$;

-- Read-only for non-members: reads follow the table's own policies, writes need a member.
create policy "members only: insert" on public.app_config as restrictive for insert to authenticated with check ((select private.is_member()));
create policy "members only: update" on public.app_config as restrictive for update to authenticated using ((select private.is_member()));
create policy "members only: delete" on public.app_config as restrictive for delete to authenticated using ((select private.is_member()));
create policy "members only: insert" on public.categories as restrictive for insert to authenticated with check ((select private.is_member()));
create policy "members only: update" on public.categories as restrictive for update to authenticated using ((select private.is_member()));
create policy "members only: delete" on public.categories as restrictive for delete to authenticated using ((select private.is_member()));
create policy "members only: insert" on public.city_picks as restrictive for insert to authenticated with check ((select private.is_member()));
create policy "members only: update" on public.city_picks as restrictive for update to authenticated using ((select private.is_member()));
create policy "members only: delete" on public.city_picks as restrictive for delete to authenticated using ((select private.is_member()));
create policy "members only: insert" on public.corner_categories as restrictive for insert to authenticated with check ((select private.is_member()));
create policy "members only: update" on public.corner_categories as restrictive for update to authenticated using ((select private.is_member()));
create policy "members only: delete" on public.corner_categories as restrictive for delete to authenticated using ((select private.is_member()));
create policy "members only: insert" on public.corners as restrictive for insert to authenticated with check ((select private.is_member()));
create policy "members only: update" on public.corners as restrictive for update to authenticated using ((select private.is_member()));
create policy "members only: delete" on public.corners as restrictive for delete to authenticated using ((select private.is_member()));

-- Own rows, for any non-member with a real login (never a guest).
create policy "members, or your own row" on public.profiles as restrictive for all to authenticated
  using ((select private.is_member()) or (profiles.id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (profiles.id = (select auth.uid()) and not (select private.is_anonymous())));
create policy "members, or your own row" on public.profile_private as restrictive for all to authenticated
  using ((select private.is_member()) or (profile_private.user_id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (profile_private.user_id = (select auth.uid()) and not (select private.is_anonymous())));
create policy "members, or your own row" on public.profile_settings as restrictive for all to authenticated
  using ((select private.is_member()) or (profile_settings.user_id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (profile_settings.user_id = (select auth.uid()) and not (select private.is_anonymous())));
create policy "members, or your own row" on public.terms_acceptances as restrictive for all to authenticated
  using ((select private.is_member()) or (terms_acceptances.user_id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (terms_acceptances.user_id = (select auth.uid()) and not (select private.is_anonymous())));
create policy "members, or your own row" on public.calendar_entries as restrictive for all to authenticated
  using ((select private.is_member()) or (calendar_entries.user_id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (calendar_entries.user_id = (select auth.uid()) and not (select private.is_anonymous())));
create policy "members, or your own row" on public.calendar_feed_tokens as restrictive for all to authenticated
  using ((select private.is_member()) or (calendar_feed_tokens.user_id = (select auth.uid()) and not (select private.is_anonymous())))
  with check ((select private.is_member()) or (calendar_feed_tokens.user_id = (select auth.uid()) and not (select private.is_anonymous())));

-- Own Stubby rows, for guests too.
create policy "members, or your own row" on public.personal_picks as restrictive for all to authenticated
  using ((select private.is_member()) or personal_picks.user_id = (select auth.uid()))
  with check ((select private.is_member()) or personal_picks.user_id = (select auth.uid()));
create policy "members, or your own row" on public.stubby_asks as restrictive for all to authenticated
  using ((select private.is_member()) or stubby_asks.user_id = (select auth.uid()))
  with check ((select private.is_member()) or stubby_asks.user_id = (select auth.uid()));

-- One-off plans (Make it a plan) for a Stubby account: its own, never shared, nothing else.
create policy "members, or your own plans" on public.pursuits as restrictive for all to authenticated
  using ((select private.is_member()) or (pursuits.user_id = (select auth.uid()) and pursuits.is_plan and not pursuits.shared and (select private.is_stubby_account())))
  with check ((select private.is_member()) or (pursuits.user_id = (select auth.uid()) and pursuits.is_plan and not pursuits.shared and (select private.is_stubby_account())));
create policy "members, or your own plans" on public.pursuit_members as restrictive for all to authenticated
  using (
    (select private.is_member())
    or (
      pursuit_members.user_id = (select auth.uid())
      and (select private.is_stubby_account())
      and exists (
        select 1 from public.pursuits p
        where p.id = pursuit_members.pursuit_id and p.user_id = (select auth.uid()) and p.is_plan and not p.shared
      )
    )
  )
  with check (
    (select private.is_member())
    or (
      pursuit_members.user_id = (select auth.uid())
      and (select private.is_stubby_account())
      and exists (
        select 1 from public.pursuits p
        where p.id = pursuit_members.pursuit_id and p.user_id = (select auth.uid()) and p.is_plan and not p.shared
      )
    )
  );
create policy "members, or your own plans" on public.pursuit_sessions as restrictive for all to authenticated
  using (
    (select private.is_member())
    or (
      (select private.is_stubby_account())
      and exists (
        select 1 from public.pursuits p
        where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid()) and p.is_plan and not p.shared
      )
    )
  )
  with check (
    (select private.is_member())
    or (
      pursuit_sessions.created_by = (select auth.uid())
      and (select private.is_stubby_account())
      and exists (
        select 1 from public.pursuits p
        where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid()) and p.is_plan and not p.shared
      )
    )
  );

-- The old "active accounts only" INSERT rules on pursuits and pursuit_members would block a Stubby
-- account's own plan; the restrictive policies above replace them with the same rule plus that one
-- exception. pursuit_sessions' own insert policy requires is_active, so a Stubby account gets a
-- second, permissive one for its own plans (the restrictive policy above still applies).
drop policy "active accounts only" on public.pursuits;
drop policy "active accounts only" on public.pursuit_members;

create policy "stubby accounts add sessions to their own plans" on public.pursuit_sessions for insert to authenticated
  with check (
    pursuit_sessions.created_by = (select auth.uid())
    and (select private.is_stubby_account())
    and not (select public.write_blocked())
    and exists (
      select 1 from public.pursuits p
      where p.id = pursuit_sessions.pursuit_id and p.user_id = (select auth.uid()) and p.is_plan and not p.shared
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Storage and Realtime
-- ─────────────────────────────────────────────────────────────────────────

-- Uploads, replacements, deletes and private reads need a member. Public bucket URLs
-- (post-media) are served without RLS and are unchanged.
create policy "members only" on storage.objects as restrictive for all to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

-- Private broadcast and presence channels. None exist today; this keeps any future one closed to
-- non-members. postgres_changes reads through the table policies in section 4.
create policy "members only" on realtime.messages as restrictive for all to authenticated
  using ((select private.is_member()))
  with check ((select private.is_member()));

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Profiles: none for guests; made when a guest signs up
-- ─────────────────────────────────────────────────────────────────────────

alter table public.profiles add column signed_up_from text check (signed_up_from in ('stubby'));
-- Update is granted per column on profiles, and no grant is given for this one. Insert is granted
-- on the whole table, but every real account already has its profile from the trigger, and a
-- guest can't insert one (section 4), so nobody can set it themselves. It only decides whether
-- the app sends someone into onboarding; it grants nothing in the database.

create or replace function private.make_profile(p_id uuid, p_email text, p_from text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefix text := coalesce(nullif(split_part(p_email, '@', 1), ''), 'creator');
  v_base text := left(lower(regexp_replace(coalesce(nullif(split_part(p_email, '@', 1), ''), 'creator'), '[^A-Za-z0-9_]', '', 'g')), 20);
  v_name text;
  v_try integer := 0;
begin
  if exists (select 1 from public.profiles p where p.id = p_id) then
    return;
  end if;
  if char_length(v_base) < 3 then
    v_base := left('user' || v_base, 20);
  end if;
  v_name := v_base;
  loop
    begin
      insert into public.profiles (id, username, display_name, signed_up_from)
      values (p_id, v_name, left(v_prefix, 60), p_from);
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 10 then
        raise;
      end if;
      v_name := left(v_base, 15) || '_' || (1000 + floor(random() * 9000))::integer::text;
    end;
  end loop;
end;
$$;

revoke all on function private.make_profile(uuid, text, text) from public, anon, authenticated;

-- Same as before for every real sign-up; nothing for an anonymous one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.is_anonymous, false) then
    return new;
  end if;
  perform private.make_profile(new.id, new.email, null);
  return new;
end;
$$;

-- A guest who signs up keeps the same user id: the profile is made now.
create or replace function private.handle_guest_signed_up()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(old.is_anonymous, false) and not coalesce(new.is_anonymous, false) then
    perform private.make_profile(new.id, new.email, 'stubby');
  end if;
  return new;
end;
$$;

revoke all on function private.handle_guest_signed_up() from public, anon, authenticated;

create trigger on_auth_guest_signed_up
  after update of is_anonymous on auth.users
  for each row execute function private.handle_guest_signed_up();
