# Backlog

Things decided or found but not scheduled yet. Newest first within each
section. When something here gets built, delete it from this file in the
same PR.

## Waiting on a decision

### New domain to match the Soosh name (added Oct 1, 2026)
The app is now Soosh but still lives at `trynospace.com`. Change the domain
**before** setting up email (Step 4b), since Resend verifies one specific
domain.

- **Code (one small PR):** move the domain into one setting and use it in
  `src/app/lib/invites.ts` (`SITE_ORIGIN`, invite links) and
  `src/app/components/PreviewBanner.tsx` (`PRODUCTION_HOSTNAMES`).
- **Outside the code:** buy the domain; Vercel → Domains (add the new one,
  redirect `trynospace.com` to it); Supabase → Auth → URL configuration (site
  URL + redirect URLs); Google Cloud OAuth (authorized redirect URIs);
  Resend (verify the new domain, not the old one).
- Keep `trynospace.com` redirecting so old links still work. As of Oct 1, no
  invite links have been sent, so nothing in the wild breaks.

## Blocked

### Step 4b · Email (Resend) — blocked on the new domain
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
