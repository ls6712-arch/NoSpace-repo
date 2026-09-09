-- NoSpace: close privilege-escalation gaps in existing RLS policies, lock
-- down a few unrestricted writes, and add rate limiting.
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Independent of the other files, except it assumes
-- categories.sql, connections.sql, social.sql, corners.sql and
-- profile-links.sql have already been run (it references tables and
-- functions they create).
--
-- Nothing here removes a feature. Every fix below was checked against the
-- app's actual client code first — the column or bypass being closed is one
-- nothing in the app currently relies on, only something the API surface
-- allowed a hand-crafted request to do.

-- ═════════════════════════════════════════════════════════════════════════
-- 1. CRITICAL — profiles.is_admin is self-grantable
--
--    "you edit your own profile" (people.sql) lets a signed-in user update
--    any column on their own row, including is_admin. Nothing in the app UI
--    does this, but nothing stops a direct API call from doing
--    `update profiles set is_admin = true where id = auth.uid()` and
--    walking straight into "reviewers decide" (categories.sql) — full
--    control of category_suggestions and categories.
--
--    Fix: revoke UPDATE on that one column from the role every signed-in
--    request actually runs as. This is a blanket rule, not a per-row policy
--    (nobody grants themselves admin, ever, via the API) — the "make
--    yourself an admin" UPDATE in categories.sql still works because it
--    runs as the SQL Editor's own role, not `authenticated`.
-- ═════════════════════════════════════════════════════════════════════════
revoke update (is_admin) on public.profiles from authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 2. CRITICAL — space_members: self-join into any Space, invite or not
--
--    "members invite" (space-fix.sql) allows the insert whenever
--    invited_by = auth.uid() AND (member OR owner OR user_id = auth.uid()).
--    That last branch was meant to cover the owner's own first membership
--    row — but by the time that insert runs the Space already exists with
--    owner = auth.uid(), so owns_space() already covers it (confirmed
--    against src/app/context/ConnectionsContext.tsx: the space row is
--    created, then the owner's membership row, in that order). The branch
--    is dead weight that also lets ANY signed-in user insert themselves as
--    a 'joined' member of ANY Space — including 'invite'-only ones — with
--    no invitation, bypassing the entire point of Space visibility.
-- ═════════════════════════════════════════════════════════════════════════
drop policy if exists "members invite" on public.space_members;
create policy "members invite"
  on public.space_members for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.is_space_member(space_id, auth.uid())
      or public.owns_space(space_id, auth.uid())
    )
  );

-- role/space_id/user_id/invited_by are only ever set once, at insert
-- (src/app/context/ConnectionsContext.tsx never updates them — the only
-- update in the app is respondToInvitation, which touches `status` only).
-- Locking them at the column-privilege level means a member accepting their
-- own invitation can never rewrite their own role to 'owner', regardless of
-- what the row-level policy allows.
revoke update (role, space_id, user_id, invited_by) on public.space_members from authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 3. CRITICAL — connections: the addressee can forge who a connection is with
--
--    "only the addressee answers" (connections.sql) checks
--    auth.uid() = addressee on both the old and new row — but says nothing
--    about `requester`. The addressee answering a request could rewrite
--    `requester` to any third party, fabricating an accepted connection
--    that person never agreed to, which are_connected() would then honor —
--    unlocking messaging with them. Nothing in the app ever needs to change
--    who a connection is between after it's created; only status,
--    responded_at and note change on accept/decline.
-- ═════════════════════════════════════════════════════════════════════════
revoke update (requester, addressee) on public.connections from authenticated;

-- ═════════════════════════════════════════════════════════════════════════
-- 4. HIGH — notifications: anyone can write anything into anyone's inbox
--
--    "signed-in users can notify" (social.sql) is `with check (true)` — a
--    direct API call, not just the app's own notify() helper, can set
--    body/href/actor_name to anything. href pointing off-app plus a
--    trusted-looking actor_name is a phishing vector rendered with the
--    app's own UI chrome. Constrained here to exactly what the app itself
--    ever sends (checked against every notify()/insert call site).
-- ═════════════════════════════════════════════════════════════════════════
drop policy if exists "signed-in users can notify" on public.notifications;
create policy "signed-in users can notify"
  on public.notifications for insert to authenticated
  with check (
    kind = any (array[
      'make_together', 'explore_together', 'accepted',
      'hobby_follow', 'joined', 'thought', 'message',
      'connect_request', 'connect_accepted', 'space_invite'
    ])
    -- In-app relative paths only — never an absolute URL or another scheme.
    and (href is null or href ~ '^/[a-zA-Z0-9/_?=&-]*$')
    -- Either unclaimed, one of the app's own fallback strings, or the
    -- sender's own current display name — never someone else's name.
    and (
      actor_name is null
      or actor_name in ('Someone', 'You')
      or actor_name = (select p.display_name from public.profiles p where p.id = auth.uid())
    )
  );

-- ═════════════════════════════════════════════════════════════════════════
-- 5. MEDIUM — corners: any space_slug at all, no bound on volume
--
--    "anyone signed in can create a corner" (corners.sql) is
--    `with check (true)` — space_slug isn't checked against a real Space,
--    so a junk row can be inserted under a made-up slug, and CategoryFeed's
--    grid (reading cornersFor(), unfiltered by momentCount) would still
--    show it on that Space's page. Constrained to the app's own fixed list
--    of fifteen Space slugs (src/app/data/hobbies.ts) — the rate limit in
--    section 7 bounds the volume.
-- ═════════════════════════════════════════════════════════════════════════
drop policy if exists "anyone signed in can create a corner" on public.corners;
create policy "anyone signed in can create a corner"
  on public.corners for insert to authenticated
  with check (
    space_slug = any (array[
      'food-cooking', 'sports-fitness', 'art-creative', 'crafts-making',
      'books-writing', 'nature-outdoors', 'home-garden', 'gaming-tabletop',
      'music', 'photography-film', 'health-wellness', 'fashion-beauty',
      'tech-building', 'collecting-fandom', 'travel-adventure'
    ])
  );

-- ═════════════════════════════════════════════════════════════════════════
-- 6. Defensive — posts: explicit insert/delete, since neither is visible
--    anywhere in this repo's tracked SQL history
--
--    Every other write path here was introduced (and RLS-enabled) in a
--    tracked migration file; `posts` never was, which means its RLS state
--    predates these files — most likely set up once by hand in the
--    Supabase dashboard. That's not something this file can safely assume
--    is correct, so: enable RLS defensively (a no-op if already on) and add
--    the one insert/delete shape the app actually uses. If a different,
--    looser insert policy already exists on posts, Postgres OR's permissive
--    policies together — this addition cannot narrow an existing hole, only
--    guarantee a correct one exists. Run the query at the bottom of this
--    file and remove anything unexpected you find.
-- ═════════════════════════════════════════════════════════════════════════
alter table public.posts enable row level security;

drop policy if exists "you post your own moments" on public.posts;
create policy "you post your own moments"
  on public.posts for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "you delete your own moments" on public.posts;
create policy "you delete your own moments"
  on public.posts for delete
  using (auth.uid() = user_id);

-- ═════════════════════════════════════════════════════════════════════════
-- 7. Rate limiting
--
--    A generic ledger + SECURITY DEFINER check, attached as a BEFORE INSERT
--    trigger to every spam-prone write. Keyed by auth.uid() — the actual
--    session making the request — never by a column value the request body
--    supplies (notifications.user_id is the *recipient*, not the sender, so
--    counting against that column would let a spammer fan out across many
--    recipients unbounded; this counts the real actor instead). The ledger
--    has RLS enabled with zero policies, so it's unreachable from the
--    client entirely — only this SECURITY DEFINER function ever touches it.
-- ═════════════════════════════════════════════════════════════════════════
create table if not exists public.rate_limit_hits (
  id bigint generated always as identity primary key,
  action text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.rate_limit_hits enable row level security;
create index if not exists rate_limit_hits_lookup
  on public.rate_limit_hits (action, user_id, created_at);

create or replace function public.enforce_rate_limit(
  p_action text,
  p_max int,
  p_window interval
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt bigint;
  actor uuid := auth.uid();
begin
  if actor is null then
    return;
  end if;

  select count(*) into cnt
  from public.rate_limit_hits
  where action = p_action and user_id = actor and created_at > now() - p_window;

  if cnt >= p_max then
    raise exception 'Slow down — too many % actions recently. Try again in a bit.', p_action
      using errcode = '55000';
  end if;

  insert into public.rate_limit_hits (action, user_id) values (p_action, actor);

  -- Opportunistic cleanup instead of a scheduled job: a small fraction of
  -- calls also sweeps rows old enough that no window here could still need
  -- them.
  if random() < 0.002 then
    delete from public.rate_limit_hits where created_at < now() - interval '2 days';
  end if;
end;
$$;

-- One tiny trigger function per table, each naming its own action and
-- limit. Kept separate (rather than one generic trigger reading arguments)
-- because trigger functions can't take parameters directly.

create or replace function public.rl_posts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('posts_insert', 20, interval '10 minutes');
  return new;
end;
$$;
drop trigger if exists rl_posts_insert on public.posts;
create trigger rl_posts_insert before insert on public.posts
  for each row execute function public.rl_posts();

create or replace function public.rl_corners() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('corners_insert', 10, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_corners_insert on public.corners;
create trigger rl_corners_insert before insert on public.corners
  for each row execute function public.rl_corners();

create or replace function public.rl_connections() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('connections_insert', 20, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_connections_insert on public.connections;
create trigger rl_connections_insert before insert on public.connections
  for each row execute function public.rl_connections();

create or replace function public.rl_participations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('participations_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_participations_insert on public.participations;
create trigger rl_participations_insert before insert on public.participations
  for each row execute function public.rl_participations();

create or replace function public.rl_thoughts() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('thoughts_insert', 40, interval '10 minutes');
  return new;
end;
$$;
drop trigger if exists rl_thoughts_insert on public.thoughts;
create trigger rl_thoughts_insert before insert on public.thoughts
  for each row execute function public.rl_thoughts();

create or replace function public.rl_messages() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('messages_insert', 60, interval '10 minutes');
  return new;
end;
$$;
drop trigger if exists rl_messages_insert on public.messages;
create trigger rl_messages_insert before insert on public.messages
  for each row execute function public.rl_messages();

create or replace function public.rl_notifications() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('notifications_insert', 100, interval '10 minutes');
  return new;
end;
$$;
drop trigger if exists rl_notifications_insert on public.notifications;
create trigger rl_notifications_insert before insert on public.notifications
  for each row execute function public.rl_notifications();

create or replace function public.rl_category_suggestions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('category_suggestions_insert', 5, interval '1 day');
  return new;
end;
$$;
drop trigger if exists rl_category_suggestions_insert on public.category_suggestions;
create trigger rl_category_suggestions_insert before insert on public.category_suggestions
  for each row execute function public.rl_category_suggestions();

create or replace function public.rl_space_members() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.enforce_rate_limit('space_members_insert', 30, interval '1 hour');
  return new;
end;
$$;
drop trigger if exists rl_space_members_insert on public.space_members;
create trigger rl_space_members_insert before insert on public.space_members
  for each row execute function public.rl_space_members();

-- ═════════════════════════════════════════════════════════════════════════
-- 8. MEDIUM — storage: media uploads have no folder-ownership policy
--
--    src/app/context/ContentContext.tsx and src/app/components/
--    AvatarPicker.tsx both write to the "post-media" bucket under
--    `${user.id}/...` — but that's the client choosing a polite path, not
--    anything the database enforces. Nothing in this repo's tracked SQL
--    touches storage.objects, so whatever insert/update policy currently
--    lets uploads work at all was set up by hand and may not check the
--    folder. This adds the standard "your own top-level folder only" rule.
--    Safe to re-run — storage.objects already has RLS enabled by default
--    in every Supabase project.
-- ═════════════════════════════════════════════════════════════════════════
drop policy if exists "post-media is publicly readable" on storage.objects;
create policy "post-media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'post-media');

drop policy if exists "you upload into your own post-media folder" on storage.objects;
create policy "you upload into your own post-media folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "you replace your own post-media files" on storage.objects;
create policy "you replace your own post-media files"
  on storage.objects for update to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "you delete your own post-media files" on storage.objects;
create policy "you delete your own post-media files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- 9. Check what you've got
--
--    Run these on their own afterwards. The first should show exactly the
--    policies this file expects on `posts`; if you see an extra insert or
--    delete policy you didn't add yourself, it predates this file and may
--    be the looser one this section 6 was guarding against — read it and
--    decide whether to drop it.
-- ─────────────────────────────────────────────────────────────────────────
-- select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'posts';
-- select policyname, cmd, qual, with_check from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like '%post-media%';
