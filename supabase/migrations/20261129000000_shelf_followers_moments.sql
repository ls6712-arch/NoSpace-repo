-- Soosh: a Moment shared with Followers shows on its owner's Shelf, to the owner and to accepted followers.
--
-- Rollback: rollback_20261129000000_shelf_followers_moments.sql.
-- Verification: supabase/verification/shelf_followers_moments_check.sql.
--
-- get_profile_moments() (20261030210601_profile_roles_and_planning.sql) lists only rows with
-- posts.visibility = 'public', for the owner too. Since Log's audience choice "Followers" saves
-- visibility = 'followers' with audience = 'friends' (src/app/pages/Log.tsx), those Moments never
-- reached the Shelf: not for the owner, and not for the followers who can already read them in
-- their feed (policy "posts are readable by their audience"). Found in the launch audit, Nov 11, 2026;
-- 2 live Moments were affected.
--
-- Now the Shelf follows the same rule as that policy:
--   * the owner sees their 'public' and 'followers' Moments;
--   * an accepted follower (a friend is one too) sees 'followers' Moments once they are visible;
--   * everyone else sees what they saw before. 'public' rows are filtered exactly as before,
--     including the older audience = 'friends' rows that only friends see.
-- 'just_me' Moments (Only you, and a Pursuit group's) stay off the Shelf, as before.
-- Same signature, result shape, limits and grants; only the three row filters changed.

create or replace function public.get_profile_moments(
  p_profile uuid,
  p_limit integer default 60,
  p_offset integer default 0,
  p_pursuit text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.can_read_lists(auth.uid(), p_profile);
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_total integer;
  v_items jsonb;
begin
  if v_role is null then
    return jsonb_build_object('total', 0, 'items', '[]'::jsonb);
  end if;
  v_total := (select count(*) from public.posts po
               where po.user_id = p_profile and po.visibility in ('public', 'followers')
                 and (p_pursuit is null or po.pursuit_id = p_pursuit)
                 and (v_role = 'owner' or (coalesce(po.visible_at, po.created_at) <= now()
                       and ((po.visibility = 'public'
                             and (po.audience is null or po.audience = 'everyone'
                                  or (po.audience = 'friends' and v_role = 'friend')))
                            or (po.visibility = 'followers' and v_role in ('friend', 'follower'))))));
  if v_role = 'owner' then
    v_items := coalesce((
      select jsonb_agg(x.j order by x.occ desc) from (
        select coalesce(pp.occurred_at, po.created_at) as occ,
               jsonb_build_object(
                 'id', po.id, 'photoUrl', po.media_url, 'caption', left(po.caption, 200),
                 'category', coalesce(nullif(po.sub_hobby, ''), nullif(po.interest, '')),
                 'occurredAt', coalesce(pp.occurred_at, po.created_at),
                 'placeName', pp.place_name, 'neighborhood', po.neighborhood,
                 'visibleAt', case when po.visible_at > now() then po.visible_at else null end
               ) as j
          from public.posts po
          left join public.post_private pp on pp.post_id = po.id
         where po.user_id = p_profile and po.visibility in ('public', 'followers')
           and (p_pursuit is null or po.pursuit_id = p_pursuit)
         order by coalesce(pp.occurred_at, po.created_at) desc
         limit v_limit offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb);
  else
    v_items := coalesce((
      select jsonb_agg(x.j order by x.occ desc) from (
        select coalesce(pp.occurred_at, po.created_at) as occ,
               jsonb_build_object(
                 'id', po.id, 'photoUrl', po.media_url, 'caption', left(po.caption, 200),
                 'category', coalesce(nullif(po.sub_hobby, ''), nullif(po.interest, '')),
                 'date', to_char(coalesce(pp.occurred_at, po.created_at) at time zone 'UTC', 'YYYY-MM-DD'),
                 'neighborhood', po.neighborhood
               ) as j
          from public.posts po
          left join public.post_private pp on pp.post_id = po.id
         where po.user_id = p_profile and po.visibility in ('public', 'followers')
           and (p_pursuit is null or po.pursuit_id = p_pursuit)
           and coalesce(po.visible_at, po.created_at) <= now()
           and ((po.visibility = 'public'
                 and (po.audience is null or po.audience = 'everyone' or (po.audience = 'friends' and v_role = 'friend')))
                or (po.visibility = 'followers' and v_role in ('friend', 'follower')))
         order by coalesce(pp.occurred_at, po.created_at) desc
         limit v_limit offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb);
  end if;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;
