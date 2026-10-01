-- Step 4c · invites to 3, and the Day-2 invite ask
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261012000000_step4_first_response.sql.
--
-- 1. invites_per_new_member: 0 → 3 (owner decision, Oct 1, 2026). Applies
--    to every invite claimed from now on (claim_invite reads it at claim
--    time).
-- 2. Every existing active, non-admin account is topped up to 3. Never
--    lowered: greatest(current, 3). Admins are unlimited already and keep
--    their 0 (create_invite skips the count for them).
-- 3. my_invite_ask() — what the app asks before showing the Day-2
--    "Invite someone?" card on My Space. Returns how many invites the
--    caller has left when ALL of these hold, otherwise 0:
--      - an active, non-admin account, at least 24 hours old;
--      - their first moment (Everyone or Followers) has a written thought
--        from someone else — "after the first response lands";
--      - they've never created an invite (the ask is a first nudge, not
--        a repeat);
--      - they still have at least one invite left.
--    Same "used" count create_invite() enforces: claimed, plus open and
--    unexpired.
--
-- Every column inside every subquery is fully qualified.
-- Safe to re-run.

update public.app_config
set value = '3'::jsonb
where public.app_config.key = 'invites_per_new_member';

update public.profiles
set invite_allowance = greatest(public.profiles.invite_allowance, 3)
where public.profiles.access = 'active'
  and coalesce(public.profiles.is_admin, false) = false;

create or replace function public.my_invite_ask()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  me record;
  first_id bigint;
  used int;
begin
  if uid is null then
    return 0;
  end if;

  select profiles.access, profiles.is_admin, profiles.invite_allowance, profiles.created_at
    into me
  from profiles where profiles.id = uid;

  if me.access is distinct from 'active'
     or coalesce(me.is_admin, false)
     or me.created_at > now() - interval '24 hours'
     or coalesce(me.invite_allowance, 0) <= 0 then
    return 0;
  end if;

  if exists (select 1 from invites where invites.inviter_id = uid) then
    return 0;
  end if;

  first_id := (
    select posts.id from posts
    where posts.user_id = uid
      and posts.visibility in ('public', 'followers')
    order by posts.created_at, posts.id
    limit 1
  );
  if first_id is null or not exists (
    select 1 from thoughts
    where thoughts.post_id = first_id
      and thoughts.user_id <> uid
      and nullif(btrim(thoughts.body), '') is not null
  ) then
    return 0;
  end if;

  used := (
    select count(*) from invites
    where invites.inviter_id = uid
      and (invites.status = 'claimed' or (invites.status = 'open' and invites.expires_at > now()))
  );
  return greatest(0, me.invite_allowance - used);
end;
$$;
revoke all on function public.my_invite_ask() from public, anon;
grant execute on function public.my_invite_ask() to authenticated;
