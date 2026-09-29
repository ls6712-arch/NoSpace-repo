
-- Step 2 · Invite-only sign-up. Codes are stored as XXXX-XXXX but matched
-- ignoring case, spaces and hyphens.

alter table public.profiles
  add column if not exists access text not null default 'pending'
    check (access in ('active', 'pending')),
  add column if not exists invited_by uuid references public.profiles(id) on delete set null,
  add column if not exists invite_allowance integer not null default 0
    check (invite_allowance between 0 and 50);

update public.profiles set access = 'active' where access <> 'active';

revoke update (access, invited_by, invite_allowance) on public.profiles from anon, authenticated;
revoke insert (access, invited_by, invite_allowance) on public.profiles from anon, authenticated;

create or replace function private.is_active(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.access = 'active' from public.profiles p where p.id = uid), false)
$$;
grant execute on function private.is_active(uuid) to anon, authenticated;

insert into public.app_config (key, value)
values ('invites_per_new_member', '0'::jsonb)
on conflict (key) do nothing;

create table public.invites (
  code        text primary key,
  inviter_id  uuid not null references public.profiles(id) on delete cascade,
  note        text check (note is null or char_length(note) <= 280),
  status      text not null default 'open' check (status in ('open', 'claimed', 'revoked')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '14 days',
  claimed_by  uuid references public.profiles(id) on delete set null,
  claimed_at  timestamptz,
  revoked_at  timestamptz
);
create index invites_inviter_idx on public.invites (inviter_id, created_at desc);

alter table public.invites enable row level security;
create policy "invites: see your own, admins see all" on public.invites
  for select to authenticated
  using (inviter_id = (select auth.uid()) or private.is_admin((select auth.uid())));
revoke all on public.invites from anon;
revoke insert, update, delete, truncate, references, trigger on public.invites from authenticated;
grant select on public.invites to authenticated;

create table public.waitlist (
  id         bigint generated always as identity primary key,
  email      text not null check (char_length(email) <= 254),
  hobby      text check (hobby is null or char_length(hobby) <= 80),
  created_at timestamptz not null default now()
);
create unique index waitlist_email_unique on public.waitlist (lower(email));

alter table public.waitlist enable row level security;
create policy "waitlist: admins read" on public.waitlist
  for select to authenticated
  using (private.is_admin((select auth.uid())));
revoke all on public.waitlist from anon;
revoke insert, update, delete, truncate, references, trigger on public.waitlist from authenticated;
grant select on public.waitlist to authenticated;

create or replace function private.gen_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  out_code text := '';
begin
  for i in 0..7 loop
    out_code := out_code || substr(alphabet, 1 + (get_byte(bytes, i) % 31), 1);
    if i = 3 then out_code := out_code || '-'; end if;
  end loop;
  return out_code;
end
$$;

create or replace function public.create_invite(p_note text default null)
returns table (invite_code text, invite_expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  me record;
  used integer;
  new_code text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  select p.is_admin, p.access, p.invite_allowance into me
  from public.profiles p where p.id = uid;

  if me.access is distinct from 'active' then
    raise exception 'Your account isn''t active yet.' using errcode = '42501';
  end if;

  if not coalesce(me.is_admin, false) then
    select count(*) into used
    from public.invites i
    where i.inviter_id = uid
      and (i.status = 'claimed' or (i.status = 'open' and i.expires_at > now()));
    if used >= me.invite_allowance then
      raise exception 'No invites left.' using errcode = 'P0001';
    end if;
  end if;

  loop
    new_code := private.gen_invite_code();
    exit when not exists (select 1 from public.invites i where i.code = new_code);
  end loop;

  return query
  insert into public.invites (code, inviter_id, note)
  values (new_code, uid, nullif(btrim(p_note), ''))
  returning public.invites.code, public.invites.expires_at;
end
$$;

create or replace function public.revoke_invite(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.invites i
  set status = 'revoked', revoked_at = now()
  where replace(i.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and i.inviter_id = auth.uid()
    and i.status = 'open';
  return found;
end
$$;

create or replace function public.invite_preview(p_code text)
returns table (is_valid boolean, inviter_name text, inviter_avatar text, note text)
language sql
stable
security definer
set search_path = ''
as $$
  select true, p.display_name, p.avatar_url, i.note
  from public.invites i
  join public.profiles p on p.id = i.inviter_id
  where replace(i.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
    and i.status = 'open'
    and i.expires_at > now()
  union all
  select false, null, null, null
  where not exists (
    select 1 from public.invites i
    where replace(i.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and i.status = 'open' and i.expires_at > now())
$$;

create or replace function public.claim_invite(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  inv public.invites%rowtype;
  grant_n integer;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '28000';
  end if;

  if private.is_active(uid) then
    return 'already_active';
  end if;

  select * into inv from public.invites i
  where replace(i.code, '-', '') = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  for update;

  if not found or inv.status <> 'open' or inv.expires_at <= now() or inv.inviter_id = uid then
    return 'invalid';
  end if;

  select coalesce((c.value #>> '{}')::integer, 0) into grant_n
  from public.app_config c where c.key = 'invites_per_new_member';

  update public.invites
  set status = 'claimed', claimed_by = uid, claimed_at = now()
  where code = inv.code;

  update public.profiles
  set access = 'active', invited_by = inv.inviter_id, invite_allowance = coalesce(grant_n, 0)
  where id = uid;

  insert into public.profile_follows (follower_id, followed_id, status, responded_at)
  values (uid, inv.inviter_id, 'accepted', now()),
         (inv.inviter_id, uid, 'accepted', now())
  on conflict (follower_id, followed_id)
  do update set status = 'accepted', responded_at = now();

  return 'claimed';
end
$$;

create or replace function public.join_waitlist(p_email text, p_hobby text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_email text := lower(btrim(p_email));
begin
  if clean_email is null
     or char_length(clean_email) > 254
     or clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email.' using errcode = '22023';
  end if;

  insert into public.waitlist (email, hobby)
  values (clean_email, nullif(left(btrim(p_hobby), 80), ''))
  on conflict ((lower(email))) do nothing;

  return true;
end
$$;

revoke all on function public.create_invite(text)       from public, anon;
revoke all on function public.revoke_invite(text)       from public, anon;
revoke all on function public.claim_invite(text)        from public, anon;
revoke all on function public.invite_preview(text)      from public;
revoke all on function public.join_waitlist(text, text) from public;
revoke all on function private.gen_invite_code()        from public, anon, authenticated;
grant execute on function public.create_invite(text)       to authenticated;
grant execute on function public.revoke_invite(text)       to authenticated;
grant execute on function public.claim_invite(text)        to authenticated;
grant execute on function public.invite_preview(text)      to anon, authenticated;
grant execute on function public.join_waitlist(text, text) to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'posts', 'thoughts', 'reactions', 'messages', 'private_logs', 'pursuits',
    'pursuit_progress', 'pursuit_members', 'profile_follows', 'participations',
    'post_reflections', 'bookmarks', 'moment_drafts', 'hobby_follows'
  ] loop
    execute format(
      'create policy %I on public.%I as restrictive for insert to authenticated
         with check (private.is_active((select auth.uid())))',
      'active accounts only', t);
  end loop;
end
$$;

create policy "moment-media: active accounts only"
  on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'moment-media' or private.is_active((select auth.uid())));
