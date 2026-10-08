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

Production runs the code on `main`. The PR adds four migrations: `20261017` (QA notifications), `20261018` (drop reflections), `20261019` (merge Corners) and `20261020` (terms column).

| Thing | Old client does | If the migration ran before the new code | Breaks? |
|---|---|---|---|
| `posts.reflection` | Never selects it (explicit column list, `ContentContext.tsx:124`). | Nothing reads it. | **No** |
| `post_reflections`, load | Reads your own reflections on every posts load and ignores the error. | The query fails quietly, once per load. | **No** (a console warning) |
| `post_reflections`, create | Writes the reflection after saving a Moment and does not check the result. | A reflection typed into a new Moment is silently lost. | **Degraded** |
| `post_reflections`, edit | **Add details** and the Moment edit form always send `reflection`, even empty. The code saves the Moment, then deletes or upserts the reflection row and returns false if that errors. | The caption or Corner change is saved, but the screen reports it failed. | **Yes: every edit of a Moment from the old client** |
| Corner "Food photography" | Still in the built-in Corner list (`hobbies.ts`). | The row is deleted and its Moments move to Photography. Someone picking it again re-creates the row through the posts trigger. Follows and Space links already moved. | **No** (merge is partly undone until the new code ships) |
| Moments with no Corner in Food & Cooking and Photography & Film | Show the group name as the Corner label. | They now show Cooking and Photography. | **No** |
| `20261017`, `20261020` | Do not touch anything the old client reads. | Nothing. | **No** |

So `20261018` is the only migration that breaks the live client.

**The new code is safe on either side of every migration:** it never reads `post_reflections` or `posts.reflection`, and it treats a missing `terms_accepted_at` column as "nothing to do".

### A trap: the production build gate

`launchPlaceholderCheck` fails a production build while the Terms and Privacy Policy still contain `[PLACEHOLDER …]` or `example.com`. If main is merged as it stands, Vercel's production build **fails and the old client stays live**, while the migrations apply. That is exactly the breaking case above, and it would last until the placeholders are replaced.

## Proposed merge and deploy order (nothing changed yet)

1. **Check the toggle.** Supabase dashboard, Project Settings, Integrations, GitHub: note whether Deploy to production is on.
2. **Split `20261018_drop_reflections.sql` out of PR #163** into its own small PR. It has not run, so moving it is allowed. This is the only step that needs a code change, and it is waiting on a yes from you. It is the one migration that breaks the live client, and the new code does not need it.
3. **Replace the placeholders** in Terms and Privacy Policy (founder and lawyer text), so the production build can pass. Without this, no step after merge reaches production.
4. **Merge PR #163** (migrations `17`, `19`, `20` apply if the toggle is on). All three are safe with the old client, whether or not the deploy succeeds.
5. **Wait for the Vercel production deployment to be Ready.** Smoke test on the live site: log in, log a Moment, open it and edit it, sign up in a private window (checkbox).
6. **Merge the follow-up PR with `20261018`.** After that the table and column are gone, and no client reads them.
7. After each migration applies, run its file from `supabase/verification/` read-only and check no fixture rows are left behind.

If the toggle is **off**, no migration applies on merge. Apply them afterwards in the same order (17, 19, 20, then 18 after step 5) by whatever method you use for hand-run migrations.

If you would rather keep one PR: turn Deploy to production **off** before merging, confirm the production deploy is Ready, then turn it back on and let the next push to `main` apply the migrations. That works but ties the migration timing to an unrelated push.
