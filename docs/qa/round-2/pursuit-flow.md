# Pursuit lifecycle check (V3)

Pursuit: Throw 24 bowls by spring. Each cell is progress out of 24, then status.

| Step | Home | Shelf | Pursuit page | Agree |
|---|---|---|---|---|
| start | 6 / In progress | 6 / n/a (the Shelf tile shows progress only) | 6 / In progress | yes |
| after Moment 1 (Pursuit link) | 7 / In progress | 7 / n/a (the Shelf tile shows progress only) | 7 / In progress | yes |
| after Moment 2 (main button) | 8 / In progress | 8 / n/a (the Shelf tile shows progress only) | 8 / In progress | yes |
| after Moment 3 (Pursuit page) | 9 / In progress | 9 / n/a (the Shelf tile shows progress only) | 9 / In progress | yes |
| paused | - / Paused | 9 / n/a (the Shelf tile shows progress only) | 9 / Paused | yes |
| resumed | 9 / In progress | 9 / n/a (the Shelf tile shows progress only) | 9 / In progress | yes |
| finished | - / Finished | 9 / n/a (the Shelf tile shows progress only) | 9 / Finished | yes |

Notes:

- Run with `node scripts/visual/qa-pursuit-flow.ts --dist <fixture build>` (build as in `scripts/visual/qa-shots.ts`). It runs against the visual harness fixtures, not the live database.
- Home shows no progress number for a paused or finished Pursuit (it moves to the list under "Paused" or "Finished"), so those cells read "-". That is not a mismatch.
- Found while running this: the Shelf crashed after logging a Moment whose stand-in id was not a number. Fixed in `tileTokenFor` (MomentCard.tsx). It only happens when a log is saved without an id, which the fixture database does.
- Moments were logged as "Only you" Moments (the default), so this also confirms private Moments count toward Pursuit progress.
