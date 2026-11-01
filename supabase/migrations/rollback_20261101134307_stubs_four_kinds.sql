-- Rollback for 20261115000000_stubs_four_kinds.sql.
-- Puts back one Stub per Moment toward a Pursuit ('session') and 'gold', and the readers,
-- counts and notification kinds as 20261110000000 left them. Finisher Stubs become 'gold'
-- again; drop and regular Stubs are removed (their kinds did not exist before), and so are
-- the drops table and pursuits.drop_id. Session Stubs removed by the migration are not
-- re-created: the Moments are still there, but their old Stubs are gone.

drop trigger if exists posts_zz_award_moment_stubs on public.posts;
drop trigger if exists pursuits_issue_finish_stubs on public.pursuits;
drop trigger if exists pursuits_drop_guard on public.pursuits;
drop trigger if exists stubs_notify on public.stubs;
drop trigger if exists stubs_fill_corner_key on public.stubs;
drop function if exists private.award_moment_stubs();
drop function if exists private.issue_finish_stubs();
drop function if exists private.pursuits_drop_guard();
drop function if exists private.stubs_notify();
drop function if exists private.stubs_fill_corner_key();
drop function if exists public.join_drop(bigint);
drop function if exists public.pin_stub(bigint, boolean);
drop function if exists public.regular_days_this_month(text);

delete from public.stubs where public.stubs.kind in ('drop', 'regular');
delete from public.notifications where public.notifications.kind = 'stub_earned';

alter table public.stubs drop constraint if exists stubs_kind_fields;
alter table public.stubs drop constraint if exists stubs_kind_check;
drop index if exists public.stubs_pursuit_award_key;
drop index if exists public.stubs_drop_edition_key;
drop index if exists public.stubs_regular_key;
drop index if exists public.stubs_user_idx;
drop index if exists public.stubs_post_idx;
update public.stubs set kind = 'gold', post_id = null where public.stubs.kind = 'finish';
alter table public.stubs
  drop column if exists drop_id,
  drop column if exists edition,
  drop column if exists corner_key,
  drop column if exists period,
  drop column if exists pinned_at;
alter table public.stubs
  add constraint stubs_kind_check check (kind in ('event', 'session', 'gold')),
  add constraint stubs_kind_fields check (
    (kind = 'event' and event_id is not null and space_id is not null)
    or (kind = 'session' and event_id is null and pursuit_id is not null and post_id is not null)
    or (kind = 'gold' and event_id is null and pursuit_id is not null)
  );
create unique index stubs_session_post_key on public.stubs (post_id) where kind = 'session';
create unique index stubs_gold_key on public.stubs (user_id, pursuit_id) where kind = 'gold';

drop index if exists public.pursuits_drop_once_idx;
drop index if exists public.pursuits_drop_idx;
alter table public.pursuits drop column if exists drop_id;
drop table if exists public.drops;

-- The session and gold triggers, as 20261101000000 defined them.
create function private.issue_session_stub()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.pursuit_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.pursuit_id is not distinct from new.pursuit_id then
    return new;
  end if;
  if public.is_pursuit_participant(new.pursuit_id, new.user_id) then
    insert into public.stubs (user_id, kind, post_id, pursuit_id)
      values (new.user_id, 'session', new.id, new.pursuit_id)
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.issue_session_stub() from public, anon, authenticated;
create trigger posts_issue_session_stub
  after insert or update of pursuit_id on public.posts
  for each row execute function private.issue_session_stub();

create function private.issue_gold_stubs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.finished_at is null and new.finished_at is not null then
    insert into public.stubs (user_id, kind, pursuit_id)
      select distinct s.user_id, 'gold', new.id
      from public.stubs s
      where s.pursuit_id = new.id and s.kind = 'session'
      on conflict do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.issue_gold_stubs() from public, anon, authenticated;
create trigger pursuits_issue_gold_stubs
  after update of finished_at on public.pursuits
  for each row execute function private.issue_gold_stubs();

-- Readers and counts, as 20261110000000 defined them.
drop function if exists public.get_profile_stubs(uuid);
create function public.get_profile_stubs(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.can_read_lists(auth.uid(), p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', s.id,
             'date', case when v_role = 'owner' then s.issued_at else null end,
             'day', to_char(coalesce(pp.occurred_at, po.created_at) at time zone 'UTC', 'YYYY-MM-DD'),
             'title', left(coalesce(nullif(po.caption, ''), nullif(po.sub_hobby, ''), nullif(po.interest, '')), 120),
             'category', coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''))
           ) order by s.issued_at desc)
      from public.stubs s
      join public.posts po on po.id = s.post_id
      left join public.post_private pp on pp.post_id = po.id
      left join public.pursuits pu on pu.id = s.pursuit_id
     where s.user_id = p_profile and s.kind = 'session'
       and (v_role = 'owner' or (coalesce(po.visible_at, po.created_at) <= now() and po.visibility = 'public'
            and (po.audience is null or po.audience = 'everyone' or (po.audience = 'friends' and v_role = 'friend'))))
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_stubs(uuid) from public;
grant execute on function public.get_profile_stubs(uuid) to anon, authenticated;

create or replace function public.get_profile(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_id uuid;
  v_role text;
  v_p record;
  v_stubs integer;
  v_pursuits integer;
  v_friends integer;
  v_lvl record;
  v_next_min integer;
  v_follow text;
  v_followed_by boolean;
  v_closed boolean;
  v_out jsonb;
  v_mutual jsonb;
  v_paused boolean;
begin
  v_id := (select p.id from public.profiles p
            where (p.id::text = p_username or lower(p.username) = lower(p_username))
              and p.paused_at is null and p.deletion_requested_at is null);
  if v_id is null then
    return null;
  end if;
  v_role := private.viewer_role(v_viewer, v_id);
  if v_role = 'blocked' then
    return null;
  end if;

  select p.username, p.display_name, p.avatar_url, p.neighborhood, p.bio, p.is_private, p.planning_paused
    into v_p from public.profiles p where p.id = v_id;
  v_closed := v_p.is_private and v_role in ('public');

  -- Others count only released Moments' Stubs; the owner sees everything at once.
  v_stubs := (select count(*) from public.stubs s
               join public.posts po on po.id = s.post_id
              where s.user_id = v_id and s.kind = 'session'
                and (v_role = 'owner' or coalesce(po.visible_at, po.created_at) <= now()));
  select l.idx, l.name into v_lvl from private.level_for(v_stubs) l;

  v_follow := coalesce((select f.status from public.profile_follows f
                         where f.follower_id = v_viewer and f.followed_id = v_id), 'none');

  v_out := jsonb_build_object(
    'role', v_role,
    'id', v_id,
    'username', v_p.username,
    'displayName', v_p.display_name,
    'avatarUrl', v_p.avatar_url,
    'followState', v_follow
  );

  if v_closed then
    return v_out || jsonb_build_object('private', true, 'levelName', v_lvl.name);
  end if;

  v_pursuits := (select count(*) from public.pursuits pu
                  where pu.user_id = v_id and pu.archived_at is null
                    and (v_role = 'owner' or pu.shared));
  v_friends := (select count(*) from public.profile_follows f
                 where f.followed_id = v_id and f.status = 'accepted'
                   and exists (select 1 from public.profile_follows g
                                where g.follower_id = v_id and g.followed_id = f.follower_id
                                  and g.status = 'accepted'));

  v_out := v_out || jsonb_build_object(
    'private', false,
    'neighborhood', v_p.neighborhood,
    'bio', v_p.bio,
    'stubCount', v_stubs,
    'pursuitCount', v_pursuits,
    'friendCount', v_friends,
    'level', jsonb_build_object('index', v_lvl.idx, 'name', v_lvl.name)
  );

  if v_role = 'owner' then
    v_next_min := (select l.min_stubs from (values (2, 1), (3, 3), (4, 7), (5, 10), (6, 20), (7, 35), (8, 50)) as l (idx, min_stubs)
                    where l.idx = v_lvl.idx + 1);
    v_out := v_out || jsonb_build_object(
      'stubsToNext', case when v_next_min is null then null else v_next_min - v_stubs end,
      'planningPaused', v_p.planning_paused,
      'isPrivate', v_p.is_private
    );
  end if;

  if v_role in ('friend', 'follower', 'public') then
    v_followed_by := exists (select 1 from public.profile_follows f
                              where f.follower_id = v_id and f.followed_id = v_viewer and f.status = 'accepted');
    v_out := v_out || jsonb_build_object('followsYou', v_followed_by);
  end if;

  if v_role = 'friend' then
    v_out := v_out || jsonb_build_object('planningPaused', v_p.planning_paused);
  end if;

  if v_role in ('friend', 'follower') then
    -- Mutual friends: people who are friends with both of you.
    v_mutual := coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', left(m.display_name, 60), 'avatarUrl', m.avatar_url) order by m.display_name)
        from public.profiles m
       where m.id <> v_viewer and m.id <> v_id
         and private.is_friend(m.id, v_viewer) and private.is_friend(m.id, v_id)
         and not private.is_blocked_between(m.id, v_viewer)
    ), '[]'::jsonb);
    if v_role = 'friend' then
      v_out := v_out || jsonb_build_object('mutualFriends', v_mutual, 'mutualFriendCount', jsonb_array_length(v_mutual));
    else
      v_out := v_out || jsonb_build_object('mutualFriendCount', jsonb_array_length(v_mutual));
    end if;
  end if;

  if v_role = 'friend' then
    -- Categories both of you have a Pursuit in, as plain names.
    v_out := v_out || jsonb_build_object('sharedCategories', coalesce((
      select jsonb_agg(distinct a.cat order by a.cat) from (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_id and pu.archived_at is null
      ) a
      join (
        select coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, '')) as cat
          from public.pursuits pu where pu.user_id = v_viewer and pu.archived_at is null
      ) b on lower(b.cat) = lower(a.cat)
      where a.cat is not null
    ), '[]'::jsonb));
  end if;

  return v_out;
end;
$$;
revoke all on function public.get_profile(text) from public;
grant execute on function public.get_profile(text) to anon, authenticated;

create or replace function public.get_profile_pursuits(p_profile uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_role text := private.can_read_lists(v_viewer, p_profile);
begin
  if v_role is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(x.j order by x.sort_at desc) from (
      select coalesce(pu.finished_at, pu.started_at) as sort_at,
             jsonb_build_object(
               'id', pu.id,
               'category', coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''), 'Something new'),
               'goal', left(pu.title, 60),
               'target', pu.target_moments,
               'momentCount', (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = p_profile
                                and (v_role = 'owner' or coalesce(po.visible_at, po.created_at) <= now())),
               'stubCount', (select count(*) from public.stubs s
                              join public.posts po on po.id = s.post_id
                             where s.pursuit_id = pu.id and s.kind = 'session'
                               and (v_role = 'owner' or coalesce(po.visible_at, po.created_at) <= now())),
               'finished', pu.finished_at is not null
                 and (v_role = 'owner' or pu.target_moments is null
                      or (select count(*) from public.posts po where po.pursuit_id = pu.id and po.user_id = p_profile
                            and coalesce(po.visible_at, po.created_at) <= now()) >= pu.target_moments),
               'archived', pu.archived_at is not null,
               'lastMomentDate', case when v_role = 'owner' then
                   (select max(coalesce(pp.occurred_at, po.created_at)) from public.posts po left join public.post_private pp on pp.post_id = po.id where po.pursuit_id = pu.id) else null end,
               'finishedAt', case when pu.finished_at is null then null
                                  when v_role = 'owner' then to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM-DD')
                                  else to_char(pu.finished_at at time zone 'UTC', 'YYYY-MM') end,
               'sharedWithYou', v_role = 'friend' and exists (
                   select 1 from public.pursuits mine
                    where mine.user_id = v_viewer and mine.archived_at is null
                      and lower(coalesce(nullif(mine.sub_hobby, ''), nullif(mine.interest, ''))) =
                          lower(coalesce(nullif(pu.sub_hobby, ''), nullif(pu.interest, ''))))
             ) as j
        from public.pursuits pu
       where pu.user_id = p_profile
         and (v_role = 'owner' or (pu.shared and pu.archived_at is null))
    ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.get_profile_pursuits(uuid) from public;
grant execute on function public.get_profile_pursuits(uuid) to anon, authenticated;

create or replace function public.enforce_notification_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.kind = 'save' then
    if coalesce(current_setting('soosh.save_notice', true), '') <> 'on' then
      raise exception 'Not a recognized notification kind: %', new.kind;
    end if;
    new.actor_id := null;
    new.actor_name := null;
  else
    new.actor_id := auth.uid();
  end if;

  if new.kind not in (
    'hobby_follow', 'joined', 'make_together', 'explore_together', 'thought',
    'message', 'accepted', 'message_request', 'space_invite',
    'pursuit_invite', 'pursuit_joined', 'pursuit_progress',
    'space_event_cancelled',
    'space_join_request', 'space_join_approved', 'space_join_declined', 'space_host_invite',
    'space_moment_pending', 'space_moment_approved',
    'first_moment', 'love', 'save', 'plan_invite'
  ) then
    raise exception 'Not a recognized notification kind: %', new.kind;
  end if;

  if new.actor_name is not null
     and new.actor_name not in ('Someone', 'You')
     and new.actor_name is distinct from public.pursuit_person_name(new.actor_id)
  then
    new.actor_name := public.pursuit_person_name(new.actor_id);
  end if;

  if new.href is not null
     and (new.href !~ '^/[a-zA-Z0-9/_?=&-]*$' or new.href like '//%')
  then
    raise exception 'A notification link must be an in-app path.';
  end if;

  if char_length(new.body) > 300 then
    raise exception 'A notification is too long.';
  end if;

  if new.actor_id is not null
     and new.actor_id <> new.user_id
     and private.is_blocked_between(new.actor_id, new.user_id) then
    return null;
  end if;

  if private.notification_kind_muted(new.user_id, new.kind) then
    return null;
  end if;

  new.target_post_id := null;
  new.target_pursuit_id := null;

  declare
    v_post_text text;
    v_post_id bigint;
    v_pursuit_id text;
  begin
    v_post_text := substring(new.href from '^/moment/(\d+)');
    if v_post_text is not null and char_length(v_post_text) <= 18 then
      v_post_id := v_post_text::bigint;
      if exists (select 1 from public.posts where public.posts.id = v_post_id) then
        new.target_post_id := v_post_id;
      end if;
    end if;

    v_pursuit_id := substring(new.href from '^/pursuit/([^/?]+)');
    if v_pursuit_id is not null
       and exists (select 1 from public.pursuits where public.pursuits.id = v_pursuit_id) then
      new.target_pursuit_id := v_pursuit_id;
    end if;
  end;

  return new;
end;
$function$;


drop function if exists private.stub_shown(text, text, text);
drop function if exists private.stub_event_full(uuid, uuid, text);
drop function if exists private.moment_counts(text, text, text[], timestamptz, timestamptz);
drop function if exists private.corner_key_of(text, text);
drop function if exists private.ny_day(timestamptz);
