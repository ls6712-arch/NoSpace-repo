-- NoSpace: real invite-and-accept membership for Circles.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Run after connections.sql and security-hardening.sql
-- (reuses their notifications table, enforce_rate_limit helper, and the
-- invited_by/status column conventions from space_members).
--
-- Circles (src/app/data/circles.ts) are static, hand-written seed data —
-- there is no `circles` table, so circle_id below is a plain integer
-- matching that file's own Circle.id, not a foreign key. Before this,
-- "joining" a Circle (ContentContext.tsx's joinCircle/isCircleJoined) was
-- entirely local: an id kept in this browser's own localStorage, with no
-- way to invite one specific other person, and no way for a Circle's
-- displayed member count to ever reflect a real join across accounts or
-- devices. That local join stays exactly as it is — the same fast,
-- no-account path every other local-first feature in this app already
-- uses — this table only backs the new, genuinely cross-account case: one
-- person inviting another specific person, who has to accept it from their
-- own account before it counts as a real join.

create table if not exists public.circle_invites (
  id bigint generated always as identity primary key,
  circle_id bigint not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  /** 'invited' until they accept; 'joined' after — same two-step shape as space_members. */
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  unique (circle_id, user_id)
);
alter table public.circle_invites enable row level security;

-- Individual membership rows stay private to the two people involved — the
-- same visibility rule as a connection or a Space invitation. The Circle's
-- own displayed member count is a public aggregate instead
-- (circle_member_counts below), never a raw row list, so nobody's specific
-- membership becomes visible to a stranger just because the count needs to
-- be public.
drop policy if exists "you see your own circle invitations" on public.circle_invites;
create policy "you see your own circle invitations"
  on public.circle_invites for select
  using (user_id = auth.uid() or invited_by = auth.uid());

-- Circles have no owner and nothing gating who can join today — anyone can
-- already join any Circle directly, for free, with the existing local Join
-- button (requiring "already a member" here would be unenforceable anyway,
-- since that direct join never writes a row here at all). Inviting one
-- specific person doesn't need to be more restrictive than joining
-- yourself already is — same open, no-moderator spirit as Corners
-- (corners.sql). What this policy does guard is the exact self-join bug
-- security-hardening.sql had to fix for space_members: invited_by must be
-- the real caller, and nobody can "invite" themselves through this table —
-- that's what the local Join button is for.
drop policy if exists "anyone can invite anyone to a circle" on public.circle_invites;
create policy "anyone can invite anyone to a circle"
  on public.circle_invites for insert to authenticated
  with check (invited_by = auth.uid() and user_id <> auth.uid());

-- You answer your own invitation. Nobody accepts on your behalf.
drop policy if exists "you answer your own circle invitation" on public.circle_invites;
create policy "you answer your own circle invitation"
  on public.circle_invites for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Locked at the column-privilege level too, same reasoning as
-- security-hardening.sql's space_members fix: respondToCircleInvitation
-- only ever changes `status`, so nothing else should be reachable even if
-- a row-level policy above is loosened by mistake later.
revoke update (circle_id, user_id, invited_by) on public.circle_invites from authenticated;

drop policy if exists "you can leave a circle you joined" on public.circle_invites;
create policy "you can leave a circle you joined"
  on public.circle_invites for delete
  using (user_id = auth.uid());

-- A public, row-free aggregate: how many people have really joined each
-- Circle, without exposing who they are to everyone. Same SECURITY DEFINER
-- pattern as is_space_member/owns_space (space-fix.sql) — this runs with
-- the function owner's rights, so it can read every row while the select
-- policy above keeps the rows themselves private. Returns one row per
-- Circle that has at least one real joined member; a Circle with none
-- simply isn't in the result, so the caller adds its own baseline
-- unconditionally rather than treating a missing row as zero.
create or replace function public.circle_member_counts()
returns table(circle_id bigint, member_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select circle_id, count(*) as member_count
  from public.circle_invites
  where status = 'joined'
  group by circle_id;
$$;
grant execute on function public.circle_member_counts() to anon, authenticated;

create index if not exists circle_invites_user_idx on public.circle_invites (user_id, status);
create index if not exists circle_invites_circle_idx on public.circle_invites (circle_id, status);

-- Rate limit invites, same shape and bound as space_members
-- (security-hardening.sql) — nothing here should let one account spam
-- every other account with Circle invitations.
create or replace function public.rl_circle_invites() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('circle_invites_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_circle_invites_insert on public.circle_invites;
create trigger rl_circle_invites_insert before insert on public.circle_invites
  for each row execute function public.rl_circle_invites();

-- Add the new notification kind to the allowlist security-hardening.sql
-- locked notifications.kind down to — without this, respondToCircleInvitation's
-- own notify() call (kind: 'circle_invite') would be silently rejected by
-- RLS, same failure mode the app already guards against for every other
-- notification kind it sends.
drop policy if exists "signed-in users can notify" on public.notifications;
create policy "signed-in users can notify"
  on public.notifications for insert to authenticated
  with check (
    kind = any (array[
      'make_together', 'explore_together', 'accepted',
      'hobby_follow', 'joined', 'thought', 'message',
      'connect_request', 'connect_accepted', 'space_invite', 'circle_invite'
    ])
    and (href is null or href ~ '^/[a-zA-Z0-9/_?=&-]*$')
    and (
      actor_name is null
      or actor_name in ('Someone', 'You')
      or actor_name = (select p.display_name from public.profiles p where p.id = auth.uid())
    )
  );
