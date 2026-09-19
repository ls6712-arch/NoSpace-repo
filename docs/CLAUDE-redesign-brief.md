# Redesign brief: warm luxury editorial theme + Settings

Read this whole file before changing anything. Work on a branch. Make small, reviewable commits. Do not rename routes, tables, or components unless this brief says to.

## 0. Rules of engagement

1. **Explore first.** Before editing, read the repo and report: styling approach (Tailwind v3 `tailwind.config` or v4 `@theme` in CSS), router type (the live app uses hash routes, `/#/`), where the CSS variables live (`--cream`, `--coral-deep`, `--forest`, `--yellow`, `--hairline`, `--font-serif`, `--font-body`, `font-hud`), the auth/data layer (the strategy memo says Supabase with RLS), and every hardcoded hex or `text-white`. Give me a short plan and wait for a go-ahead.
2. **Follow the existing stack.** React, TypeScript, Tailwind, shadcn/ui. Reuse shadcn primitives (Button, Dialog, Tabs, Input, Switch, RadioGroup, AlertDialog). Do not add a new UI library.
3. **No raw colors in components.** Use semantic classes only (`bg-background`, `text-foreground`, `bg-card`, `border-border`, `text-accent`). No hex, no `text-white`, no `text-black`.
4. **Vocabulary is fixed** (from the glossary). Use these words in UI copy:
   - **Space** (top-level community), **Corner** (craft inside a Space), **Circle** (smaller community; you can **Follow** or **Join**), **My Space** (your feed), **Discover**.
   - **Moment** (anything logged, private or shared), **Reflection** (private note), **Pursuit** (ongoing named thing), **Update**.
   - **Clan** (private mutual connections, visible only to the owner), **This Corner**, **Quiet Milestones**, **Shelf**.
   - Reactions: **Love this / I'm in / Keep going**, three across, no counts shown to others. **Bookmark** is separate.
   - Never use: Creation, Entry, Post, Project, Category, Thread (as a feature).
5. **Anti-extractive tone.** No streaks, no confetti, no leaderboards, no urgency copy, no auto-loading feeds, no numeric badges. When in doubt, choose quieter.
6. **Product name:** the mockups say "Sushii", the project files say "NoSpace". Put the name in a single constant (`APP_NAME`) and use it everywhere. Ask me which to use if it isn't obvious from the repo.

## 1. Design tokens

Define these under `:root` (light) and `.dark`. Dark is **warm charcoal, never purple or blue-black.**

| Token | Light | Dark |
|---|---|---|
| `--background` | `#F6F1E7` | `#1C1816` |
| `--card` | `#FBF8F1` | `#26211D` |
| `--foreground` | `#2B2622` | `#EFE8DA` |
| `--muted-foreground` | `#6B6259` | `#A39885` |
| `--border` (hairlines) | `#DDD3C0` | `#3A332B` |
| `--accent` | `#9A4A34` | `#C8674D` |
| `--accent-foreground` | `#FBF8F1` | `#1C1816` |
| `--gold` | `#B08D4A` | `#C9A55E` |

- Also keep the shadcn tokens (`--primary`, `--secondary`, `--muted`, `--ring`, `--input`, `--destructive`, `--popover`) mapped onto the values above. `--destructive` is a muted brick red that works on both themes; check contrast.
- Accent is for primary actions and active states only. Gold is a tiny detail only (eyebrows, milestone line-art, dividers).
- During migration, alias the old names (`--cream` -> `--background`, `--coral-deep` -> `--accent`, etc.) so nothing breaks. Remove the aliases in the last commit.
- **Verify contrast** (WCAG AA: 4.5:1 body text, 3:1 large text and UI). Check foreground, muted-foreground, accent-on-background, and accent-foreground-on-accent in both themes. Tune the hex values if any fail, and tell me what you changed.

**Type**
- Headlines: `--font-serif` (Fraunces). Page openers 56-72px, section titles 28-40px, captions 13-14px. Pull-quotes in italic.
- Body/UI: `--font-body` (Inter), 15px, line-height 1.6.
- Labels: small caps, uppercase, 11px, letter-spacing 0.12em. Retune `font-hud` to this.

**Shape and space**
- 8px spacing base (8/16/24/32/48/64/96). Radius 12px cards, 8px buttons and inputs. Retire pill buttons and `rounded-2xl/3xl` in favor of these.
- Soft shadows in light mode only (`0 8px 24px rgba(43,38,34,0.06)`). In dark mode use a lighter card fill plus a hairline border instead of shadows.
- Thin hand-drawn SVG rule as a divider (reuse it, don't redraw it per page).
- Paper-grain overlay: 3-4% opacity light, 2% dark, as one fixed pseudo-element, `pointer-events: none`.

## 2. Task A: theme system (do this first)

1. **Preference model:** `"system" | "light" | "dark"`. Default `"system"`.
2. **No flash:** add a tiny inline script in `index.html` `<head>` that reads the saved preference from `localStorage`, resolves `system` via `matchMedia("(prefers-color-scheme: dark)")`, toggles the `dark` class on `<html>`, and sets `color-scheme`. Wrap storage access in try/catch.
3. **ThemeProvider + `useTheme()` hook:** exposes `preference`, `resolvedTheme`, `setPreference`. When the preference is `system`, listen for OS changes and update live.
4. **Persistence:** save to `localStorage` always. When signed in, also save to the user's profile (`theme_preference`) and prefer the server value after login so it follows the person across devices.
5. **Transition:** when the theme changes, add a `theme-transition` class to `<html>` for about 400ms (`transition: background-color, color, border-color, fill, stroke 400ms ease-out`), then remove it. Disable entirely under `prefers-reduced-motion: reduce`.
6. **Appearance section in Settings:** three radio cards (System default / Light / Dark) exactly as in the current mockup: a small preview swatch, serif label, small-caps sublabel, selected state with a terracotta dot. Use `RadioGroup` for correct keyboard and screen-reader behavior. Fix the helper copy to: "Light is warm paper, dark is warm charcoal. Same identity in either."
7. **Illustrations:** refactor `GeneratedArt.tsx` so fills that are currently hardcoded constants (`DENIM`, `OLIVE`, `TERRACOTTA`, `MUSTARD`, `BLUSH`, skin/hair sets) read from CSS variables, with dark-tuned values so art doesn't glow on charcoal. Photos stay as they are; add a soft overlay only on hero images.
8. **Image assets:** anything with a baked-in light background (logos, PNGs) needs a dark variant or transparent background.

## 3. Task B: restyle, screen by screen

Order matters. Finish and check each before starting the next. After each screen, screenshot light and dark at 1440px and about 380px, and list anything unresolved.

1. **Primitives:** Button (filled accent primary, text button secondary, no pills), Input, Card, Tabs, Dialog, Switch, RadioGroup, Badge, section header (`N · EYEBROW` + serif title), divider, reaction row.
2. **Settings** (Task C below).
3. **My Space:** varied Moment entries (image-led, text-led as a serif pull-quote, paired images), slim sticky right rail (Shelf, Pursuits still moving, Circles), reactions three across, and an end-of-feed "You're caught up" block instead of auto-loading. Exclude the signed-in user's own Moments from the feed.
4. **Profile:** large serif name and italic bio, quiet stat line, tags, Shelf (stacked books grouped by Space, keep the existing concept), Pursuits still moving, Quiet Milestones strip (thin gold line-art, non-numeric), the record grid. Private Moments carry a small-caps "ONLY YOU" label. One primary "Add a Moment" button per screen.
5. **Moment detail, Create (`/create`), Space and Corner pages, Circle pages, Discover, onboarding hobby-picker (build if missing), product/marketplace pages, Inbox, landing page.**

Hard rules for every screen: one accent-filled primary action, no raw hex, both themes verified, reduced-motion respected, focus rings visible, touch targets at least 44px, no truncation that hides meaningful information (allow two lines instead of an ellipsis).

**Motion:** 200-300ms ease-out for micro-interactions, 500-700ms for page/panel transitions. Cards lift 2px on hover, images zoom 2-3%, scroll reveals fade and rise 8px, staggered 40ms. No bounce, spring, or confetti. Everything is disabled or reduced to opacity-only under `prefers-reduced-motion`.

## 4. Task C: Settings page

Route: keep the existing Settings route. Layout: single centered column, max about 720px, each section introduced with `N · EYEBROW` and a serif title, separated by the hand-drawn divider. Save behavior: each section saves independently with an inline "Saved" confirmation (small-caps, muted), not one giant form. Show field-level errors under the field. Never lose typed input on error.

### 4.1 Appearance
As specified in Task A.

### 4.2 Profile
- **Display name:** free text, 1-60 chars, trimmed. Changes appear everywhere immediately.
- **Username:** unique, lowercase, 3-30 chars, `a-z 0-9 _ -`, no leading/trailing separator, reserved words blocked (`admin`, `settings`, `create`, `discover`, `inbox`, `marketplace`, etc.). Debounced availability check. Limit changes to once per 30 days, and show when the next change is allowed. Keep the old username as a redirect for 30 days if the routing allows.
- **Bio:** up to 280 chars, with a quiet character count.
- **Avatar:** upload, crop to square, 5MB max, jpg/png/webp, delete option. Keep the current illustrated avatar as the fallback.

### 4.3 Account
- **Email:** show the current address. "Change email" opens a dialog: new address plus current password. Send a confirmation link to the **new** address, keep the old one active until confirmed, and send a notice to the **old** address. Show a "pending confirmation" state with resend and cancel.
- **Password:** current password, new password, confirm. Enforce a minimum length (at least 10) and show strength quietly. If the person signed up via a social provider, show which provider instead and hide this form. Offer "Sign out of other devices" after a change.
- **Sign-in methods / sessions:** list active sessions (device, approximate location, last active) with "Sign out" per session and "Sign out everywhere". Include only if the auth layer supports it. Otherwise ship just "Sign out everywhere".

### 4.4 Privacy
- **Default visibility for new Moments:** radio group with **Only you**, **My Clan**, **Everyone**. Explain each in one line. (A specific Circle is chosen per Moment at the Share step, not as a default.)
  - **Default for new accounts: Only you.** The current mockup shows "Public". Change it.
  - Helper copy: "Applies to Moments you create from now on. You can still choose who sees each one." Existing Moments keep their visibility.
  - Optional separate action, behind a confirmation dialog: "Apply this to all existing Moments." Never do this implicitly.
- **Discoverability:** toggle for "Show me in Discover" and toggle for "Show my This Corner section on my public profile".
- **Connections/messages:** who can send connection requests (Everyone / Only people in my Corners / Nobody). Messaging stays gated behind an accepted connection.
- **Critical dependency:** these controls are only honest if visibility is actually enforced. The strategy memo says friends-only visibility is not enforced against a second account and lists this as the top-priority fix. Do not ship these controls as "working" until the RLS policies enforce `private` / `clan` / `public` for Moments, Reflections (always private), and profile fields. Audit the policies table by table, write tests that use a second account, and report the results.

### 4.5 Notifications (email)
Quiet by default. Toggles: connection requests (on), replies to my Moments (on), Circle updates for Circles I Joined (off), weekly digest (off), product news (off). Security emails (email change, password change, sign-in from a new device, deletion) are always on and shown as such. No push nudges, no re-engagement emails.

### 4.6 Your data
- **Export:** "Download everything I've made": a zip containing a JSON file (profile, Moments, Reflections, Pursuits, Updates, Circle memberships, reactions, bookmarks) plus original images. Generate server-side, email a time-limited download link. Include private items and Reflections, since they're the person's own.
- **Points:** decision needed. Options: (a) remove from the UI, (b) keep as a single muted line, "Points collected · 1,240", inside Your data. Default to (b) until I decide, and don't style it as an achievement.

### 4.7 Danger zone (Delete account)
A clearly separated section with a muted destructive style, not a loud red banner.

Flow:
1. **Explain** exactly what will be deleted (profile, Moments, Reflections, Pursuits, images, reactions, bookmarks, Clan connections, Circle memberships) and what won't (for example, order records the marketplace must legally retain, and messages others already received, if applicable). Offer the data export first.
2. **Confirm identity:** require current password (or fresh provider re-auth) and typing the username.
3. **Circles:** if the person owns or moderates a Circle, block deletion until they transfer ownership or archive it, and say so clearly.
4. **Marketplace:** if they have open orders or an active seller listing, block with a clear explanation and a path to resolve.
5. **Grace period (recommended, confirm with me):** mark `deletion_requested_at`, hide the profile and Moments immediately, sign the person out, and email a "Cancel deletion" link valid for 14 days. After 14 days a scheduled job hard-deletes.
6. **Hard delete runs server-side only** (Supabase Edge Function or equivalent) using the service role key, which must never reach the client. Verify the caller's JWT, then delete storage objects, rows (prefer `ON DELETE CASCADE` FKs), and finally the auth user. Log the event with no personal content.
7. After completion: land on the public landing page with one quiet line: "Your account has been deleted."

### 4.8 Data model (adapt to what exists)
Add via migrations, don't edit the DB by hand:
- `profiles`: `display_name`, `username` (unique, lowercased), `bio`, `avatar_url`, `theme_preference` (`system|light|dark`, default `system`), `default_visibility` (`private|clan|public`, default `private`), `discoverable` (bool), `show_this_corner` (bool), `connection_requests` (`everyone|shared_corners|nobody`), `username_changed_at`, `deletion_requested_at`.
- `notification_preferences` (or a JSON column) keyed by user.
- RLS: a user can read and update only their own settings columns. Public-facing columns are exposed through the visibility rules in 4.4, not by open SELECT.

### 4.9 Security and quality bar
- Server-side validation for everything the client validates. Rate limit username checks, email changes, password changes, export requests, and deletion.
- Sensitive actions (email, password, deletion) require recent authentication.
- All dialogs trap focus, close on Escape (except mid-deletion), and return focus to the trigger. Forms have proper labels and `aria-describedby` for errors and helper text.
- Never log emails, passwords, or Reflection content.
- Add tests: username validation, visibility default, email-change confirmation state, deletion blocked by owned Circle, and the second-account RLS checks.

## 5. Acceptance checklist (report against this when done)

- [ ] Tokens defined for both themes, old aliases removed, no raw hex or `text-white` in components (show the grep).
- [ ] System / Light / Dark works, no flash on reload, follows OS changes live, syncs to profile, respects reduced motion.
- [ ] Contrast checked for both themes and fixed where needed (list the numbers).
- [ ] `GeneratedArt.tsx` reads from variables and looks right in dark.
- [ ] Every restyled screen verified light and dark at 1440px and about 380px.
- [ ] Settings: profile, account, privacy, notifications, data, and delete flows all work end to end.
- [ ] Default visibility for new accounts is Only you, and visibility is verified by a second-account test.
- [ ] Account deletion cannot be completed from the client alone, and the grace period works.
- [ ] No banned vocabulary, no counts on reactions, no streak or leaderboard elements.
- [ ] Open questions listed (product name, points, grace period, Archive vs Shelf wording).

## 6. Kickoff prompts (send one at a time)

**Prompt 1: explore**
> Read CLAUDE-redesign-brief.md. Don't edit anything yet. Explore the repo and report section 0 item 1: styling approach, router, CSS variable locations, auth/data layer, and a list of hardcoded colors. Then propose a commit-by-commit plan for Tasks A, B and C and list any questions.

**Prompt 2: theme system**
> Implement Task A from the brief on a new branch `redesign/theme`. Include tokens for both themes, the no-flash script, ThemeProvider, the Appearance settings section, and the GeneratedArt refactor. Run the contrast check and show me the numbers and any changes you made to the hex values. Screenshot My Space and Settings in both themes.

**Prompt 3: restyle**
> Do Task B, primitives first, then one screen at a time in the order given. After each screen, stop and show light and dark screenshots at desktop and mobile widths, and wait for my go-ahead.

**Prompt 4: settings**
> Implement Task C on `redesign/settings`. Start with the migrations and RLS, then the Profile, Account, Privacy, Notifications, Data, and Delete sections in that order. Do the RLS audit and second-account visibility tests before you enable the Privacy controls. Stop before the deletion Edge Function and show me the design for the grace-period job.
