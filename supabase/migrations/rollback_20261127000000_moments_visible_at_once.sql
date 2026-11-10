-- Rollback for 20261127000000_moments_visible_at_once.sql: every new Moment is held for 2 hours again
-- unless the client sends an earlier visible_at (the function as 20261030210601 left it).
alter table public.posts alter column visible_at set default now() + interval '2 hours';

create or replace function private.posts_set_visible_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created timestamptz := coalesce(new.created_at, now());
begin
  if tg_op = 'INSERT' then
    new.visible_at := least(greatest(coalesce(new.visible_at, v_created + interval '2 hours'), v_created), v_created + interval '2 hours');
  elsif new.visible_at is distinct from old.visible_at then
    if new.visible_at is null then
      if old.visible_at is not null and coalesce(current_setting('soosh.legacy_rows', true), '') <> 'on' then
        raise exception 'A Moment always has a time it becomes visible.';
      end if;
    else
      new.visible_at := least(greatest(new.visible_at, v_created), v_created + interval '2 hours');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.posts_set_visible_at() from public, anon, authenticated;
