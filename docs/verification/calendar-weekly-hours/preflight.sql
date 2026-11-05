SELECT jsonb_build_object(
  'free_windows_constraint',
  (SELECT pg_get_constraintdef(c.oid) FROM pg_constraint AS c
   WHERE c.conrelid = 'public.profile_private'::regclass
     AND c.conname = 'profile_private_free_windows_valid'),
  'home_ranking_can_update',
  (SELECT strpos(f.definition, 'when sg.wkey = any (v_windows) then') > 0
      AND strpos(f.definition, 'fs.wkey = any (v_windows)') > 0
   FROM (SELECT pg_get_functiondef(to_regprocedure('public.home_suggestions(integer)')) AS definition) AS f)
) AS weekly_hours_setup;
