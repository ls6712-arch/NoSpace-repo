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

Production runs the code on `main`. Migrations written across the rounds: `20261017` (QA notifications), `20261019` (merge Corners), `20261020` (the Terms acceptance table and `accept_terms(text)`) and `20261021` (hide follow requests) are in PR #163. **Update, rounds 5 and 6:** two migrations are separate draft PRs because the live client breaks if they run first: the reflection drop (`20261022000000_drop_reflections.sql`, [#164](https://github.com/ls6712-arch/NoSpace-repo/pull/164)) and the profile column privacy migration (`20261023000000_profiles_column_privacy.sql`, [#165](https://github.com/ls6712-arch/NoSpace-repo/pull/165)). Their versions are newer than everything in #163 on purpose: a version older than one already applied is an out-of-order migration that the Supabase tooling refuses or skips. **Merge #164 before #165** for the same reason (22 before 23).

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

PR #163 carries only migrations that are safe with the live client: `20261017`, `20261019`, `20261020` and `20261021`. The other two are draft PRs, branched from #163's branch and based on it (each shows only its own files), and stay drafts until #163 is live.

1. **Check the toggle.** Supabase dashboard, Project Settings, Integrations, GitHub: note whether **Deploy to production** is on.
2. **Legal text.** Replace the Terms and Privacy Policy placeholders (founder and lawyer text), so the production build can pass. Without this, no step after the merge reaches production. When the real text replaces the draft, also change `TERMS_VERSION` in `src/app/config.ts` to that day, so everyone who accepted the draft is asked again.
3. **Merge PR #163.** If the toggle is on, `20261017`, `20261019`, `20261020` and `20261021` apply. All four are safe with the old client, whether or not the deploy succeeds.
4. **Production smoke test.** Wait for the Vercel production deployment to be Ready. On the live site: log in (an existing account is asked to accept the Terms once), log a Moment, open and edit it, check an admin account still sees the admin pages, sign up in a private window (the checkbox).
5. **Merge #164** (reflections): change its base to `main`, mark it ready, merge.
6. **Merge #165** (profile column privacy), after #164. Change its base to `main`, mark it ready, merge. Then log in as an ordinary account and as an admin to confirm the profile still loads.
7. **Run the verification scripts**, read-only, and confirm no fixture rows were left behind: `terms_acceptances_check.sql` and `hide_follow_requests_check.sql` (after step 3), `drop_reflections_check.sql` (after step 5), `profiles_column_privacy_check.sql` (after step 6).

If the toggle is **off**, nothing applies on merge. Apply the migrations afterwards in version order (`20261017`, `19`, `20`, `21`, then `22` after step 4, then `23` after step 5) by whatever method you use for hand-run migrations.

Why the two follow-ups wait:

- **Reflection drop.** If it ran before the new code is live, "Add details" and the Moment edit form in the old client report a failed save even though the edit saved. The new code never reads `post_reflections` or `posts.reflection`.
- **Profile column privacy.** The old client selects `access`, `invited_by`, `invite_allowance`, `onboarding_completed(_at)` and `theme_preference` straight from `profiles`. Once those columns are hidden that read fails and **no profile loads for anyone**. The new code reads them through `my_profile_private()` when it exists and falls back to the old read when it does not.

## Terms acceptance: how it is recorded (rounds 5 and 6)

- **Own table.** `public.terms_acceptances (user_id, terms_version, accepted_at)`, primary key `(user_id, terms_version)`: one row per person per version. It is not on `profiles`, so it is not part of what other people can read.
- **Server time, version only.** The client calls `public.accept_terms(p_version text)`. That is its only argument. The database stamps `now()`; there is no time argument and no direct write. `authenticated` can only `SELECT` from the table, with one policy that returns the caller's own rows. The function refuses (SQLSTATE 22023) any version that is not a real date or is more than a day in the future, and (28000) a caller with no session.
- **One version.** `TERMS_VERSION` in `src/app/config.ts` is the only place the version is written: the checkbox sends it, and the prompt asks whoever has no row for it. A new version means no row, so the prompt shows again. Today it is `2026-10-08`.
- **Who is asked.** A new account ticks the sign-up checkbox (email or Google); an account that reaches onboarding with no row for the current version is asked there; an existing account is asked once on its next visit in a prompt that cannot be closed (accept, or log out). Nothing is backfilled: no existing account gets a row until it accepts.
- **Deletion.** The table cascades with the account (`auth.users`), like the other per-person tables. If acceptance records must outlive an account for legal reasons, that needs a decision and a different design.
- **Safe on either side of the migration.** Before it runs, the client treats the missing function and table as "nothing to do" and blocks nobody.

## Profile privacy (round 6)

See `docs/qa/round-6/privacy-audit.md`. Two fixes: pending and declined follow requests are readable only by the two people in them (`20261021`, in #163), and the owner-only `profiles` columns, including `is_admin`, are readable only by their owner (`20261023`, #165).
