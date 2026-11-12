-- Rollback for 20261129000000_shelf_followers_moments.sql: get_profile_moments() as it was before
-- (the live definition read on Nov 11, 2026). Moments shared with Followers leave the Shelf again.
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
               where po.user_id = p_profile and po.visibility = 'public'
                 and (p_pursuit is null or po.pursuit_id = p_pursuit)
                 and (v_role = 'owner' or (coalesce(po.visible_at, po.created_at) <= now()
                       and (po.audience is null or po.audience = 'everyone'
                            or (po.audience = 'friends' and v_role = 'friend')))));
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
         where po.user_id = p_profile and po.visibility = 'public'
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
         where po.user_id = p_profile and po.visibility = 'public'
           and (p_pursuit is null or po.pursuit_id = p_pursuit)
           and coalesce(po.visible_at, po.created_at) <= now()
           and (po.audience is null or po.audience = 'everyone' or (po.audience = 'friends' and v_role = 'friend'))
         order by coalesce(pp.occurred_at, po.created_at) desc
         limit v_limit offset greatest(coalesce(p_offset, 0), 0)
      ) x
    ), '[]'::jsonb);
  end if;
  return jsonb_build_object('total', v_total, 'items', v_items);
end;
$$;
