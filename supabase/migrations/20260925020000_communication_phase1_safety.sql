-- Sushii: Communication Phase 1 (Safety) — blocking, reporting, and message
-- requests.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Draft only — staged for review. Do NOT run this against Supabase until
-- it's been approved. See docs/communication-strategy.md for the full plan
-- this implements.
--
-- Everything here is enforced by RLS policies and triggers, not just hidden
-- in the app client — the app is not a trust boundary; someone calling the
-- database directly with their own login must hit the same walls.
--
-- ── What this migration does, in plain language ─────────────────────────
--
-- 1. A new `blocks` table. Blocking someone is one-directional (you did it),
--    but its effect is mutual: neither of you can reach the other any more.
--    The blocked person can never read the blocks table — they're not told.
--
-- 2. `is_blocked_between(a, b)`: true if either has blocked the other. This
--    is the one function every other rule below calls, so "full block"
--    means the same thing everywhere.
--
-- 3. Blocking someone instantly deletes any follow between you, both ways.
--
-- 4. The block is enforced at the point of every write it should stop
--    (messaging, requesting, following, reacting, commenting) and by
--    hiding rows on read (profiles, posts, thoughts — and, as a natural
--    side effect of reusing the same profile-visibility helper, hobby
--    follows, post likes and profile links too — a blocked-between person's
--    activity disappears from view in both directions, not just the parts
--    explicitly called out).
--
-- 5. Message requests. Today every direct_message participation is inserted
--    already `status = 'accepted'` by the client — this migration makes the
--    database decide instead: accepted immediately if the recipient already
--    follows the sender, pending otherwise. It also closes a real hole —
--    the existing "the recipient answers" policy let EITHER side of a
--    request update its status, so a sender could accept their own ask.
--    Only the recipient may now change a request's status, and only along
--    pending→accepted, pending→declined, declined→accepted. A pending
--    direct_message thread allows exactly one message from the sender (a
--    preview the recipient can read before deciding) and nothing from the
--    recipient until they accept.
--
-- 6. A `reports` table: report a profile, message, Moment or Thought.
--    Reporters see only their own reports; `private.is_admin` accounts see
--    and act on all of them.
--
-- 7. Every new function pins `search_path` and has EXECUTE revoked from
--    anon unless a currently-anon-reachable policy needs it internally
--    (see the `is_blocked_between` grants note below).
--
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE /
-- DROP POLICY IF EXISTS, then re-added.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. blocks
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self_block check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;

create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Only the blocker ever sees a blocks row — the blocked person has no
-- policy that lets them read it, in either direction of the pair.
drop policy if exists "you see who you have blocked" on public.blocks;
create policy "you see who you have blocked"
  on public.blocks for select
  to authenticated
  using (auth.uid() = blocker_id);

drop policy if exists "you block as yourself" on public.blocks;
create policy "you block as yourself"
  on public.blocks for insert
  to authenticated
  with check (auth.uid() = blocker_id);

drop policy if exists "you unblock as yourself" on public.blocks;
create policy "you unblock as yourself"
  on public.blocks for delete
  to authenticated
  using (auth.uid() = blocker_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. is_blocked_between(a, b) — the one source of truth every rule below
--    (and the app) calls.
--
--    EXECUTE is revoked from anon and granted only to authenticated — the
--    handful of policies that need to call it directly are all
--    authenticated-only writes. profiles/posts/thoughts SELECT (which do
--    need to work for anon) reach it *indirectly*, through
--    is_visible_profile() below: that function is itself SECURITY DEFINER,
--    so its internal call to is_blocked_between runs as the function
--    owner, not the connecting role — anon's lack of direct EXECUTE here
--    never blocks that path.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke execute on function public.is_blocked_between(uuid, uuid) from public;
revoke execute on function public.is_blocked_between(uuid, uuid) from anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Blocking removes any existing follow, both directions.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.on_block_remove_follows()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profile_follows
  where (follower_id = new.blocker_id and followed_id = new.blocked_id)
     or (follower_id = new.blocked_id and followed_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_remove_follows on public.blocks;
create trigger blocks_remove_follows
  after insert on public.blocks
  for each row execute function public.on_block_remove_follows();

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Hide rows on read: profiles, posts, thoughts (and, as a side effect
--    of sharing this one helper, hobby_follows / post_likes /
--    profile_links) — a blocked-between person's activity disappears from
--    both sides. Your own rows always stay visible to you.
--
--    is_visible_profile() already gates all of the SELECT policies above
--    except profiles' own — this just adds the block check to the one
--    function they all share, and points profiles' own SELECT policy at
--    it too, rather than duplicating the logic (and, for profiles, rather
--    than calling is_blocked_between directly — profiles must stay
--    readable by anon, and is_visible_profile's own broad EXECUTE grant,
--    unchanged below, is what makes that safe against the anon revoke
--    above).
-- ═══════════════════════════════════════════════════════════════════════

create or replace function public.is_visible_profile(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    (
      uid = auth.uid()
      or exists (
        select 1 from public.profiles p
        where p.id = uid
          and p.paused_at is null
          and p.deletion_requested_at is null
      )
    )
    and not (
      auth.uid() is not null
      and uid <> auth.uid()
      and public.is_blocked_between(auth.uid(), uid)
    );
$$;

drop policy if exists "profiles are visible unless paused or deleting" on public.profiles;
create policy "profiles are visible unless paused or deleting"
  on public.profiles for select
  using (public.is_visible_profile(id));

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Enforce the block on writes: messages, participations, follows,
--    reactions, thoughts.
-- ═══════════════════════════════════════════════════════════════════════

-- participations: you can still ask to join_in (to_user is null there);
-- any ask directed at a specific person is refused once blocked-between.
drop policy if exists "you can ask" on public.participations;
create policy "you can ask"
  on public.participations for insert
  to authenticated
  with check (
    auth.uid() = from_user
    and (to_user is null or not public.is_blocked_between(auth.uid(), to_user))
  );

-- profile_follows: refuse a new follow once blocked-between. (An existing
-- follow between two people who later get blocked is removed by the
-- trigger in section 3, not by this policy — this only stops a *new* one.)
drop policy if exists "you follow people as yourself" on public.profile_follows;
create policy "you follow people as yourself"
  on public.profile_follows for insert
  to authenticated
  with check (
    auth.uid() = follower_id
    and status = 'pending'
    and not public.is_blocked_between(auth.uid(), followed_id)
  );

-- reactions: tightened from `{public}` to `to authenticated` as part of
-- this change — anon could never satisfy `auth.uid() = user_id` anyway
-- (auth.uid() is null for anon), so this changes no real capability, but
-- it keeps every insert path that calls is_blocked_between() on an
-- authenticated-only policy, matching every other policy below and
-- avoiding a same-role EXECUTE check against the anon revoke in section 2.
drop policy if exists "you react as yourself" on public.reactions;
create policy "you react as yourself"
  on public.reactions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_blocked_between(
      auth.uid(),
      (select p.user_id from public.posts p where p.id = reactions.post_id)
    )
  );

-- thoughts: same write_blocked() (paused-account) guard as before, plus
-- the new block guard.
drop policy if exists "anyone signed in can add a thought" on public.thoughts;
create policy "anyone signed in can add a thought"
  on public.thoughts for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and not (select public.write_blocked())
    and not public.is_blocked_between(
      auth.uid(),
      (select p.user_id from public.posts p where p.id = thoughts.post_id)
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Message requests
-- ═══════════════════════════════════════════════════════════════════════

-- 6a. The database decides a direct_message's status — never the client.
drop trigger if exists participations_set_direct_message_status on public.participations;
drop function if exists public.set_direct_message_status();

create or replace function public.set_direct_message_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'direct_message' then
    return new;
  end if;

  if new.to_user is null then
    raise exception 'A direct message needs a recipient.';
  end if;

  -- Same wording as any other failure — the app must not let a rejection
  -- here reveal that a block exists.
  if public.is_blocked_between(new.from_user, new.to_user) then
    raise exception 'You can''t start a conversation with this person.';
  end if;

  if exists (
    select 1 from public.participations p
    where p.kind = 'direct_message'
      and ((p.from_user = new.from_user and p.to_user = new.to_user)
        or (p.from_user = new.to_user and p.to_user = new.from_user))
  ) then
    raise exception 'A direct message with this person already exists.';
  end if;

  new.status := case
    when exists (
      select 1 from public.profile_follows f
      where f.follower_id = new.to_user
        and f.followed_id = new.from_user
        and f.status = 'accepted'
    ) then 'accepted'
    else 'pending'
  end;
  new.responded_at := null;

  return new;
end;
$$;

create trigger participations_set_direct_message_status
  before insert on public.participations
  for each row execute function public.set_direct_message_status();

-- 6b. Close the update hole: only the recipient (to_user) may change a
-- participation's status at all, and only along the allowed path. This is
-- enforced twice, deliberately: the RLS policy decides *who* may attempt
-- an update at all, and the trigger decides *what* that update may
-- actually change, so a future accidental loosening of one doesn't reopen
-- the hole on its own.
drop policy if exists "the recipient answers" on public.participations;
create policy "the recipient answers"
  on public.participations for update
  to authenticated
  using (auth.uid() = to_user)
  with check (auth.uid() = to_user);

drop trigger if exists participations_enforce_status_transition on public.participations;
drop function if exists public.enforce_participation_status_transition();

create or replace function public.enforce_participation_status_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if auth.uid() is distinct from old.to_user then
      raise exception 'Only the recipient can change this request''s status.';
    end if;
    if not (
      (old.status = 'pending' and new.status in ('accepted', 'declined'))
      or (old.status = 'declined' and new.status = 'accepted')
    ) then
      raise exception 'That status change isn''t allowed.';
    end if;
    new.responded_at := now();
  else
    new.responded_at := old.responded_at;
  end if;

  -- Nothing about who a participation is between, or what it's about,
  -- changes once it exists — same principle as connections.sql's
  -- "addressee can't forge who a connection is with" fix.
  new.from_user := old.from_user;
  new.to_user := old.to_user;
  new.kind := old.kind;
  new.post_id := old.post_id;
  new.hobby_key := old.hobby_key;
  new.intent := old.intent;
  new.note := old.note;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger participations_enforce_status_transition
  before update on public.participations
  for each row execute function public.enforce_participation_status_transition();

-- 6c. messages: insert. Today's rule for an accepted thread, unchanged,
-- plus exactly one message from the sender into a pending direct_message —
-- the request's preview. The recipient can't send until they accept, and
-- the sender can't send a second one while waiting.
drop policy if exists "you can write in an accepted thread" on public.messages;
create policy "you can write in an accepted thread"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.kind in ('make_together', 'explore_together', 'direct_message')
        and not public.is_blocked_between(p.from_user, p.to_user)
        and (
          (p.status = 'accepted' and (auth.uid() = p.from_user or auth.uid() = p.to_user))
          or (
            p.status = 'pending'
            and p.kind = 'direct_message'
            and auth.uid() = p.from_user
            and not exists (select 1 from public.messages m2 where m2.participation_id = p.id)
          )
        )
    )
  );

-- 6d. messages: select. Both parties can read a pending thread (the
-- recipient needs to see what they're being asked to accept). A declined
-- thread was never delivered to the recipient, so only the sender still
-- sees their own message in it.
drop policy if exists "messages need an accepted participation" on public.messages;
create policy "messages need an accepted participation"
  on public.messages for select
  using (
    exists (
      select 1 from public.participations p
      where p.id = messages.participation_id
        and p.kind in ('make_together', 'explore_together', 'direct_message')
        and not public.is_blocked_between(p.from_user, p.to_user)
        and (
          (p.status = 'accepted' and (auth.uid() = p.from_user or auth.uid() = p.to_user))
          or (p.status = 'pending' and (auth.uid() = p.from_user or auth.uid() = p.to_user))
          or (p.status = 'declined' and auth.uid() = p.from_user)
        )
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 7. reports
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('profile', 'message', 'moment', 'thought')),
  target_id bigint,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  -- A profile report has nothing else to point at; every other kind must
  -- name the specific row being reported.
  constraint reports_target_id_shape check (
    (target_kind = 'profile' and target_id is null)
    or (target_kind <> 'profile' and target_id is not null)
  )
);
alter table public.reports enable row level security;

create index if not exists reports_target_idx on public.reports (target_kind, target_id);
create index if not exists reports_status_idx on public.reports (status, created_at);

drop policy if exists "you report as yourself" on public.reports;
create policy "you report as yourself"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = reporter_id);

drop policy if exists "you see your own reports, admins see all" on public.reports;
create policy "you see your own reports, admins see all"
  on public.reports for select
  to authenticated
  using (auth.uid() = reporter_id or private.is_admin(auth.uid()));

drop policy if exists "admins review reports" on public.reports;
create policy "admins review reports"
  on public.reports for update
  to authenticated
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

-- The client only ever needs to send the new status — who reviewed it and
-- when is the server's fact to record, not the caller's to assert. Nothing
-- about who reported what, or what was reported, changes after the fact.
drop trigger if exists reports_set_reviewed_meta on public.reports;
drop function if exists public.set_report_reviewed_meta();

create or replace function public.set_report_reviewed_meta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.reviewed_by := auth.uid();
    new.reviewed_at := now();
  else
    new.reviewed_by := old.reviewed_by;
    new.reviewed_at := old.reviewed_at;
  end if;

  new.reporter_id := old.reporter_id;
  new.target_user_id := old.target_user_id;
  new.target_kind := old.target_kind;
  new.target_id := old.target_id;
  new.reason := old.reason;
  new.note := old.note;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger reports_set_reviewed_meta
  before update on public.reports
  for each row execute function public.set_report_reviewed_meta();

-- Rate limit, same enforce_rate_limit() pattern as every other insert
-- trigger in sql/security-hardening.sql.
create or replace function public.rl_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('reports_insert', 20, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_reports_insert on public.reports;
create trigger rl_reports_insert before insert on public.reports
  for each row execute function public.rl_reports();
