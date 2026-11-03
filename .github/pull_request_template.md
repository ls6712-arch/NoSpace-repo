## What this changes

<!-- One or two sentences. -->

## Checklist

- [ ] Copy follows `docs/style-guide.md` (no dashes, sentence case, `plural()` and `dates.ts` helpers)
- [ ] No new product nouns (only Moment, Shelf, Pursuit, Corner, Space, Stub are capitalized names)
- [ ] The same action has the same label everywhere it appears
- [ ] Checked at 390px width: no horizontal scroll, readable text, tappable buttons
- [ ] No placeholder text, test names or TODOs visible in the UI
- [ ] `npm test` and `npm run lint` pass

## Stubby (only if this touches `supabase/functions/stubby-scout`, `supabase/functions/_shared`, Stubby's migrations or how the app calls Stubby)

After merging, before telling anyone it's live:

- [ ] Migrations from this PR applied from main (with the founder's written approval naming each file), their verification scripts run, and no fixture rows left behind
- [ ] `stubby-scout` redeployed from main, read back, and every file compared byte for byte (`node scripts/record-stubby-deploy.ts <read-back.json>`); the record merged so the `stubby-deploy` check on main is green
- [ ] `STUBBY_VERSION` bumped in `supabase/functions/_shared/stubbyVersion.ts` if the request or the answer changed shape
- [ ] One live ask tested end to end by the founder
