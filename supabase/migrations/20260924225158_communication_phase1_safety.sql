-- Sushii: Communication Phase 1 (Safety) — blocking, reporting, and message
-- requests.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Applied to live Supabase 2026-09-24, in four passes: this file, then
-- three small follow-up fixes for bugs the verification script itself
-- caught mid-run (kept inline below, at the point each one applies,
-- rather than as separate migration files, since nothing had shipped to
-- users yet):
--   1. messages' own INSERT policy hit Postgres's RLS self-recursion
--      guard (42P17) on every insert — fixed via
--      private.participation_has_message().
--   2. A blocked person could still react to / comment on the blocker's
--      Moment: the block check's own "who owns this post" subquery was
--      itself subject to posts' new block-aware RLS, so it silently
--      returned NULL (no rows) once the block hid the post, which made
--      the block check vacuously pass — fixed via private.post_owner().
--   3. Hygiene: revoked direct EXECUTE (anon/authenticated) on the six
--      new trigger functions, per the security advisors — not exploitable
--      either way (Postgres refuses to invoke a RETURNS TRIGGER function
--      outside trigger context), but free to close.
-- See docs/communication-strategy.md for the full plan this implements.
--
-- Everything here is enforced by RLS policies and triggers, not just hidden
-- in the app client — the app is not a trust boundary; someone calling the
-- database directly with their own login must hit the same walls.
--
-- ── Changes from the first draft, per review ─────────────────────────────
--
-- 1. "you can ask" only ever checked `from_user`/block — a client could
--    insert a make_together/explore_together already `status = 'accepted'`
--    and open a message thread with anyone, no request step, no message
--    request. The insert trigger (section 6a, now covering all three
--    "ask" kinds, not just direct_message) forces `pending` for both,
--    server-side. `join_in` is untouched — it's `accepted` on insert by
--    design (src/app/context/SocialContext.tsx's joinIn()).
-- 2. `notifications`' insert policy was `with check (true)` to `{public}`
--    — even signed OUT, anyone could write into anyone's inbox: forge
--    `body`/`actor_name`/`href`, or notify past a block. Section 8 below
--    adds a real `actor_id` (server-set, never the client's), rejects a
--    blocked-between actor (silently — see that section for why not an
--    error), constrains `href` to an in-app path, and caps `body` length.
--    The kind allowlist covers every kind any current code path — client
--    or the existing SECURITY DEFINER pursuit-notification triggers —
--    actually inserts (checked against every `notify()` call site and
--    every `insert into notifications` in supabase/migrations/), plus
--    `message_request` for Part B. Self-notification is deliberately left
--    alone: `hobby_follow`'s "You're exploring X" is a real note-to-self
--    the app relies on.
-- 3. `is_blocked_between` moved from `public` to `private` (matching
--    `private.is_admin`'s schema — PostgREST doesn't expose `private` at
--    all, which is the actual reason `is_admin` isn't callable over the
--    API despite its own EXECUTE grants; this now works the same way).
--    Kept SECURITY DEFINER, unlike `is_admin` — it has to be, or its own
--    read of `blocks` would be subject to the *caller's* RLS on that
--    table (`blocker_id = auth.uid()` only), meaning a blocked person
--    checking themselves against the person who blocked them would see
--    no row and the whole check would silently pass. EXECUTE is still
--    revoked from anon/public and granted only to `authenticated`, same
--    as before, on top of the schema no longer being reachable at all.
-- 4. "you can withdraw" let a sender delete a declined (or still-pending)
--    direct_message and immediately open a new one — Ignore didn't stick.
--    direct_message can no longer be deleted at all; join_in (the only
--    kind anything in the app actually deletes today — leaveActivity())
--    and make_together/explore_together withdrawal are untouched.
-- 5. The "one direct_message per pair" rule was trigger-only, so two
--    concurrent inserts could race past the `exists` check. Backed now by
--    a real unique index. Checked live (2026-09-24): zero existing
--    duplicate pairs, so this creates cleanly.
--
-- ── What this migration does, in plain language ─────────────────────────
--
-- 1. A new `blocks` table. Blocking someone is one-directional (you did it),
--    but its effect is mutual: neither of you can reach the other any more.
--    The blocked person can never read the blocks table — they're not told.
--
-- 2. `private.is_blocked_between(a, b)`: true if either has blocked the
--    other. This is the one function every other rule below calls, so
--    "full block" means the same thing everywhere.
--
-- 3. Blocking someone instantly deletes any follow between you, both ways.
--
-- 4. The block is enforced at the point of every write it should stop
--    (messaging, requesting, following, reacting, commenting, notifying)
--    and by hiding rows on read (profiles, posts, thoughts — and, as a
--    natural side effect of reusing the same profile-visibility helper,
--    hobby follows, post likes and profile links too — a blocked-between
--    person's activity disappears from view in both directions, not just
--    the parts explicitly called out).
--
-- 5. Message requests. Today every direct_message participation is inserted
--    already `status = 'accepted'` by the client — this migration makes the
--    database decide instead: accepted immediately if the recipient already
--    follows the sender, pending otherwise. Make together / Explore
--    together are also forced to `pending` on insert now (see change 1
--    above). It also closes a real hole — the existing "the recipient
--    answers" policy let EITHER side of a request update its status, so a
--    sender could accept their own ask. Only the recipient may now change a
--    request's status, and only along pending→accepted, pending→declined,
--    declined→accepted. A pending direct_message thread allows exactly one
--    message from the sender (a preview the recipient can read before
--    deciding) and nothing from the recipient until they accept.
--
-- 6. A `reports` table: report a profile, message, Moment or Thought.
--    Reporters see only their own reports; `private.is_admin` accounts see
--    and act on all of them.
--
-- 7. Every new function pins `search_path` and has EXECUTE revoked from
--    anon unless a currently-anon-reachable policy needs it internally
--    (see the `is_blocked_between` grants note in section 2).
--
-- 8. `notifications` is hardened per change 2 above.
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
-- 2. private.is_blocked_between(a, b) — the one source of truth every rule
--    below (and the app) calls.
--
--    Lives in `private`, not `public` — PostgREST doesn't expose that
--    schema at all (the same reason `private.is_admin` isn't reachable
--    over the API despite its own grants), so this is uncallable from the
--    client regardless of the EXECUTE grants below. Those grants are kept
--    tight anyway, for the same defense-in-depth reason `is_admin`'s are:
--    revoked from anon/public, granted only to `authenticated` — the
--    handful of policies that call it directly are all authenticated-only
--    writes. profiles/posts/thoughts SELECT (which do need to work for
--    anon) reach it *indirectly*, through is_visible_profile() below: that
--    function is itself SECURITY DEFINER, so its internal call runs as the
--    function owner, not the connecting role — anon's lack of direct
--    EXECUTE here never blocks that path.
--
--    Kept SECURITY DEFINER (unlike is_admin, which doesn't need it): its
--    own read of `blocks` must bypass the caller's RLS on that table
--    (`blocker_id = auth.uid()` only), or a blocked person checking
--    themselves against their own blocker would see no row and this would
--    silently return false for the one case it most needs to catch.
-- ═══════════════════════════════════════════════════════════════════════

create or replace function private.is_blocked_between(a uuid, b uuid)
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

revoke execute on function private.is_blocked_between(uuid, uuid) from public;
revoke execute on function private.is_blocked_between(uuid, uuid) from anon;
grant execute on function private.is_blocked_between(uuid, uuid) to authenticated;

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

-- Trigger functions only, never meant to be called directly — Postgres
-- refuses to invoke a RETURNS TRIGGER function outside trigger context
-- regardless of grants (confirmed live), so this is hygiene, not a real
-- exploit fix, but it's free and quiets the security advisor for every
-- trigger function this phase adds.
revoke execute on function public.on_block_remove_follows() from public, anon, authenticated;

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
      and private.is_blocked_between(auth.uid(), uid)
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
    and (to_user is null or not private.is_blocked_between(auth.uid(), to_user))
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
    and not private.is_blocked_between(auth.uid(), followed_id)
  );

-- private.post_owner(pid): resolves a Moment's owner bypassing the
-- CALLER's own RLS on posts. Without this, `select p.user_id from
-- public.posts p where p.id = ...` inside a policy runs under the
-- connecting role's own posts-SELECT policy — which, once someone is
-- blocked-between with the post's owner, now hides that very post
-- (section 4 above). The subquery then returns zero rows (NULL), and
-- `not is_blocked_between(x, null)` is true — silently defeating the
-- block check it's part of. Found live: a blocked B could still react to
-- and comment on A's Moment, precisely because A's post had just become
-- invisible to B. SECURITY DEFINER bypasses that (posts has no FORCE ROW
-- LEVEL SECURITY, so the table owner — which owns this function too — is
-- exempt), so the true owner is always resolved regardless of visibility.
create or replace function private.post_owner(pid bigint)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id from public.posts where id = pid;
$$;

revoke execute on function private.post_owner(bigint) from public;
revoke execute on function private.post_owner(bigint) from anon;
grant execute on function private.post_owner(bigint) to authenticated;

-- reactions: tightened from `{public}` to `to authenticated` as part of
-- this change — anon could never satisfy `auth.uid() = user_id` anyway
-- (auth.uid() is null for anon), so this changes no real capability, but
-- it keeps every insert path that calls is_blocked_between() on an
-- authenticated-only policy, matching every other policy below.
drop policy if exists "you react as yourself" on public.reactions;
create policy "you react as yourself"
  on public.reactions for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not private.is_blocked_between(auth.uid(), private.post_owner(reactions.post_id))
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
    and not private.is_blocked_between(auth.uid(), private.post_owner(thoughts.post_id))
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 6. Message requests
-- ═══════════════════════════════════════════════════════════════════════

-- 6a. The database decides an "ask" participation's status on insert —
-- never the client. join_in is untouched (accepted on insert, by design).
-- make_together/explore_together are forced to pending (change 1 above).
-- direct_message keeps its own accepted-if-known-sender / pending / reject
-- logic.
drop trigger if exists participations_set_direct_message_status on public.participations;
drop function if exists public.set_direct_message_status();
drop trigger if exists participations_set_insert_status on public.participations;
drop function if exists public.set_participation_insert_status();

create or replace function public.set_participation_insert_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'join_in' then
    return new;
  end if;

  if new.kind in ('make_together', 'explore_together') then
    -- The client used to be trusted to send 'pending' itself. A direct API
    -- call asking for 'accepted' would open a message thread with no
    -- request step and no message-request review at all.
    new.status := 'pending';
    new.responded_at := null;
    return new;
  end if;

  -- kind = 'direct_message' from here on (the only remaining value
  -- participations_kind_check allows).

  if new.to_user is null then
    raise exception 'A direct message needs a recipient.';
  end if;

  -- Same wording as any other failure — the app must not let a rejection
  -- here reveal that a block exists.
  if private.is_blocked_between(new.from_user, new.to_user) then
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

create trigger participations_set_insert_status
  before insert on public.participations
  for each row execute function public.set_participation_insert_status();

revoke execute on function public.set_participation_insert_status() from public, anon, authenticated;

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

revoke execute on function public.enforce_participation_status_transition() from public, anon, authenticated;

-- 6b-2. A direct_message can't be deleted at all — the old policy let a
-- sender delete a declined (or still-pending) thread and immediately open
-- a fresh one, defeating Ignore/Decline entirely. join_in (the only kind
-- anything in the app actually deletes today — SocialContext.tsx's
-- leaveActivity()) and a make_together/explore_together withdrawal are
-- untouched. Tightened from `{public}` to `to authenticated` too — same
-- no-op-for-anon reasoning as reactions/thoughts above.
drop policy if exists "you can withdraw" on public.participations;
create policy "you can withdraw"
  on public.participations for delete
  to authenticated
  using (auth.uid() = from_user and kind <> 'direct_message');

-- 6b-3. Back the trigger's "one direct_message per pair" check with a real
-- constraint, so two concurrent inserts can't both slip past it. Checked
-- live (2026-09-24): zero existing duplicate pairs.
create unique index if not exists participations_one_direct_message_per_pair
  on public.participations (least(from_user, to_user), greatest(from_user, to_user))
  where kind = 'direct_message';

-- private.participation_has_message(pid): whether any message already
-- exists for a participation, bypassing the CALLER's own RLS on messages.
-- Needed because Postgres detects "infinite recursion" (42P17) for ANY
-- subquery against a table from within that table's own RLS policy, even
-- one that logically terminates — found live: a plain `not exists (select
-- 1 from public.messages m2 where m2.participation_id = p.id)` inside
-- messages' own INSERT policy below raised "infinite recursion detected
-- in policy for relation messages" on the very first insert attempted.
-- SECURITY DEFINER sidesteps this entirely: the function's internal query
-- bypasses RLS (messages has no FORCE ROW LEVEL SECURITY, so the table
-- owner — which owns this function too — is exempt), so from the outer
-- policy's perspective there's no longer a direct subquery on messages at
-- all, only a function call.
create or replace function private.participation_has_message(pid bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.messages where participation_id = pid);
$$;

revoke execute on function private.participation_has_message(bigint) from public;
revoke execute on function private.participation_has_message(bigint) from anon;
grant execute on function private.participation_has_message(bigint) to authenticated;

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
        and not private.is_blocked_between(p.from_user, p.to_user)
        and (
          (p.status = 'accepted' and (auth.uid() = p.from_user or auth.uid() = p.to_user))
          or (
            p.status = 'pending'
            and p.kind = 'direct_message'
            and auth.uid() = p.from_user
            and not private.participation_has_message(p.id)
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
        and not private.is_blocked_between(p.from_user, p.to_user)
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

revoke execute on function public.set_report_reviewed_meta() from public, anon, authenticated;

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
revoke execute on function public.rl_reports() from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════
-- 8. notifications hardening
--
--    The live INSERT policy was `with check (true)` to `{public}` —
--    reachable even signed OUT. A direct API call could forge body,
--    actor_name and href, or keep notifying someone past a block.
--
--    Fixed with a real actor_id (server-set below, never the client's)
--    plus a BEFORE INSERT trigger, rather than only a tighter WITH CHECK:
--    a trigger can rewrite NEW (actor_id, actor_name) and can *silently
--    drop* a row (RETURN NULL) rather than erroring — which matters here
--    because the existing SECURITY DEFINER pursuit-notification triggers
--    (notify_pursuit_membership / notify_pursuit_progress,
--    20260923120000_pursuit_invite_links_and_notifications.sql) insert
--    for several recipients in one statement; raising on a single
--    blocked-between recipient would abort that whole batch and lose
--    every other participant's notification too. Table triggers always
--    fire regardless of who's writing (unlike RLS, which those two
--    functions bypass entirely as SECURITY DEFINER) — so this applies
--    uniformly to the client path and both existing internal paths, and
--    the kind allowlist below had to include every kind either one uses.
--
--    Second review, two more fixes:
--    - actor_name was still whatever the client sent. Checked what the
--      pursuit triggers write: both compute it via
--      `public.pursuit_person_name(uid)` — display_name, falling back to
--      username, falling back to 'Someone' — for whichever person the
--      notification is actually about (always the same person auth.uid()
--      resolves to in practice: the pursuit owner sending an invite, or
--      the member joining/logging progress). Rather than reject a mismatch
--      (which would misfire on that fallback — someone with no
--      display_name but a username legitimately writes a name that isn't
--      their raw profiles.display_name), a mismatch is corrected to
--      `pursuit_person_name(actor_id)` instead — the same trusted formula,
--      computed server-side. 'Someone' and 'You' stay as explicit allowed
--      placeholders (ConnectionsContext.tsx's circle_invite sends
--      'Someone' as its own fallback).
--    - href tightened to sql/security-hardening.sql section 4's own
--      pattern (`^/[a-zA-Z0-9/_?=&-]*$`), kept alongside the explicit
--      "not protocol-relative" check rather than instead of it — the
--      character class has no `.`, so today it already rejects a
--      real-looking host, but the `//`-prefix check stays as an
--      independent, pattern-independent backstop. Checked every href any
--      current call site sends (notify()'s own six, circle_invite's
--      '/inbox', and the pursuit triggers' '/my-space' and
--      '/pursuit/<id>') — none contain anything outside this pattern.
--    - 'space_invite' added to the kind allowlist — on the app's intended
--      list (sql/security-hardening.sql section 4) even though nothing
--      currently inserts it live.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.notifications add column if not exists actor_id uuid references auth.users (id) on delete set null;

drop policy if exists "signed-in users can notify" on public.notifications;
create policy "signed-in users can notify"
  on public.notifications for insert
  to authenticated
  with check (true);

create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Who actually ran this INSERT — never whatever the client sent.
  new.actor_id := auth.uid();

  -- Every kind any current code path inserts: the six from notify()'s own
  -- call sites in SocialContext.tsx (hobby_follow, joined, make_together,
  -- explore_together, thought, message), "accepted" from respond(),
  -- "circle_invite" from ConnectionsContext.tsx, "message_request" for
  -- Part B's pending-DM notice, "space_invite" (on the app's intended list,
  -- sql/security-hardening.sql section 4, though nothing inserts it live
  -- today), and the three from the pursuit triggers this table trigger
  -- also has to let through: pursuit_invite, pursuit_joined,
  -- pursuit_progress.
  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'circle_invite', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  -- actor_name: never trust the client's claim about who they are.
  -- 'Someone'/'You' are explicit allowed placeholders (ConnectionsContext's
  -- own fallback is 'Someone'); anything else must be the actor's own
  -- current name — corrected to that, not rejected, since that's also
  -- exactly what a legitimate caller using the fallback formula
  -- (no display_name, but a username) would otherwise trip on.
  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  -- In-app path only: sql/security-hardening.sql section 4's own pattern,
  -- plus an explicit not-protocol-relative check kept alongside it (see
  -- this section's header comment for why both).
  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  -- Silently dropped, not rejected with an error — see this section's
  -- header comment for why. Self-notification is deliberately left alone:
  -- hobby_follow's "You're exploring X" is a real note-to-self the app
  -- relies on, and is_blocked_between(x, x) is false anyway (no self-block
  -- can exist), so this never touches that case.
  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  return new;
end;
$$;

drop trigger if exists notifications_enforce_insert on public.notifications;
create trigger notifications_enforce_insert
  before insert on public.notifications
  for each row execute function public.enforce_notification_insert();
revoke execute on function public.enforce_notification_insert() from public, anon, authenticated;
