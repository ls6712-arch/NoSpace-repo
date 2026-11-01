# Backlog

Things decided or found but not scheduled yet. Newest first within each
section. When something here gets built, delete it from this file in the
same PR.

## Waiting on a decision

### Finish the onsoosh.com move (added Oct 31, 2026)
onsoosh.com is bought and live on Vercel from `main`; trynospace.com is now
staging from `staging` (docs/deploys.md). `SITE_DOMAIN` is `onsoosh.com`.
Still to do by hand: Supabase → Auth → URL configuration (Site URL
`https://www.onsoosh.com`; redirect URLs for both domains); Google Cloud OAuth
(authorized JavaScript origins, if any are set); Resend (verify onsoosh.com,
not trynospace.com). This unblocks Step 4b.

## Blocked

### Step 4b · Email (Resend) — domain is ready (onsoosh.com)
"Maya asked you something about your first moment," linking straight to the
reply. Resend chosen Oct 1, 2026. Needs: Resend account, verified domain,
`RESEND_API_KEY` in Supabase Edge Function secrets, and the sending address
(e.g. `hello@<domain>`). Then: a Supabase Edge Function plus a trigger on
the first written thought on someone's first moment.

## Ready to build

### Invite into a shared Pursuit (Step 2 plan item)
"Maya invited you to bake bread with her this month": an invite that also
drops the invitee into the inviter's Pursuit. `invites` has no Pursuit link
yet. Also enables the "…to Bread month with Maya" wording on the first-moment
screen (Step 3).

### Split bio and cover tagline at onboarding
Onboarding writes one field into both `bio` and `cover_tagline`
(`Onboarding.tsx` `finish()`). Proposed Sept 22: bio = "what got you into
this" (one line), tagline stays optional.

## Live checks not done yet
Run on phone and desktop, light and dark, with two real accounts.

- Invite end to end: claim → first moment (real photo, HEIC too) → inviter
  sees the "added their first moment" notice → **Welcome to Soosh** opens the
  reply box. Under 2 minutes from sign-up.
- A pending account (no invite claimed) only ever sees `/welcome`.
- Love from two accounts on one moment → one notification, both names.
- **Count me in → Start a Pursuit with [Name]?** → partner gets the invite.
- Day-2 **Invite someone?** card on My Space for a day-old account whose
  first moment has a thought.
- Admin → Invites → **First moments** tab.

## Hide Spaces with no member Moments
Hide Spaces with no member Moments, later, once there is enough content. Partner Spaces (`spaces.is_partner`) must always be exempt.

Deferred, not applied: `supabase/deferred/20261102000000_space_events_listing.sql` section 2 (`spaces_with_member_moments()`). On Oct 30, 2026 live had one active Space and it had no member Moments, so hiding would have emptied Discover, Corner pages and Search. The app already shows every Space when the function does not exist (`src/app/lib/spaceMoments.ts`). When this comes back, make it a new migration, add the partner exemption to the function, and re-check how many live Spaces it would hide first.



## Palette (decided Oct 30, 2026)

Decided: there is one skin. The Transfer palette (cobalt, signal yellow, navy, Archivo) is retired on onboarding and login, including Stubby's yellow; Stubby is coral with an ink face. See the one-skin brief (PR 3). In the onboarding brief's references, sections 3.1 and 3.2 are replaced by that PR.
