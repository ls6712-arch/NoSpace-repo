# Corner starter content validation

This is a local production-build review with fixture accounts and Supabase responses. It is not a live-site or production-database test.

## Results

| Check | Result |
| --- | --- |
| `npm test -- --maxWorkers=4` | 249 files, 2,349 tests passed |
| `npx tsc --noEmit` | Passed |
| `npm run lint` | Passed, zero design-token violations |
| `npm run build` | Passed; existing large JavaScript chunk warning remains |
| `node scripts/check-migrations.ts origin/main` | Passed, 233 migration files; no migrations changed |
| `bash scripts/check-no-build-output.sh` | Passed |
| `npm run test:pursuits:db` | Workflow, legacy compatibility and Calendar verification passed in isolated PostgreSQL; no fixture rows remained |
| `npm run e2e:corner-starters` | Five Chromium viewport/theme profiles and all ten guest Corner pages passed |

The browser runner builds with fixture Supabase variables and serves the actual `vercel.json` response headers, including CSP. Its saved [report](report.json) records scope and results. CI now runs the runner and uploads its evidence. Local screenshots were also inspected.

## Browser coverage

- 320px and 390px phones, 768px tablet, 1440px desktop, and 390px dark mode, with reduced motion.
- Actual Corner routes and public editorial sections, three activity disclosures and one Pursuit template per supported Corner.
- Keyboard disclosure operation, unknown cost wording, 44px controls, no horizontal page overflow and no automatic creation while browsing.
- Relevant outbound HTTPS links, new-tab protection and no third-party embeds in Resources.
- All six supplied local photos must be present and decode. Four other Corners retain the existing remote-photo lookup/fallback; external network requests are blocked in fixtures.
- Editable title and full checklist instructions, current owner and canonical Corner mapping, private solo defaults, fresh UUIDs and no unsolicited invitees.
- Existing create RPC request and saved-Pursuit navigation. A simulated failure preserves edits and retries with the same project ID.
- Guest signup handoff preserves the selected template ID. Unit integration coverage also checks normal creation, unknown template IDs and the existing More options form.

The local database runner separately exercises the existing owner/member/outsider rules, blocked and paused accounts, checklist contributions, legacy progress, invitations, scheduling and Calendar compatibility. It uses isolated schema fixtures, not the live Supabase schema.

## Screenshots

- [Reading Pursuit with supplied photo](reading-pursuit.png)
- [Reading resources](reading-resources.png)
- [Phone activities](mobile-activities.png)
- [Desktop activities](desktop-activities.png)
- [Desktop resources](desktop-resources.png)
- [Editable Pursuit form](mobile-editable-pursuit.png)
- [Dark mode resources](dark-resources.png)

Focused section screenshots omit existing fixed navigation/action overlays only during capture, so the complete section can be read. Interaction, overflow and touch-target checks run with those overlays visible. Full-page captures in the downloadable local evidence retain the normal overlays. All account and live-row content in browser captures is fixture data. No screenshot represents a deployed release.

## Remaining release checks

1. Review and merge the implementation PR, then confirm the deployed build contains it. This session does not merge or deploy.
2. On the released site, open Drawing, Reading and Painting from Discover, confirm the three sections and try guest signup through the chosen template.
3. With a real approved account, deliberately create and edit one test Pursuit, then confirm its private visibility from another account. Live OAuth, approval and production RPC behavior were not exercised here.
4. Check current availability and terms of the linked websites before release. No source claims to be copyright-free, and the implementation republishes no third-party source material.

See [implementation and rollback notes](../../content/corner-starter-content.md). Removing these sections requires an application rollback only; do not delete member-created Pursuits.
