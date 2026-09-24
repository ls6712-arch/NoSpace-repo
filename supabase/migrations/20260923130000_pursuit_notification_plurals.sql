-- Sushii: "logged 1 painting", not "logged 1 paintings".
--
--   Supabase → SQL Editor → New query → paste → Run
--
-- Safe to re-run. Replaces one function body; nothing else changes.
-- Singular form matches the app's own unitFor(): "paintings" → "painting",
-- "stories" → "story", "glass" stays "glass"; anything but exactly 1 keeps
-- the unit as typed.

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
  unit := trim(coalesce(p.measure ->> 'unit', ''));
  if new.amount = 1 and unit like '%s' and unit not like '%ss' then
    unit := case when unit like '%ies' then left(unit, length(unit) - 3) || 'y' else left(unit, length(unit) - 1) end;
  end if;
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
