-- Rollback for 20261001120000_app_config_public_read.sql.
--
-- Draft only — staged for review, not run.
--
-- Restores the original signed-in-only SELECT policy. Reintroduces the
-- 406-on-signed-out-read bug the forward migration fixed — only run this
-- if the public-read policy itself turns out to be wrong, not as routine
-- cleanup.

drop policy if exists "app_config is publicly readable" on public.app_config;
create policy "app_config is readable when signed in"
  on public.app_config for select using (auth.uid() is not null);
