-- Sushii: measured progress and pursuing together.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Additive only: two new columns on pursuits, two new
-- tables, and one widened select policy. No existing row is changed.
--
--   pursuits.mode     solo | together | group
--   pursuits.measure  how progress adds up (kind, target, unit, rules)
--   pursuit_members   who's in a Pursuit, and whether they've joined
--   pursuit_progress  every amount logged toward a Pursuit, by whom

alter table public.pursuits add column if not exists mode text not null default 'solo'
  check (mode in ('solo', 'together', 'group'));
alter table public.pursuits add column if not exists measure jsonb;

create table if not exists public.pursuit_members (
  pursuit_id text not null references public.pursuits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'invited' check (status in ('invited', 'joined', 'declined')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (pursuit_id, user_id)
);

create table if not exists public.pursuit_progress (
  id text primary key,
  pursuit_id text not null references public.pursuits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null check (amount >= 0 and amount <= 100000000),
  note text check (note is null or char_length(note) <= 1000),
  image_url text,
  post_id bigint references public.posts (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pursuit_progress_pursuit_idx on public.pursuit_progress (pursuit_id, created_at);
create index if not exists pursuit_members_user_idx on public.pursuit_members (user_id, status);

-- Security definer so policies can ask "is this person in this Pursuit?"
-- without recursing into pursuit_members' own policy.
create or replace function public.is_pursuit_participant(pid text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from pursuits where id = pid and user_id = uid)
      or exists (select 1 from pursuit_members where pursuit_id = pid and user_id = uid and status in ('invited', 'joined'));
$$;
revoke all on function public.is_pursuit_participant(text, uuid) from public;
grant execute on function public.is_pursuit_participant(text, uuid) to authenticated;

-- Pursuits: members (and invitees) can see the Pursuit they're in.
drop policy if exists "you see your own pursuits, others see only shared ones" on public.pursuits;
drop policy if exists "owners, members and the public (if shared) see a pursuit" on public.pursuits;
create policy "owners, members and the public (if shared) see a pursuit"
  on public.pursuits for select
  using (
    auth.uid() = user_id
    or shared = true
    or public.is_pursuit_participant(id, auth.uid())
  );

alter table public.pursuit_members enable row level security;

drop policy if exists "participants see the member list" on public.pursuit_members;
create policy "participants see the member list"
  on public.pursuit_members for select to authenticated
  using (user_id = auth.uid() or public.is_pursuit_participant(pursuit_id, auth.uid()));

-- Only the Pursuit's owner invites.
drop policy if exists "owner invites" on public.pursuit_members;
create policy "owner invites"
  on public.pursuit_members for insert to authenticated
  with check (exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()));

-- The invitee answers their own invite; the owner can also change rows.
drop policy if exists "invitee answers, owner manages" on public.pursuit_members;
create policy "invitee answers, owner manages"
  on public.pursuit_members for update to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()))
  with check (user_id = auth.uid() or exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()));

drop policy if exists "leave or remove" on public.pursuit_members;
create policy "leave or remove"
  on public.pursuit_members for delete to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()));

alter table public.pursuit_progress enable row level security;

drop policy if exists "participants and shared viewers see progress" on public.pursuit_progress;
create policy "participants and shared viewers see progress"
  on public.pursuit_progress for select
  using (
    public.is_pursuit_participant(pursuit_id, auth.uid())
    or exists (select 1 from public.pursuits p where p.id = pursuit_id and p.shared = true)
  );

-- You log only your own progress, and only in a Pursuit you own or joined.
drop policy if exists "participants log their own progress" on public.pursuit_progress;
create policy "participants log their own progress"
  on public.pursuit_progress for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid())
      or exists (select 1 from public.pursuit_members m where m.pursuit_id = pursuit_progress.pursuit_id and m.user_id = auth.uid() and m.status = 'joined')
    )
  );

drop policy if exists "you delete your own progress" on public.pursuit_progress;
create policy "you delete your own progress"
  on public.pursuit_progress for delete to authenticated
  using (user_id = auth.uid());
