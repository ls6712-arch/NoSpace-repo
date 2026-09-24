-- Sushii: invite links for Pursuits, and bell notifications for them.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20260923110000_pursuits_measured_and_shared.sql.
--
-- Safe to re-run. Additive: one new table, three functions, three triggers.
-- Nothing existing is changed or removed.
--
-- Invite links: the owner makes a link (/join/<token>). Anyone with it can
-- see a preview (title, who invited them) — even signed out — and, once
-- signed in, join. The token is the only secret; the owner can revoke it.
--
-- Notifications go into the existing public.notifications table, written by
-- triggers (security definer) so the app never has to insert them itself:
--   pursuit_invite    you were invited to a Pursuit
--   pursuit_joined    someone joined your Pursuit
--   pursuit_progress  someone logged progress on a Pursuit you're in

create table if not exists public.pursuit_invite_links (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  pursuit_id text not null references public.pursuits (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists pursuit_invite_links_pursuit_idx on public.pursuit_invite_links (pursuit_id);

alter table public.pursuit_invite_links enable row level security;

drop policy if exists "owner sees their pursuit's links" on public.pursuit_invite_links;
create policy "owner sees their pursuit's links"
  on public.pursuit_invite_links for select to authenticated
  using (exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()));

drop policy if exists "owner makes links" on public.pursuit_invite_links;
create policy "owner makes links"
  on public.pursuit_invite_links for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid())
  );

drop policy if exists "owner revokes links" on public.pursuit_invite_links;
create policy "owner revokes links"
  on public.pursuit_invite_links for update to authenticated
  using (exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()))
  with check (exists (select 1 from public.pursuits p where p.id = pursuit_id and p.user_id = auth.uid()));

-- What the /join page shows. Callable signed out: returns only the title,
-- goal, who invited you and how many have joined — never anyone's progress.
create or replace function public.pursuit_invite_preview(invite_token text)
returns table (
  pursuit_id text,
  title text,
  mode text,
  measure jsonb,
  owner_id uuid,
  owner_name text,
  owner_avatar text,
  member_count integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.title,
    p.mode,
    p.measure,
    p.user_id,
    coalesce(nullif(trim(pr.display_name), ''), pr.username, 'Someone'),
    pr.avatar_url,
    (select count(*)::int from pursuit_members m where m.pursuit_id = p.id and m.status = 'joined')
  from pursuit_invite_links l
  join pursuits p on p.id = l.pursuit_id
  left join profiles pr on pr.id = p.user_id
  where l.token = invite_token and l.revoked_at is null;
$$;
revoke all on function public.pursuit_invite_preview(text) from public;
grant execute on function public.pursuit_invite_preview(text) to anon, authenticated;

-- Joins the signed-in person to the Pursuit behind a link. A solo Pursuit
-- becomes side by side the moment someone joins it.
create or replace function public.join_pursuit_via_link(invite_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pid text;
  owner uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join.';
  end if;
  select l.pursuit_id, p.user_id into pid, owner
  from pursuit_invite_links l
  join pursuits p on p.id = l.pursuit_id
  where l.token = invite_token and l.revoked_at is null;
  if pid is null then
    raise exception 'This invite link is no longer active.';
  end if;
  if owner = auth.uid() then
    return pid;
  end if;
  insert into pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (pid, owner, 'owner', 'joined', owner)
    on conflict (pursuit_id, user_id) do nothing;
  insert into pursuit_members (pursuit_id, user_id, role, status, invited_by)
    values (pid, auth.uid(), 'member', 'joined', owner)
    on conflict (pursuit_id, user_id) do update set status = 'joined';
  update pursuits set mode = 'together' where id = pid and mode = 'solo';
  return pid;
end;
$$;
revoke all on function public.join_pursuit_via_link(text) from public;
grant execute on function public.join_pursuit_via_link(text) to authenticated;

-- ── Notifications ───────────────────────────────────────────────────────

create or replace function public.pursuit_person_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(display_name), ''), username, 'Someone') from profiles where id = uid;
$$;

create or replace function public.notify_pursuit_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  who text;
begin
  select id, title, user_id into p from pursuits where id = new.pursuit_id;
  if p.id is null or new.role <> 'member' then
    return new;
  end if;

  -- Invited: tell the invitee.
  if tg_op = 'INSERT' and new.status = 'invited' then
    who := coalesce(public.pursuit_person_name(p.user_id), 'Someone');
    insert into notifications (user_id, kind, body, href, actor_name)
      values (new.user_id, 'pursuit_invite', who || ' invited you to ' || p.title || '.', '/my-space', who);
  end if;

  -- Joined (straight from a link, or by accepting an invite): tell the owner.
  if new.status = 'joined' and (tg_op = 'INSERT' or old.status is distinct from 'joined') then
    who := coalesce(public.pursuit_person_name(new.user_id), 'Someone');
    insert into notifications (user_id, kind, body, href, actor_name)
      values (p.user_id, 'pursuit_joined', who || ' joined ' || p.title || '.', '/pursuit/' || p.id, who);
  end if;
  return new;
end;
$$;

drop trigger if exists notify_pursuit_membership on public.pursuit_members;
create trigger notify_pursuit_membership
  after insert or update of status on public.pursuit_members
  for each row execute function public.notify_pursuit_membership();

create or replace function public.notify_pursuit_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
  who text;
  unit text;
  what text;
begin
  select id, title, user_id, mode, measure into p from pursuits where id = new.pursuit_id;
  if p.id is null or p.mode = 'solo' then
    return new;
  end if;
  who := coalesce(public.pursuit_person_name(new.user_id), 'Someone');
  unit := coalesce(p.measure ->> 'unit', '');
  what := case
    when new.amount > 0 then 'logged ' || trim_scale(new.amount)::text || case when unit <> '' then ' ' || unit else '' end || ' on '
    else 'added a Moment to '
  end;
  insert into notifications (user_id, kind, body, href, actor_name)
    select uid, 'pursuit_progress', who || ' ' || what || p.title || '.', '/pursuit/' || p.id, who
    from (
      select p.user_id as uid
      union
      select m.user_id from pursuit_members m where m.pursuit_id = p.id and m.status = 'joined'
    ) participants
    where uid <> new.user_id;
  return new;
end;
$$;

drop trigger if exists notify_pursuit_progress on public.pursuit_progress;
create trigger notify_pursuit_progress
  after insert on public.pursuit_progress
  for each row execute function public.notify_pursuit_progress();
