-- Soosh: what anyone may know about a drop (the Drop loop, Nov 16, 2026).
--
-- Home, the drop's own page and the page an invite link opens all show a drop with
-- two counts: how many people are in, and how many Stubs it has given out. Stubs are
-- readable only by their owner, and a signed-out visitor reads no Pursuits, so the
-- counts come from this function and nothing else does. It returns counts only, never
-- who. A drop that has not opened yet is not returned to anyone.
--
--   drop_summary()        every drop that is open right now, soonest to close first
--   drop_summary('slug')  that drop, open or closed, once it has opened
--
-- Rollback: rollback_20261203000000_drop_summary.sql
-- Verification: supabase/verification/drop_summary_check.sql

create function public.drop_summary(p_slug text default null)
returns table (
  id bigint,
  slug text,
  title text,
  blurb text,
  corner_key text,
  target_moments integer,
  opens_at timestamptz,
  closes_at timestamptz,
  max_editions integer,
  palette jsonb,
  people_in integer,
  finished integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.slug, d.title, d.blurb, d.corner_key, d.target_moments, d.opens_at, d.closes_at,
         d.max_editions, d.palette,
         (select count(*)::integer from public.pursuits pu where pu.drop_id = d.id) as people_in,
         (select count(*)::integer from public.stubs s where s.drop_id = d.id and s.kind = 'drop') as finished
    from public.drops d
   where d.opens_at <= now()
     and case when p_slug is null then d.closes_at > now() else d.slug = p_slug end
   order by d.closes_at, d.id
$$;

revoke all on function public.drop_summary(text) from public;
grant execute on function public.drop_summary(text) to anon, authenticated;

-- Deny by default (supabase/security/access-allowlist.json): what a signed-out visitor
-- and a not-yet-member may call is listed here and nowhere else.
insert into private.access_allowlist (kind, name, reason) values
  ('rpc_anon', 'drop_summary', 'Counts only for a drop that has opened: how many joined and how many Stubs it gave out. Never who'),
  ('rpc_guest', 'drop_summary', 'Counts only for a drop that has opened: how many joined and how many Stubs it gave out. Never who')
on conflict (kind, name) do nothing;

notify pgrst, 'reload schema';
