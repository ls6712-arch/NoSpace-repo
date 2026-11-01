-- Rollback for 20261117000000_moment_inspired_by.sql.
-- Drops posts.inspired_by (the links are lost), the guard, the notice function and the
-- 'inspired' notifications, and puts back the previous apply_release_effects() and
-- enforce_notification_insert() (the 20261115000000 versions, with 'stub_earned').

delete from public.notifications where notifications.kind = 'inspired';

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
    'first_moment', 'love', 'save', 'plan_invite', 'stub_earned'
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

create or replace function private.apply_release_effects(p_post_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post record;
  v_inviter uuid;
  v_name text;
begin
  -- Claim the Moment: only one caller ever gets past this, so nothing fires twice.
  update public.posts po set notified_at = now()
   where po.id = p_post_id and po.notified_at is null
     and coalesce(po.visible_at, po.created_at) <= now();
  if not found then
    return;
  end if;
  select po.id, po.user_id, po.visibility, po.hobby_slug, po.corner, po.sub_hobby
    into v_post from public.posts po where po.id = p_post_id;
  if coalesce(v_post.corner, v_post.sub_hobby) is not null and v_post.visibility = 'public' then
    insert into public.corners (space_slug, slug, name, moment_count)
    values (v_post.hobby_slug, coalesce(v_post.corner, v_post.sub_hobby), coalesce(v_post.corner, v_post.sub_hobby), 1)
    on conflict (space_slug, slug)
      do update set moment_count = public.corners.moment_count + 1;
  end if;
  perform private.notify_space_moment_pending(sm.space_id, sm.post_id)
     from public.space_moments sm
    where sm.post_id = p_post_id and sm.status = 'pending' and sm.removed_by_host = false;
  if v_post.visibility not in ('public', 'followers') then
    return;
  end if;
  v_inviter := (select pr.invited_by from public.profiles pr where pr.id = v_post.user_id);
  if v_inviter is null or v_inviter = v_post.user_id then
    return;
  end if;
  if exists (select 1 from public.posts po
              where po.user_id = v_post.user_id and po.id <> v_post.id
                and po.visibility in ('public', 'followers')) then
    return;
  end if;
  if private.is_blocked_between(v_inviter, v_post.user_id) then
    return;
  end if;
  if exists (select 1 from public.notifications n
              where n.user_id = v_inviter and n.kind = 'first_moment'
                and n.href in (select '/moment/' || po.id from public.posts po where po.user_id = v_post.user_id)) then
    return;
  end if;
  v_name := coalesce(public.pursuit_person_name(v_post.user_id), 'Someone');
  begin
    insert into public.notifications (user_id, kind, body, href, actor_name)
    values (v_inviter, 'first_moment', left(v_name, 60) || ' added their first moment.', '/moment/' || v_post.id, v_name);
  exception when others then
    raise warning 'first-moment notice skipped: % %', sqlstate, sqlerrm;
  end;
end;
$$;
revoke all on function private.apply_release_effects(bigint) from public, anon, authenticated;

drop trigger posts_check_inspired_by on public.posts;
drop function private.posts_check_inspired_by();
drop function private.notify_inspired(bigint);
drop index public.posts_inspired_by_idx;
alter table public.posts drop column inspired_by;
