# Verification — Safety rails: CI checks + preview banner

## CI

Job **ci** (`.github/workflows/ci.yml`) ran on this PR's own head commit and
passed: checkout → Node 20 → `npm ci` → `npx tsc --noEmit` → `npm test`
(vitest) → `npm run build`. See the PR conversation for the run link.

## Preview banner

**What these screenshots are:** this sandbox's outbound network policy
blocks the Vercel preview domain entirely (confirmed via `curl` — a `403`
"policy denial" from the egress proxy on
`no-space-repo-git-chore-ci-and-preview-banner-nospace1.vercel.app`), so a
real screenshot of the actual Vercel preview couldn't be taken from here.

What's attached instead is a real Chromium pass against a local
`npm run dev` server (`http://localhost:5173`) — the same app, same
`PreviewBanner.tsx` component, same build. Since `localhost` is one of the
two hostnames the banner treats specially, this exercises the "Local · not
the live site" copy rather than "Preview · not the live site" — the
component's only other branch is a one-line string swap
(`LOCAL_HOSTNAMES.has(hostname)` in `PreviewBanner.tsx`), and the
production-hidden case (`trynospace.com`) is a plain `Set.has()` early
return with nothing left to visually verify beyond the logic itself.

- `local-desktop-light.png` / `local-desktop-dark.png` — 1280×800.
- `local-phone-light.png` / `local-phone-dark.png` — 390×844 (iPhone 12/13
  width).

All four confirm: the banner sits in normal document flow above the
sticky Header (pushes it down, never overlaps its buttons), the safe-area
padding renders without collapsing the banner, and the `--surface-muted`/
`--hairline`/`--muted-foreground` tokens read clearly in both themes.

**Still needed from a real network** (either by widening this sandbox's
egress policy, or done by hand): open the actual Vercel preview URL and
confirm the "Preview · not the live site" copy shows there, and after
merge, confirm `trynospace.com` shows no banner at all.
