# Contrast audit with scrims (issue #217)

## What was wrong

The audit finds the layers under each piece of text with `elementsFromPoint`.
That skips every element with `pointer-events: none`, which is how most scrims
are built (`CornerCard`, `Billboard`, `Category`). So the audit never saw the
scrim and judged white text against the bare photo: the 210 pairs reported in
PR 4 (228 on the same four screens in this run).

## What changed in `scripts/visual/contrast.ts`

- Pointer events are switched on for every element while the audit runs, so
  scrims and overlays are in the stack. CSS transitions are switched off too, so
  a colour still fading in (a tab turning active) is read at its settled value.
- Each fill is weighted by its element's effective opacity. A hover-only overlay
  at opacity 0 no longer counts.
- Large decorative art at under 50% opacity (a category tile's tilted icon at
  22%) tints the fill under it instead of being treated as a photo.
- Text that isn't at its own probe point is skipped as covered or scrolled out,
  as before.

The worst-case photo is still #E6E6E6 and black, as documented in
`scripts/visual/README.md`.

## Results

- `before-four-screens.txt`: the old audit on /corners, /browse/food-drink,
  /corners/pasta and /corners/bbq at 390 and 1440, dark and light. 228 pairs.
- `contrast-audit.txt`: the new audit on every screen at 390 and 1440, dark and
  light. 160 views, 5390 text elements, **0 pairs below 4.5:1** (3:1 large).

Checks on the audit itself:

- With `--scrim` cut to 10% black, the same audit flags 62 pairs on /corners and
  /corners/pasta, so it still sees a scrim that is too thin.
- With a pure white photo instead of #E6E6E6, 4 pairs fail on the four screens:
  the Pasta and Fermentation card names on /browse/food-drink at 390, 4.15:1
  (20px semibold needs 4.5:1). Not fixed here; see the PR.

## Real failure found and fixed

Seeing more layers exposed one real bug the old audit had skipped: the "Start a
Pursuit" option in the Log's Pursuit picker (`PursuitField.tsx`) used the fill
colour `--coral-deep` as text. That's 3.54:1 on the dark sheet. It now uses
`text-accent-text`: 6.46:1 dark, 5.39:1 light.
