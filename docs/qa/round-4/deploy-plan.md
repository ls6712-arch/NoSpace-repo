# Migrations and deploy: what runs, and the order to merge

Checked on 2026-10-08. Read-only: no migration was run and nothing was changed on the live project.

## M1. What runs on merge to main

| Piece | What it does | Evidence |
|---|---|---|
| `.github/workflows/ci.yml` | Lint, type-check, tests, build, visual checks. **Runs no migrations** and deploys nothing. | It is the only workflow. `grep` for supabase, migrate, db push finds nothing. |
| `supabase/config.toml` | Does not exist. No CLI-driven migration setup in the repo. | `ls supabase` |
| Vercel | Builds with `npm run build` (`vite build`) on every push and posts the preview comment. No `vercel.json`, no migration step. A merge to the production branch builds the production site. | No `vercel.json` or `.vercel`; "Vercel Preview Comments" check on the PR. |
| Supabase GitHub integration | **Installed.** A "Supabase Preview" check runs on every push (it shows "skipped" here: no preview branch is created). The project's only branch is `main`, linked to git branch `main`. When the integration's **Deploy to production** option is on, Supabase applies new files from `supabase/migrations/` to the production database when `main` changes. | `list_branches`; the check run; Supabase docs, "GitHub integration". |

Against which database: project `eyzokuhhbyidvmuqfmwm`, the same one `src` points at and the only one that exists.

**What I could not read from here:** whether Deploy to production is switched on. The settings page is only in the Supabase dashboard (Project Settings, Integrations, GitHub). Everything else points to it being on:

- The live migration history ends at `20261016000000`, exactly the newest file on `main`.
- Recent live versions carry the repo filename's timestamp exactly, and most have no `created_by`. The ones applied by hand (for example `space_moment_sharing`, `post_reflections`) carry a person's email.

**Treat migrations as auto-applying on merge until the toggle is confirmed off.** The migration files themselves say the same ("goes live when this PR is merged").

## M2. Would today's production code break if the migrations ran first?

Production runs the code on `main`. Four migrations were written: `20261017` (QA notifications), the reflection drop, `20261019` (merge Corners) and `20261020` (terms column and `accept_terms()`). **Update, round 5:** the reflection drop is no longer in PR #163. It is its own follow-up PR as `20261021000000_drop_reflections.sql` (renamed from `20261018` so its version is newer than every migration that will already be applied; an older version would be an out-of-order migration the Supabase tooling refuses or skips). The table below still explains why it must wait.

| Thing | Old client does | If the migration ran before the new code | Breaks? |
|---|---|---|---|
| `posts.reflection` | Never selects it (explicit column list, `ContentContext.tsx:124`). | Nothing reads it. | **No** |
| `post_reflections`, load | Reads your own reflections on every posts load and ignores the error. | The query fails quietly, once per load. | **No** (a console warning) |
| `post_reflections`, create | Writes the reflection after saving a Moment and does not check the result. | A reflection typed into a new Moment is silently lost. | **Degraded** |
| `post_reflections`, edit | **Add details** and the Moment edit form always send `reflection`, even empty. The code saves the Moment, then deletes or upserts the reflection row and returns false if that errors. | The caption or Corner change is saved, but the screen reports it failed. | **Yes: every edit of a Moment from the old client** |
| Corner "Food photography" | Still in the built-in Corner list (`hobbies.ts`). | The row is deleted and its Moments move to Photography. Someone picking it again re-creates the row through the posts trigger. Follows and Space links already moved. | **No** (merge is partly undone until the new code ships) |
| Moments with no Corner in Food & Cooking and Photography & Film | Show the group name as the Corner label. | They now show Cooking and Photography. | **No** |
| `20261017`, `20261020` | Do not touch anything the old client reads. `20261020` adds a nullable column and a function the old client never calls. | Nothing. | **No** |

So the reflection drop is the only migration that breaks the live client, which is why it is split out.

**The new code is safe on either side of every migration:** it never reads `post_reflections` or `posts.reflection`, and it treats a missing `terms_accepted_at` column as "nothing to do".

### A trap: the production build gate

`launchPlaceholderCheck` fails a production build while the Terms and Privacy Policy still contain `[PLACEHOLDER …]` or `example.com`. If main is merged as it stands, Vercel's production build **fails and the old client stays live**, while the migrations apply. That is exactly the breaking case above, and it would last until the placeholders are replaced.

## Merge and deploy order

PR #163 now carries only the migrations that are safe with the live client: `20261017`, `20261019` and `20261020`. The reflection drop is a separate draft PR, branched from #163's branch and based on it (it shows only its own two files). It stays a draft until #163 is live.

1. **Check the toggle.** Supabase dashboard, Project Settings, Integrations, GitHub: note whether **Deploy to production** is on.
2. **Legal text.** Replace the Terms and Privacy Policy placeholders (founder and lawyer text), so the production build can pass. Without this, no step after the merge reaches production.
3. **Merge PR #163.** If the toggle is on, `20261017`, `20261019` and `20261020` apply. All three are safe with the old client, whether or not the deploy succeeds.
4. **Production smoke test.** Wait for the Vercel production deployment to be Ready. On the live site: log in (an existing account is asked to accept the Terms once), log a Moment, open it and edit it, sign up in a private window (the checkbox).
5. **Merge the reflection PR** (the draft: mark it ready, and if its base is still #163's branch, change the base to `main` first). It applies `20261021000000_drop_reflections.sql`. After that the table and column are gone and no client reads them.
6. **Run the verification scripts**, read-only, and confirm no fixture rows were left behind: `profiles_terms_accepted_at_check.sql` (after step 3) and `drop_reflections_check.sql` (after step 5).

If the toggle is **off**, nothing applies on merge. Apply the migrations afterwards in the same order (`20261017`, `20261019`, `20261020`, then `20261021` after step 4) by whatever method you use for hand-run migrations.

Why the reflection drop waits: if it ran before the new code is live, "Add details" and the Moment edit form in the old client report a failed save even though the edit saved. The new code never reads `post_reflections` or `posts.reflection`, so #163 does not need the drop.

## Terms acceptance: how the time is recorded (round 5)

The client never sends a time. `public.accept_terms()` takes no arguments and stamps `now()` on the caller's own profile, once. `authenticated` has no UPDATE grant on `terms_accepted_at`, so a direct write of the column is refused (`insufficient_privilege`), and a second call changes nothing. Nothing backfills any existing row: accounts with no recorded acceptance are asked once on their next visit (new accounts in onboarding), and the database records the time when they accept. `profiles_terms_accepted_at_check.sql` covers each of these, including that a client-supplied time is refused and that the stored time equals the transaction's `now()`.

Known limit: `profiles` is readable like the rest of the profile, so the acceptance time is visible wherever the profile row is. It is a low-risk timestamp, not a secret, but say if it should be hidden behind its own table.
