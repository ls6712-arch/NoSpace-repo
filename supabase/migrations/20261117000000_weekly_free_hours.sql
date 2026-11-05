-- Exact local weekly hours in the existing owner-only free_windows setting.
-- Old day/eve values remain valid. No existing values or policies are rewritten.
create or replace function private.weekly_hours_valid(p_windows text[])
returns boolean language plpgsql immutable set search_path='' as $$
declare k text; m text[]; a integer; b integer; seen text[]:='{}'; prior text; pm text[];
begin
  if p_windows is null then return true; end if;
  if cardinality(p_windows)>56 or coalesce(array_ndims(p_windows),1)>1 then return false; end if;
  foreach k in array p_windows loop
    if k is null then return false; end if;
    if k ~ '^(mon|tue|wed|thu|fri|sat|sun)-(day|eve)$' then continue; end if;
    m:=regexp_match(k,'^(mon|tue|wed|thu|fri|sat|sun)@(0|[1-9][0-9]{0,3})-(0|[1-9][0-9]{0,3})$');
    if m is null then return false; end if;
    a:=m[2]::integer; b:=m[3]::integer;
    if a>=b or b>1440 then return false; end if;
    foreach prior in array seen loop
      pm:=regexp_match(prior,'^([a-z]+)@([0-9]+)-([0-9]+)$');
      if pm[1]=m[1] and a<pm[3]::integer and b>pm[2]::integer then return false; end if;
    end loop;
    seen:=array_append(seen,k);
  end loop;
  return true;
end $$;
revoke all on function private.weekly_hours_valid(text[]) from public,anon;
grant execute on function private.weekly_hours_valid(text[]) to authenticated,service_role;
alter table public.profile_private drop constraint profile_private_free_windows_valid;
alter table public.profile_private add constraint profile_private_free_windows_valid check(private.weekly_hours_valid(free_windows));

create or replace function private.matches_weekly_hours(p_windows text[],p_start timestamptz,p_zone text)
returns boolean language plpgsql stable set search_path='' as $$
declare wall timestamp; day0 text; minute0 integer; k text; m text[]; wa timestamp; wb timestamp; a0 timestamptz; b0 timestamptz;
begin
  if p_start is null or not isfinite(p_start) then return false; end if;
  wall:=p_start at time zone case when exists(select 1 from unnest(coalesce(p_windows,'{}')) as w(value) where strpos(w.value,'@')>0) then 'America/New_York' else p_zone end;
  day0:=(array['mon','tue','wed','thu','fri','sat','sun'])[extract(isodow from wall)::integer];
  minute0:=extract(hour from wall)::integer*60+extract(minute from wall)::integer;
  foreach k in array coalesce(p_windows,'{}') loop
    if k=day0||'-day' and minute0>=360 and minute0<1080 or k=day0||'-eve' and minute0>=1080 then return true; end if;
    m:=regexp_match(k,'^(mon|tue|wed|thu|fri|sat|sun)@(0|[1-9][0-9]{0,3})-(0|[1-9][0-9]{0,3})$');
    if m is not null and m[1]=day0 and minute0>=m[2]::integer and minute0<m[3]::integer then
      wa:=wall::date+make_interval(mins=>m[2]::integer); wb:=wall::date+make_interval(mins=>m[3]::integer);
      a0:=wa at time zone 'America/New_York'; b0:=wb at time zone 'America/New_York';
      if (a0-interval '1 hour') at time zone 'America/New_York'=wa then a0:=a0-interval '1 hour'; end if;
      if (b0-interval '1 hour') at time zone 'America/New_York'=wb then b0:=b0-interval '1 hour'; end if;
      if a0 at time zone 'America/New_York'=wa and b0 at time zone 'America/New_York'=wb and p_start>=a0 and p_start<b0 then return true; end if;
    end if;
  end loop;
  return false;
end $$;
revoke all on function private.matches_weekly_hours(text[],timestamptz,text) from public,anon;
grant execute on function private.matches_weekly_hours(text[],timestamptz,text) to authenticated,service_role;

-- Preserve the live ranking function and all other scores. Refuse unexpected
-- definitions rather than replacing unrelated, newer recommendation changes.
do $$
declare def text; changed text;
begin
  def:=pg_get_functiondef('public.home_suggestions(integer)'::regprocedure);
  if strpos(def,'v_tz')=0 or strpos(def,'when sg.wkey = any (v_windows) then')=0 or strpos(def,'fs.wkey = any (v_windows)')=0 then
    raise exception 'Home ranking changed. Review weekly-hours integration before applying.';
  end if;
  changed:=replace(def,'when sg.wkey = any (v_windows) then','when private.matches_weekly_hours(v_windows,sg.starts_at,v_tz) then');
  changed:=replace(changed,'fs.wkey = any (v_windows)','private.matches_weekly_hours(v_windows,fs.starts_at,v_tz)');
  execute changed;
end $$;
notify pgrst, 'reload schema';
