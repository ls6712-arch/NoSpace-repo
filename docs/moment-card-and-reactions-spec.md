# Moment card everywhere + reactions and comments with counts

Save as `docs/moment-card-and-reactions-spec.md`. Read `docs/CLAUDE-redesign-brief.md` first. This spec **amends** that brief and the glossary where noted in section 1. Nothing else needs to be read to build this.

## STATUS (keep this current — survives context compaction)

Branch `redesign/moment-card`, off `main`. Commits below are oldest first.

**Done:**
- MomentCard built (§2), no callers yet — `5c05933`
- Counts decided maker-only, not a setting (§4) — `f2a8f16`, docs updated `9d994b0`
- `post.likes` dropped from feed/Featured ranking — `6b5abae`
- My Space → MomentCard (MomentPanel) — `07a10a7`
- You/Shelf → MomentCard (WorkGrid, HobbyArchive, MyPostsGrid) — `51316e3`
- #86 Reflection leak fixed: owner-only `post_reflections` table, explicit column lists everywhere posts are fetched, no more `select("*")` on posts — `9d8c498`
- WorkGrid grouped by month per board 1 (both You and PublicProfile) — `e4ba4a5`
- #80 + #82: reactions moved off localStorage onto `public.reactions`; maker-only count pills wired into MomentCard; "Ask {name} to make it together?" reuses BePart/requestTogether; Add-a-thought quick starters — `425ed5c`
- #76 Discover's Featured Moments row → MomentCard (scoped down from board 7 — see report in that commit; the "All Moments" ContentCard grid is untouched, that's #77's job) — `fec97e7`
- #87 My Space → board 4's lead+grid sheet, replacing ContactSheet + single panel; right rail kept as a sidebar (explicit call, boards 4/5 show none) — `f8ff790`
- #79 (partial) deleted ContactSheet, MomentPanel, MyPostsGrid, MomentFeedOverlay (zero importers) — `87dafd4`
- #77 CircleBoard → MomentCard, extended with an Answered/Open badge (reads `post.circleTab`/`post.answered` directly) plus a `canMarkAnswered` prop, and an activity block (when/where/going) shown whenever `post.startsAt` is set — `8466dc7`
- #77 Corner, CategoryFeed (Work tab), Pursuit (Updates grid) → MomentCard, each gaining its own `openPost`/MomentDetail dialog — `e4c1096`. PublicProfile was already done via WorkGrid (#75); nothing to change there.
- §4.6 amended: Circle Events' "N going" approved as a non-ranking exception (may show "0", unlike reaction pills) — `0f2a82a`

**Next, in order:**
1. #78 Migrate MomentDetail to MomentCard at lead size + its own thoughts list
2. #79 (finish) — delete `ContentCard.tsx`, `PostBookmark.tsx`, MomentDetail's old inline reaction/thought markup once #78 lands and nothing imports them. `ContentCard`'s only remaining callers are Discover's own "All Moments" grid and Home.tsx (neither in this spec's migration list)
3. #81 Close out the post_engagement plan (marker task, no migration needed — already true, just needs saying in the final report)
4. #83 Report on `post.likes`/`post_likes`: defined, still written by `toggleLike`, but zero UI callers since MyPostsGrid's deletion — confirm nothing else reads it, then report, don't drop
5. #85 Final report: every difference from the mockups, `reactions` row count (0 as of `425ed5c`, including any `keepgoing` rows), anything still reading `posts.likes`, any surface not migrated and why

**Known, deliberate mockup differences (see each commit for detail — don't re-litigate):**
- Boards 6/7/4 show counts on someone else's Moment (the pre-maker-only design); every surface built on this branch keeps counts maker-only per §4.1 instead
- Discover has no "All Moments" masonry to migrate (only the Featured row existed) — scope cut in `fec97e7`
- My Space's right rail is a sidebar; boards 4/5 show no rail at all — kept per an explicit product call in `f8ff790`
- WorkGrid has no click-through "quiet read" feed (MomentFeedOverlay, retired) — card media opens MomentDetail directly instead, matching every other surface
- MomentCard's anatomy now includes two things §2.1 never mentions (an Answered/Open badge, an activity when/where/going block) — added for CircleBoard on an explicit call in `8466dc7` rather than leaving Circle threads on their own bespoke markup

## 0. Setup

**Visual target.** The design canvas: https://claude.ai/artifact/CL9dzjVaNzsKhznwVHW8dY. Export boards 1 to 7 into `docs/mockups/` (You, You with theme cover, You mobile, My Space desktop and mobile, the shared Moment card, Discover). Where a mockup and this text disagree, **the mockup wins for layout, spacing and type; this text wins for behavior.** Report every difference you choose.

**Branch:** `redesign/moment-card` from `main`. Small, reviewable commits. One surface per commit.

**Explore first, then report before editing:** the components that render a Moment today (`ContentCard`, `discover/MasonryCard`, `PhotoCard`, `VideoCard`, `DiscoverCardChrome`, `MomentPanel`, `ContactSheet`, `MomentDetail`, `MyPostsGrid`, `WorkGrid`, `CircleBoard`, `Pursuit`, `HobbyArchive`, `PublicProfile`, `CategoryFeed`, `Corner`), how `PostReactions.tsx` stores reactions today (localStorage key `sushii.reactions.v1`), and the state of `public.reactions`, `public.thoughts` and `public.posts.thoughts_private` in the live project.

**Rules (from the brief, unchanged):** semantic tokens only (no raw hex, no `text-white`), `APP_NAME` constant for the product name, vocabulary from the glossary, no route/table/component renames unless this spec says so, no new UI library, shadcn primitives for dialogs and buttons.

## 1. Decisions that change earlier rules

Update these in the same PR so the docs stop contradicting the app.

| Where | Old | New |
|---|---|---|
| Brief section 0, rule 4, Reactions bullet | "Love this / I'm in / Keep going, three across, no counts shown to others" | "Love this (heart), Count me in (raised hand), Add a thought (comment bubble). A small count sits beside each and hides at zero. Bookmark is separate and private." |
| Glossary, Reactions | Three text reactions, no counts | Three icon actions with counts, as above |
| Glossary, "I'm in" | I'm in | Renamed **Count me in** |
| Glossary, "Keep going" | A reaction | Retired as a button. It survives as a quick starter inside Add a thought |
| Comment in `supabase/migrations/20260919230300_reactions_and_bookmarks.sql` | "no aggregate ... never as a count" | Superseded by section 4.3 |

**This reverses the earlier "no counts shown to others" rule**, which the glossary recorded with research on how visible counts can turn into a scoreboard. It is the product owner's decision. Keep the guardrails in section 4.6, because they are what keeps the rest of the brief's anti-extractive tone true.

## 2. One MomentCard

Build a single `MomentCard` and replace every separate card implementation with it. Layout wrappers (sheet, shelf, masonry) stay separate from the card.

### 2.1 Anatomy, top to bottom

1. **Media**, radius 22px (define one radius token, do not scatter values).
   - Photo: `object-cover`, fixed height per surface (see 2.4).
   - Carousel and video: reuse `PostMediaCarousel` and the existing play badge.
   - **Text-only Moment: a typographic tile**, not a quote icon. The caption text is the picture: Fraunces italic, on a solid tile. Rotate the tile through three semantic tokens (accent, a moss/green token, an ink token) chosen deterministically from the post id. Text uses the matching on-color token. Contrast at least 4.5:1.
   - **Only-you Moment:** a 2px dashed outline with a 5px offset around the media, plus a lock in the label. No other color change.
   - **Number badge** (`01`, `02`) only when the `number` prop is passed. Only My Space's sheet passes it.
2. **Meta row.**
   - Others' Moments: avatar (photo or initials), serif name (links to the person), small-caps line `{Corner} . {Pursuit}` (each links to its page).
   - Your Moments: small-caps Corner on the left, `{PUBLIC | Circle name | ONLY YOU} . {time}` on the right.
3. **Caption**, Fraunces italic, 22px on cards, 26px on wide cards, 40 to 44px on a lead card. No ellipsis truncation of meaningful text (clamp to 3 lines on small cards with a real "Open" affordance).
4. **Action row.**
   - Others' Moments: `Love this`, `Count me in`, `Add a thought` — **icon-only, no counts** — and a private Bookmark icon pushed to the right.
   - Your Moments: the same three icons, **read-only** (you don't react to your own Moment) and **each showing its own count**, hidden at zero (section 4), plus `Edit`, a visibility button (eye icon, opens the existing visibility control), and a dashed **Reflection** mark **only when a Reflection exists**. The Reflection mark and the Reflection text are visible to the owner only and never rendered for anyone else.

### 2.2 Props

```ts
type MomentCardProps = {
  post: Post;
  surface: "mySpace" | "you" | "discover" | "profile" | "circle" | "pursuit" | "archive" | "feed";
  number?: string;              // "01".."06", sheet only
  size?: "lead" | "wide" | "standard" | "compact";
  onOpen?: () => void;          // opens MomentDetail
};
```

`mode` (own or others') is derived from `post.userId === user.id`. It is never passed in.

### 2.3 States and behavior

- Hover, focus-visible and pressed states on every button. Minimum 44px touch targets.
- Every icon button has an `aria-label`, a `title`, and `aria-pressed` where it toggles. On someone else's Moment the accessible name is just "Love this" (no count exists to include). On your own Moment the icons are read-only counts, not toggles — the accessible name includes the number: "Love this, 12".
- Keyboard: Tab order is media (opens the Moment), name link, action buttons.
- Animations at most 150ms, and none under `prefers-reduced-motion`.
- Private/only-you and visibility labels come from the same helper used by `MomentDetail` today. Do not fork it.

### 2.4 Sizes per surface

| Surface | Wrapper | Card size |
|---|---|---|
| My Space | Sheet: lead card, then a 3-column grid, then a 1.6fr/1fr row. Max 6 per sheet, numbered | lead, standard, wide |
| You | Shelf with month dividers, 3 columns then a 1.6fr/1fr row, "Turn the page" at the end | standard, wide |
| Discover | Keep the existing masonry engine. Featured lead on top, "Nothing loads on its own" at the end | lead, standard, wide |
| Public profile, Corner, Circle, Pursuit, archive | Same grid as You | standard |
| Phone | One column. Media height about 320px | standard |

### 2.5 Migration order (one commit each)

1. `MomentCard` plus its unit/visual tests, with no callers.
2. My Space (`MomentPanel`, keep `ContactSheet` frames as thumbnails).
3. You (`MyPostsGrid`, `WorkGrid`, `HobbyArchive`).
4. Discover (`MasonryCard`, `PhotoCard`, `VideoCard`, `DiscoverCardChrome`).
5. Public profile, Corner, `CategoryFeed`, `CircleBoard`, `Pursuit`.
6. `MomentDetail` becomes the same card at lead size inside the dialog, plus the thoughts list.
7. Delete the old components once nothing imports them. Do not delete a component that still has a caller.

## 3. Reactions: model change

- **Love this** (`love`) and **Count me in** (`in`) are the only reaction types written from now on.
- **Add a thought** is not a reaction. It writes to `public.thoughts`, which already exists.
- `keepgoing` stays **allowed** in the `reactions.type` check constraint for existing rows, but nothing writes or shows it. Do not delete rows. Report the row count.
- `PostReactions.tsx` currently keeps state only in localStorage. Move it to `public.reactions` (one query for "my reactions among these posts", insert/delete on toggle). Retire the localStorage store and its sign-out clearing.

## 4. Counts

### 4.1 Who sees a count

**Maker-only, fixed — not a setting.** A count is visible only to the Moment's own maker, viewing their own Moment. Everyone else sees icon-only buttons: no number, ever, on someone else's Moment. There is no `REACTION_COUNTS` constant and no "everyone" mode — this replaces that three-way toggle entirely.

### 4.2 What is counted

| Icon | Count is |
|---|---|
| Heart | rows in `reactions` with `type = 'love'` |
| Raised hand | rows in `reactions` with `type = 'in'` |
| Comment bubble | rows in `thoughts` |

### 4.3 Data: no new view, no new function

Because a count only ever needs to be correct for the Moment's own maker looking at their own Moment, the existing RLS already does the gating — there is nothing new to build server-side:

- `reactions`' own SELECT policy is "the reactor and the post's author can see a reaction." A plain `select count(*) from reactions where post_id = :id and type = 'love'`, run as the signed-in viewer, naturally returns the true total when that viewer is the post's author, and at most 1 (their own row, if any) otherwise. The UI only *displays* the number when `post.userId === viewer.id` — belt and braces, since a non-maker's query is already capped at their own single row, never the real total.
- `thoughts`' own SELECT policy is wider (anyone who can see the Moment reads its thoughts, not just the maker), so it does not self-limit the same way — the client must gate the display explicitly there: query the count only when rendering your own Moment, exactly as for the two reactions.
- No migration, no `post_engagement` function, no security-definer anything. One small `select count`-style query per icon per own-Moment card, or one batched query per rendered page of your own Moments if that turns out cheap to do (no requirement either way — there's no cross-post visibility logic left to worry about since this never runs for someone else's Moment).
- Confirm indexes on `reactions (post_id, type)` and `thoughts (post_id)` still make sense for these — no different from before.

### 4.4 UI

- Others' Moments: the three icons are plain toggle buttons, no number anywhere on or near them.
- Your own Moments: the three icons are **read-only** (you don't react to your own Moment) and each shows its own count as a small tabular-figure numeral beside the icon. **Hidden at zero.** Above 999 show `999+`.
- Toggling (on someone else's Moment) is optimistic client-side reaction state as before — see section 3 — it just never surfaces a number to the person doing the toggling.
- **Count me in** keeps its existing behavior on others' Moments. After the first tap, offer a quiet inline "Ask {name} to make it together?" that reuses the existing participation flow (`BePart` / `requestTogether`). Do not build a second one.
- Numbers are for the maker's own orientation only. They never change order, size or emphasis of a card, and never appear to anyone but the maker.

### 4.5 Add a thought (the comment icon)

- The bubble opens a Dialog/Sheet using the existing `Thoughts.tsx` and the `thoughts` table.
- It is a **short prompted note, not a thread**. No replies to replies.
- Quick starters above the composer: "Keep going", "How did you...?", "Show us the next one". Tapping one fills the field. Never post on tap.
- Respect `posts.thoughts_private`: only the maker and the writer read them.
- The list of thoughts shows in `MomentDetail`. On cards, only the count shows.
- On your own Moment, `MomentDetail` may show **who** reacted (the RLS already allows the author to see it), for example "Ana and 3 others counted themselves in". This is visible to the maker only.

### 4.6 Guardrails (keep the anti-extractive tone)

Counts must **never**:
- sort, rank, filter or promote anything ("popular", "trending", "most loved" are not allowed anywhere),
- appear as a profile total ("1,204 hearts"),
- drive Quiet Milestones, badges, or any threshold (`badges.ts` says nothing counts likes; keep it true),
- trigger a notification such as "12 people loved this". Keep per-person events only, as today,
- appear on Bookmark, which stays private,
- show a "0".

Discover stays chronological. "Featured Moments" stays curated.

**Approved exception:** a Circle Event's "N going" count (§4's activity block, added in `8466dc7`) is not a reaction count and may show a "0" — knowing nobody's going yet is the point, unlike a Moment's reaction pills, which hide at zero to avoid a visible "0 loved this." It must never be used to sort, rank, or promote Events, same as every other count on this page.

### 4.7 Cleanup

`MyPostsGrid.tsx` displays `post.likes` (a legacy field). Replace it with the new counts or remove it. `posts.likes` and any `post_likes` table are legacy: **do not drop them**, just stop reading them, and report whether anything else still does.

## 5. Tests and "done when"

Second-account RLS tests (the brief already requires these habits):
- [ ] A plain `reactions` count query for someone else's Moment, run as a signed-in non-owner, returns at most 1 (their own row only) — never the true total.
- [ ] A plain `thoughts` count query for someone else's Moment, run as a non-owner, still returns the true total when thoughts aren't private (RLS is wider there) — confirming the UI-level maker-only gate is load-bearing for that one, not RLS.
- [ ] `anon` gets the same capped/zero behavior as a signed-out viewer on both tables.
- [ ] A third party cannot read another person's `reactions` rows (existing policy, unchanged).
- [ ] Toggling Love this or Count me in twice restores the original state.

UI checks:
- [ ] One `MomentCard` renders the same anatomy on My Space, You, Discover, profile, Circle and Pursuit, at 390, 768 and 1280 widths.
- [ ] No count of any kind ever renders on a Moment you don't own, on any surface.
- [ ] A count on your own Moment is hidden at zero and matches the real row count in `reactions`/`thoughts`.
- [ ] Reflection text and the Reflection mark never render for anyone but the owner.
- [ ] Only-you Moments are dashed and labelled on every surface.
- [ ] Keyboard only: every action reachable, `aria-pressed` correct (toggle buttons) or absent (read-only own-Moment counts), 44px targets.
- [ ] `rg "#[0-9a-fA-F]{3,6}" src/app/components` finds no raw color in the new components.
- [ ] No old card component is left with zero importers.

## 6. Report back

List: every difference from the mockups; the `reactions` row count including any `keepgoing` rows; anything still reading `posts.likes`; and any surface you could not migrate, with the reason.
