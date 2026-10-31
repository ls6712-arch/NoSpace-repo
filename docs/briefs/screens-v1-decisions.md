# Soosh screens v1: decisions log

Source: the founder's `Soosh_app_screens_1.pdf` (8 screens). Decided Oct 30, 2026.

## Decided (global)
- **Plan vs Pursuit:** a Plan is one dated thing ("Climbing tonight 7 PM"). A Pursuit is a goal over several sessions ("Pasta from scratch, 5 sessions"), and each session shows up as a Plan. Both words stay.
- **Look:** keep the PDF's layout but use the visual spec v1.1 look: dark "After hours", Bricolage Grotesque + Inter, no monospace, no capitals. *(Superseded Oct 30 by the one-skin brief: light by default, dark by choice.)*
- **Tabs:** 4 tabs: Home · Discover · Log · You. Week moves into Home, and Home's "Your week" card opens the Week view.
- **Prices:** all prices stay as drawn, guide estimates included. **This overrides the trust rule against prices in guides.**
- **City:** New York, as drawn.
- **Process:** one screen at a time. Every detail is confirmed before anything is designed.

## Discover (confirmed in part; not built yet)
- Tabs: This week · Corners · Spaces (no Pursuits tab).
- This week, in order: Last seats → Fits your week → **Open Pursuits near you** (new) → Your friends are doing (as Pursuit cards).
- Corners tab: **Your Corners** first, then the mood chips, then the Browse grid.
- Spaces tab: not yet confirmed. Proposed: "Near you" rows with avatar, type and area, Open or Closed, next session, friend signal and Follow, with no counts.

## Week view (confirmed Oct 30; first design on the "Soosh Week view" canvas, awaiting founder review)
Opens from Home's "Your week" card (`/week`, a placeholder today). Not a tab.
- **Planner extras stay as drawn** ("9 good plan hours", the budget slider, "Free evenings you told us"). Founder's call Oct 30, overriding the Oct 29 Chairman cut.
- **Free windows** show an empty slot with a **"Find something"** link to Discover, not a suggestion. *(Changed Oct 31: Stubby now puts one pick in a free slot; see Calendar.)*
- **"This week in New York" row:** yes, hand-curated by the founder or an admin each week (Halloween and other city happenings).
- **Friends** shown on each plan.
- **Month view (confirmed):** a Week · Month toggle. Past days show the Stubs collected, future days show plans and bookings, both filled in automatically. The "+" on a day creates a Soosh plan (an activity, a time, optionally a friend), not a free-form event. No outside-calendar sync in v1. *(Changed Oct 31: replaced by the full calendar below; sync out is in.)*
- **Assumed in the first design (to confirm):** the week is the next 7 days (today first), matching Home's card; days with nothing on collapse to one line; the month shows Sunday-first; a "Share" card for the month in Stubs.
- **Still missing:** the PDF's "Your week" page is not in the repo. The extras are approximated from their text; match them to the drawing once the founder attaches it.

## Calendar (decided Oct 31; design on the "Soosh Calendar" canvas; brief `claude/claude-code-brief-calendar.md`)
- **A full calendar** at `/calendar`: Day · Week · Month · List, with Today and previous/next, like Google Calendar. Replaces the Week · Month toggle. The rail item "Week" becomes "Calendar" (to confirm).
- **Only Soosh things in it:** plans, Pursuit sessions, Stubs, free time, Stubby's picks, friends' plans, your blocks, Google busy (no titles). No free-form events.
- **Show filters:** people choose what they see (Busy is off by default in Month).
- **Editing is one tap or one drag, with undo, never "are you sure":** tap empty time to make a plan, add free time or block it; tap anything you own to change, cancel, leave, skip or remove it.
- **Usual week + this week's changes:** the grid stays the usual week; one-off free and busy changes and private blocks live in `calendar_entries`.
- **Stubby:** one pick per free stretch, picked again whenever anything changes, with a true reason line, Keep and Not this. Empty beats filler. No pick data to the server until the Privacy Policy line on suggestion logging is published. No notifications yet. Reverses the Oct 30 "no suggestion in the slot".
- **Sync:** out now (a private subscribe link for Google, Apple, Outlook). In next: Google busy/free only, after Google's app verification (founder to start it). Apple waits for a native app; Outlook if asked. Never event titles; empty calendar time is never treated as free.
- **Parked:** friends seeing your free time and "free with friends" matching.

## Open
- **Levels:** decide on the You screen (in progress).
