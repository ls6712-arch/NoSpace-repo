-- Hotfix: members-only RPCs, and no skipping the 18+ birthday step.
--
-- Two gaps found on the live project on Nov 2, 2026 (read-only queries):
--   1. A signed-in account that hasn't finished onboarding (not a member: private.is_active() is
--      false) can call every security definer RPC directly: 108 of them are executable by
--      authenticated and none checks membership (create_space, create_event, rsvp_to_event,
--      request_or_join_space, send_plan_invite, accept_host_invite, ...). Root.tsx sends such an
--      account to onboarding, but only in the browser.
--   2. onboarding_completed is writable by the client, and private.is_active() counts it: one
--      direct update makes an account a member without the 18+ birthday step.
--
-- The fix:
--   1. private.request_gate(), PostgREST's db_pre_request: every /rpc/ call from the anon role or
--      from a non-member is refused (42501) unless the function is on private.access_allowlist.
--      Members are unaffected. New functions are closed to non-members by default.
--   2. onboarding_completed (and its timestamp) are no longer client-writable; finish_onboarding()
--      sets them, and only when an 18+ birthdate is on file.
--   3. Trigger functions lose EXECUTE for anon and authenticated (they never needed it; a trigger
--      fires whatever the caller's privileges). Clears 7 security advisor warnings.
--
-- The allowlist (kind):
--   rpc_anon     an RPC the signed-out anon role may call: exactly what anon could execute
--                before this migration, minus trigger functions, so no signed-out page breaks
--   rpc_guest    an RPC any signed-in non-member may call: the same public reads
--   rpc_account  an RPC a non-member with a real (not anonymous) login may also call: what
--                onboarding needs before the birthday step, and their own calendar
--   table_nonmember, table_anon   reserved for the guest Stubby change (#303); unused here
--
-- Checked against live on Nov 2, 2026: no db_pre_request set on authenticator; 0 pending accounts;
-- 0 anonymous users. The app's onboarding finishes through finish_onboarding() from this change on,
-- and falls back to the old update while this migration isn't applied.
--
-- Every column inside every subquery is table-qualified (CLAUDE.md).
-- Verification: supabase/verification/member_rpc_gate_check.sql.
-- Rollback: rollback_20261111000000_member_rpc_gate.sql.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Who is calling
-- ─────────────────────────────────────────────────────────────────────────


create or replace function private.is_anonymous()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = auth.uid()), false)
$$;

create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and not private.is_anonymous()
     and private.is_active(auth.uid())
$$;

revoke all on function private.is_anonymous() from public;
revoke all on function private.is_member() from public;
grant execute on function private.is_anonymous() to anon, authenticated, service_role;
grant execute on function private.is_member() to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The allowlist
-- ─────────────────────────────────────────────────────────────────────────
--
-- The kinds are described at the top of this file. Mirrored in supabase/security/access-allowlist.json
-- by the guest Stubby change.

create table private.access_allowlist (
  kind text not null check (kind in ('rpc_anon', 'rpc_guest', 'rpc_account', 'table_nonmember', 'table_anon')),
  name text not null check (name ~ '^[a-z_][a-z0-9_]*$'),
  reason text not null check (char_length(reason) between 3 and 200),
  primary key (kind, name)
);

alter table private.access_allowlist enable row level security;
revoke all on private.access_allowlist from public, anon, authenticated;

insert into private.access_allowlist (kind, name, reason) values
  -- Signed-out visitors: public profiles, invite previews, Space and Corner counts.
  ('rpc_anon', 'corner_activity_30d', 'public Corner activity counts'),
  ('rpc_anon', 'get_profile', 'public Shelf'),
  ('rpc_anon', 'get_profile_moments', 'public Shelf'),
  ('rpc_anon', 'get_profile_pursuits', 'public Shelf'),
  ('rpc_anon', 'get_profile_stubs', 'public Shelf'),
  ('rpc_anon', 'invite_preview', 'invite arrival page before sign-up'),
  ('rpc_anon', 'is_blocklisted_name', 'sign-up name check'),
  ('rpc_anon', 'is_pursuit_participant', 'policy helper, returns a boolean'),
  ('rpc_anon', 'is_reserved_space_slug', 'policy helper, returns a boolean'),
  ('rpc_anon', 'is_space_host', 'policy helper, returns a boolean'),
  ('rpc_anon', 'is_space_member', 'policy helper, returns a boolean'),
  ('rpc_anon', 'is_visible_profile', 'policy helper, returns a boolean'),
  ('rpc_anon', 'join_pursuit_via_link', 'Pursuit invite link; refuses without a signed-in member'),
  ('rpc_anon', 'join_waitlist', 'retired waitlist, still callable before this migration'),
  ('rpc_anon', 'list_event_teasers', 'event titles and times on a Space page'),
  ('rpc_anon', 'pursuit_invite_preview', 'Pursuit invite page before sign-up'),
  ('rpc_anon', 'pursuit_person_name', 'Pursuit invite page before sign-up'),
  ('rpc_anon', 'resolve_profile_handle', 'public Shelf link'),
  ('rpc_anon', 'save_notification_body', 'pure text helper, no table access'),
  ('rpc_anon', 'space_host_count', 'public Space page'),
  ('rpc_anon', 'space_moment_count_30d', 'public Space page'),
  ('rpc_anon', 'you_inspired_this_month', 'returns nothing without a signed-in member'),

  -- Guests and Stubby accounts: the same public reads a signed-out visitor has, no writes.
  ('rpc_guest', 'corner_activity_30d', 'public Corner activity counts'),
  ('rpc_guest', 'get_profile', 'public Shelf'),
  ('rpc_guest', 'get_profile_moments', 'public Shelf'),
  ('rpc_guest', 'get_profile_pursuits', 'public Shelf'),
  ('rpc_guest', 'get_profile_stubs', 'public Shelf'),
  ('rpc_guest', 'invite_preview', 'invite arrival page'),
  ('rpc_guest', 'is_blocklisted_name', 'name check'),
  ('rpc_guest', 'is_visible_profile', 'policy helper, returns a boolean'),
  ('rpc_guest', 'list_event_teasers', 'event titles and times on a Space page'),
  ('rpc_guest', 'pursuit_invite_preview', 'Pursuit invite page'),
  ('rpc_guest', 'pursuit_person_name', 'Pursuit invite page'),
  ('rpc_guest', 'resolve_profile_handle', 'public Shelf link'),
  ('rpc_guest', 'space_host_count', 'public Space page'),
  ('rpc_guest', 'space_moment_count_30d', 'public Space page'),

  -- Stubby accounts only (never a guest): finishing onboarding, and their own calendar.
  ('rpc_account', 'accept_terms', 'onboarding: Terms and Privacy Policy'),
  ('rpc_account', 'claim_invite', 'an invite link attaches to the account'),
  ('rpc_account', 'finish_onboarding', 'onboarding: the last step'),
  ('rpc_account', 'get_my_planning', 'calendar: own free time'),
  ('rpc_account', 'my_member_no', 'onboarding: own member card'),
  ('rpc_account', 'my_profile_private', 'onboarding: own private profile'),
  ('rpc_account', 'remove_underage_account', 'onboarding: the under-18 stop'),
  ('rpc_account', 'set_calendar_feed_token', 'calendar: subscribe link'),
  ('rpc_account', 'set_username_during_onboarding', 'onboarding: username'),
  ('rpc_account', 'username_suggestion', 'onboarding: username');

-- ─────────────────────────────────────────────────────────────────────────
-- 3. The RPC gate (PostgREST db_pre_request)
-- ─────────────────────────────────────────────────────────────────────────

create or replace function private.request_gate()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := coalesce(current_setting('request.path', true), '');
  v_claims jsonb := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
  v_role text := coalesce(v_claims ->> 'role', 'anon');
  v_fn text;
begin
  -- Tables are covered by RLS (section 4). Only RPCs are checked here.
  if v_path not like '/rpc/%' then
    return;
  end if;
  if v_role = 'service_role' then
    return;
  end if;
  v_fn := lower(split_part(substr(v_path, 6), '/', 1));

  if v_role = 'authenticated' then
    if private.is_member() then
      return;
    end if;
    if exists (select 1 from private.access_allowlist a where a.kind = 'rpc_guest' and a.name = v_fn) then
      return;
    end if;
    if not private.is_anonymous()
       and exists (select 1 from private.access_allowlist a where a.kind = 'rpc_account' and a.name = v_fn) then
      return;
    end if;
  elsif exists (select 1 from private.access_allowlist a where a.kind = 'rpc_anon' and a.name = v_fn) then
    return;
  end if;

  raise exception 'not allowed' using errcode = '42501';
end;
$$;

revoke all on function private.request_gate() from public;
grant execute on function private.request_gate() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'private.request_gate';
notify pgrst, 'reload config';

-- ─────────────────────────────────────────────────────────────────────────
-- 4. Finishing onboarding needs an 18+ birthdate
-- ─────────────────────────────────────────────────────────────────────────

revoke update (onboarding_completed, onboarding_completed_at) on public.profiles from anon, authenticated;

create or replace function public.finish_onboarding()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or private.is_anonymous() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profile_private pp
    where pp.user_id = auth.uid()
      and pp.birthdate is not null
      and pp.birthdate <= (current_date - interval '18 years')::date
  ) then
    return false;
  end if;
  update public.profiles
  set onboarding_completed = true,
      onboarding_completed_at = coalesce(profiles.onboarding_completed_at, now())
  where profiles.id = auth.uid();
  return true;
end;
$$;

revoke all on function public.finish_onboarding() from public, anon;
grant execute on function public.finish_onboarding() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Trigger functions are not RPCs
-- ─────────────────────────────────────────────────────────────────────────

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end
$$;
