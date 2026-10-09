-- profile_links.url must be an http(s) link.
--
-- Anyone signed in can write their own profile_links rows straight through the
-- public API, and every other member's profile renders those URLs into an
-- href. Without this, a `javascript:` URL stored here runs in the visitor's
-- session when they click it. The app now also refuses to render a non-http(s)
-- URL (src/app/lib/profileLinks.ts safeHttpUrl); this is the matching
-- database-side guard.
--
-- NOT VALID: new and updated rows are checked, but existing rows are not
-- scanned, so a bad legacy row can't make this migration fail. The render
-- guard already hides any such row. After running, find leftovers with:
--   select profile_links.id, profile_links.user_id from public.profile_links
--   where profile_links.url !~* '^https?://';
alter table public.profile_links
  add constraint profile_links_url_http_check
  check (profile_links.url ~* '^https?://') not valid;
