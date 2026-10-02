# Visual regression harness

Drives the real, unmodified app through every screen at several widths and
themes, with **no network and no app changes**: the build points at a fixture
Supabase origin and Playwright intercepts every request.

```
npm run visual -- --out /tmp/shots                    build, run, screenshot, detect
npm run visual -- --dist <dir> --baseline <dir>       reuse builds; diff against another one
npm run visual -- --screens space-table,pursuit --widths 375 --themes dark
npm run visual:selftest                               prove the detector reacts to +45% type
```

## What it checks

- **clipped** text (`overflow: hidden`, which covers `truncate` and `line-clamp`),
  and whether it has a `title` / `aria-label`
- **off-screen** text outside any scroller, and **page-level horizontal scroll**
- text that **wraps onto more lines** than in a baseline build
- screenshots at 375 / 768 / 1440, light and dark (`--out`)

`--strict` exits 1 on new flags or any horizontal page scroll.
`--selftest` re-runs three screens with every type step inflated by 45% and
fails unless the detector's flag count and horizontal scroll both grow, so a
"no regressions" result can't come from a detector that has gone blind.

## How the backend is faked

- `fixtures.ts`: rows typed against `database.types.ts` (generated from the live
  schema), so a renamed or missing column is a compile error, not an empty screen.
  Regenerate the types with Supabase's `generate_typescript_types`.
- `postgrest.ts`: an in-memory PostgREST emulator (filters, order, embedded
  resources via the generated foreign keys, single-object and count headers).
- `mock-supabase.ts`: auth session (seeded into `sb-fixture-auth-token`), REST,
  RPCs, storage placeholders, and a quiet realtime socket. Writes are
  acknowledged and not stored.
- `screens.ts`: the screens. Add one and it is covered at every width and theme.

Not reachable by this harness: anything needing real OAuth, real storage
objects, camera or microphone, or realtime events.

## Webfonts

Layout checks need the real font metrics. If the browser can't reach Google
Fonts, pass `--fonts <dir>`: the latin subsets are cached there once (via
`curl`) and served to the page through interception.

## Setup

`playwright-core` is a devDependency and needs a Chromium: set
`PLAYWRIGHT_CHROMIUM` to its path, or have `PLAYWRIGHT_BROWSERS_PATH` point at
a Playwright browser install.
