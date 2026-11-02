# Claude Code brief: Stubby, the main character of Calendar

**Why:** the floating Stubby dock (PR #289) reads as a support-chat widget: a small button pinned bottom-right over the page, and on a phone it covers content (the Pottery card's "Fits your Sunday da…"). The founder's decision: **everything else stays the same, and Stubby becomes the main character of the Calendar page.**

**What stays the same:** the Calendar page's name, route (`/calendar`), place in the navigation, toolbar, Day/Week/Month views, Show filters, Subscribe card, plans, Pursuit sessions, Stubby's picks, Keep / Not this, and every sheet. Home's "Your week" card still opens Calendar. The bottom tab bar doesn't change.

**What changes:** the floating dock goes away everywhere. On Calendar, Stubby moves from a corner into a big, friendly spot at the top of the page, with Ask Stubby built into the page instead of a pop-up.

Follows `docs/briefs/stubby-plan.md`: Stubby talks in short approved lines (§3), and the Ask flow follows §5 to §7. This brief **replaces PR 4 (the dock)** in that plan.

---

## 1. Remove the floating dock

- Stop mounting `StubbyDock` in `src/app/pages/Root.tsx`. Delete `StubbyDock.tsx`, its test, `showStubbyDock`, the nudge helpers in `src/app/lib/stubbyDock.ts`, and `DOCK_COPY`, unless something below reuses them. Keep `nyDayKey` and anything else Calendar uses.
- Keep `StubbyDockContext` only if it's still the simplest way for Calendar's reactions to reach Stubby. Otherwise go back to a local `StubbyBuddy` ref in `Calendar.tsx`. Rename it if it stays (`StubbyContext`).
- No Stubby floats over any page anymore.

## 2. The Stubby stage (top of Calendar)

A new component, `src/app/components/calendar/StubbyStage.tsx`, rendered at the top of the Calendar's content column, **above the toolbar**. It doesn't replace the page title.

**Layout**
- **Phone (< 744px):** Stubby on the left, **88px**, resting in `ready` (smiling), standing on his soft ground shadow. His speech line is on the right, in a speech bubble pointing at him. Below, full width: the ask field, then the quick chips.
- **744px and up:** Stubby **112px** on the left, with the bubble, the field and the chips in a column to his right. At `desk` and up the stage spans the content column; the Show panel aside stays where it is.
- **No container that looks like a widget:** no floating card, no circle behind Stubby. It's part of the page, on the page background, separated from the calendar below by spacing (the existing section rhythm), not a box.

**What he says (his greeting line)** comes from the calendar he can already see (`data.windows`, `data.picks`, today's plans). It's one line from a fixed list in `src/app/lib/stubbyLines.ts`, all new and for approval:

| Situation | Line |
| --- | --- |
| Free window later today | "You're free tonight from 7. Want ideas?" (the start time from the window) |
| A plan today | "Pottery at 7 tonight. Want something after?" (the first plan's title, cut to fit) |
| Free this weekend, nothing planned | "Your weekend's open. Want ideas?" |
| Nothing free this week | "Busy week! Want something for next week?" |
| Fallback | "What are you in the mood for?" |
| Out of asks | "That's 3 for today. I'll look again tomorrow." |

The line is short (at most 12 words, as in the plan's §3) and never guilt-trips. Screen readers read the bubble text, and Stubby stays `aria-hidden`.

**The ask, in the page**
- Move `AskStubby` into the stage as its `inline` variant: the field ("What are you in the mood for?"), the quick chips (Free tonight · This weekend · Something outdoors), and "{n} asks left today".
- **Results appear right under the stage, inline**, not in a sheet or side panel: understood chips, live steps, then the picks, then follow-ups (plan §5 to §7, when those PRs land). Earlier asks stay collapsed under "Earlier today".
- **Leave room for the deck.** In plan PR 3 the picks become a deck of cards with Your selection underneath (plan §6.5). In this PR, keep the results area as one self-contained block (`StubbyResults`), so the deck can replace the list without touching the stage.
- Keep from a result does what it does today (it becomes a plan), and the calendar below updates.

## 3. Stubby reacts to the whole page

- Every reaction Calendar already plays (keep means `stamped`, not this means `unstamped` or `shrug`, invite means `torn`, an error means `tilt`, done, and so on) now plays on **the stage Stubby**.
- While Calendar loads he shows `thinking`. On an error he tilts. While an ask runs he thinks and his bubble says "On it. Checking a few places." Picks found means `stamped` and "Here's what I'd pick for you." Nothing fits means `shrug` and the honest line.
- **Hello:** the first Calendar visit of a session, he hops once with the soft ring (reuse the dock's hello and `takeHello`). On desktop his eyes follow the pointer, and on hover or focus he does a small eager hop, at most every 1.5 seconds (reuse the dock's logic). The poke-giggle stays. No looping bounce. Reduced motion means the static happy face.
- After any reaction he settles back to `ready` (smiling).

## 4. When you scroll down

When the stage scrolls out of view, a **slim sticky bar** appears at the top of the Calendar content: Stubby at 36px plus the field placeholder "Ask Stubby…". Tapping it scrolls back up to the stage and focuses the field. It sits below the page header, never over the bottom tab bar, and hides while any sheet is open. On desktop it sits inside the content column only. It shows his live state (thinking or stamped) while an ask runs.

## 5. Copy and glossary

- In `docs/glossary.md`, update the Stubby rule as the plan says: **he talks only in Ask Stubby, now on the Calendar stage.** Everywhere else he only reacts.
- Remove the dock's strings, and add the greeting lines and the sticky-bar placeholder, marked **"New, for approval"**.
- `ASK_COPY.title` ("Something different?") is no longer shown as a heading. The bubble does that job.

## 6. Tests

- `Root` no longer renders any dock, on every route that used to show it.
- Calendar renders `StubbyStage` above the toolbar, and only **one** Stubby is on the page (plus the sticky-bar mini only once the stage is out of view).
- The greeting line picks the right row of the table for: a free window tonight, a plan today, an open weekend, a busy week, the fallback, and 0 asks left. Fixed clock: Sun Nov 1, 2026, 5 pm New York.
- Keep, Not this, tear and error each play the matching state on the stage Stubby, and he returns to `ready`.
- An ask from the stage shows its results inline under the stage, not in a dialog.
- The sticky bar appears after scrolling past the stage, and tapping it focuses the field.
- Hello once per session, and no motion under reduced motion.
- All existing Calendar tests still pass (views, filters, sheets, subscribe, keep).

## 7. Visual check

Screenshots in `docs/qa/stubby-calendar/`, at 390px and 1280px, light and dark:
- Calendar top with the stage and the greeting
- Mid-ask (steps)
- Picks inline
- Out of asks
- Scrolled down with the sticky bar
- Home with **no** floating Stubby

Confirm nothing overlaps the toolbar, the tab bar, toasts or sheets.

## 8. Done when

- [ ] There's no floating Stubby anywhere, and nothing looks like a chat widget.
- [ ] Calendar opens with a big, smiling Stubby who says something about **your** week and invites you to ask.
- [ ] Ask Stubby works inline on the page, and the results land under him.
- [ ] Everything else on Calendar works exactly as before.
- [ ] One Stubby on the page, reacting to everything you do there.
- [ ] `npm test`, `npm run lint` and `npm run build` pass. Screenshots are added. One PR: **"Stubby, the main character of Calendar"**.
