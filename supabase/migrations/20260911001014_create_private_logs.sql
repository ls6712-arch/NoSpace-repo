-- BACKFILL: verbatim from supabase_migrations.schema_migrations.statements
-- (this is the project's earliest tracked migration, applied before this
-- repo's supabase/migrations/ directory existed, hence no committed file
-- until now). Not re-run, not modified — copied exactly as recorded.

CREATE TABLE public.private_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  media_url text,
  media_type text CHECK (media_type = ANY (ARRAY['image', 'video'])),
  hobby_slug text,
  project_id text REFERENCES public.pursuits(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.private_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX private_logs_user_idx ON public.private_logs (user_id, created_at DESC);

CREATE POLICY "you see only your own private logs" ON public.private_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "you create your own private logs" ON public.private_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "you edit your own private logs" ON public.private_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "you delete your own private logs" ON public.private_logs
  FOR DELETE
  USING (auth.uid() = user_id);
