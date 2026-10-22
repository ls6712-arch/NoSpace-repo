-- Read-only check for 20261026000000_media_buckets_web_safe_types.sql.
-- Ends in raise exception, so the transaction always rolls back.
-- After the merge, expect: PASS post-media, PASS moment-media, PASS message-media unchanged.
begin;
do $$
declare
  results text[] := '{}';
  v_safe text[] := array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
  v_types text[];
  v_bucket text;
begin
  foreach v_bucket in array array['post-media', 'moment-media'] loop
    v_types := (select b.allowed_mime_types from storage.buckets b where b.id = v_bucket);
    results := results || case
      when v_types is null then 'FAIL ' || v_bucket || ': missing or allows everything'
      when v_types <@ v_safe and v_safe <@ v_types then 'PASS ' || v_bucket
      else v_bucket || ' still allows: ' || array_to_string(array(select unnest(v_types) except select unnest(v_safe)), ' ')
    end;
  end loop;

  -- message-media is photos only and is not touched by this migration.
  v_types := (select b.allowed_mime_types from storage.buckets b where b.id = 'message-media');
  results := results || case
    when v_types <@ array['image/jpeg', 'image/png', 'image/webp', 'image/gif'] then 'PASS message-media unchanged'
    else 'FAIL message-media: ' || coalesce(array_to_string(v_types, ' '), 'allows everything')
  end;

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end
$$;
rollback;
