-- Sushii: Spaces Rework — update_space's pending-requests error names
-- the count.
--
--   Supabase → SQL Editor → New query → paste → Run
--   Run AFTER 20261002000000_spaces_rework_teaser_featured.sql.
--
-- Found in review: switching a Space from Closed to Open while requests
-- are still pending was refused with a flat "Approve or decline pending
-- requests first." — a host had no idea how many were actually waiting
-- without leaving the form to go check the Manage tab themselves. Now
-- names the count, same %-and-pluralize pattern create_space's own
-- creation-limit message already uses ("You've reached your limit of %
-- Space%."). The client (SpaceForm.tsx) turns this into a link straight
-- to Manage — see that file for the matching change.
--
-- Full body reproduced from 20260928000000 (already live); only the
-- pending-requests check itself is new — counts first, only raises (and
-- only queries at all) when the Space is actually switching closed->open.
--
-- Safe to re-run: create-or-replace.
create or replace function public.update_space(
  p_space_id uuid,
  p_name text,
  p_description text,
  p_cover_image text,
  p_meets text,
  p_access text,
  p_posting_mode text,
  p_events_created_by text,
  p_neighborhood text default null,
  p_city text default null,
  p_member_cap int default null,
  p_rules text default null,
  p_exact_address text default null,
  p_clear_address boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_access text;
  v_pending_count int;
begin
  if not public.is_space_host(p_space_id, auth.uid()) then
    raise exception 'Only a host can do that.';
  end if;
  if public.is_blocklisted_name(p_name) then
    raise exception 'That name isn''t available.';
  end if;
  if p_meets in ('in_person', 'both') and (coalesce(trim(p_neighborhood), '') = '' or coalesce(trim(p_city), '') = '') then
    raise exception 'An in-person Space needs a neighborhood and city.';
  end if;
  perform public.assert_space_active(p_space_id);

  select spaces.access into v_current_access from spaces where spaces.id = p_space_id;
  if v_current_access = 'closed' and p_access = 'open' then
    select count(*) into v_pending_count from space_join_requests where space_join_requests.space_id = p_space_id;
    if v_pending_count > 0 then
      raise exception 'Approve or decline % pending request% first.', v_pending_count, case when v_pending_count = 1 then '' else 's' end;
    end if;
  end if;

  update spaces
  set name = p_name, description = p_description, cover_image = p_cover_image, meets = p_meets,
      neighborhood = p_neighborhood, city = p_city, access = p_access, member_cap = p_member_cap,
      posting_mode = p_posting_mode, events_created_by = p_events_created_by, rules = p_rules
  where spaces.id = p_space_id;

  if p_clear_address then
    delete from space_private_details where space_private_details.space_id = p_space_id;
  elsif p_exact_address is not null then
    insert into space_private_details (space_id, exact_address) values (p_space_id, p_exact_address)
    on conflict (space_id) do update set exact_address = excluded.exact_address;
  end if;
end;
$$;
revoke all on function public.update_space(uuid, text, text, text, text, text, text, text, text, text, int, text, text, boolean) from public, anon;
grant execute on function public.update_space(uuid, text, text, text, text, text, text, text, text, text, int, text, text, boolean) to authenticated;
