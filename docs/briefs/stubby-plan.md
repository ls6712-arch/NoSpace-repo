# Stubby plan: a friend who knows you

**Status:** plan for review. Nothing gets built until the founder signs off on this page.

**Replaces:** `claude-code-brief-ask-stubby-v2.md`. The floating dock (PR #289) is being replaced by `claude-code-brief-stubby-calendar-hero.md` (see §9).

**In repo as:** `docs/briefs/stubby-plan.md`. Claude Code builds it one PR at a time (§8), and only when told "build PR n".

## 1. What we're making

Today Stubby is a search box (first hidden on Calendar, then a floating corner button that reads like a support chat). He sits still while he searches, pastes up to 7 loosely related results, and ignores "tonight" and "with my girlfriend".

Stubby becomes a friend who knows you:

- He's the main character of Calendar: big, smiling, talking about your week.
- He asks a quick question only when he needs to.
- You can see him working while he looks.
- He suggests a few things that fit you: your profile, who you're with, your budget, your free time. Each one comes with why.
- You can steer him (cheaper, later, something different).
- He learns from what you keep and pass on, and relearns as your taste changes.

Inspiration: Muse (the agent is one tap away), Dots (a friendly character, but buried in a sidebar, which we avoid), Instinct (asks and acts like a person, learns from a short note about you, proactive but rarely), Wispr Flow (learns from every correction without asking anyone to "train" it).

## 2. Decisions made (Nov 1, 2026)

| Topic | Decision |
|---|---|
| Asking questions | Only when something's missing. At most one question before a search, answered with a tap. |
| Solo | Lean toward solo-friendly events, meet-people events, do-it-yourself ideas, plus an occasional bring-a-friend nudge. |
| Stubby's voice | Stubby talks. This changes the glossary rule "It never talks; it reacts" (see §3). |
| Learning | In this plan, built last, merged only after the founder approves a new Privacy Policy line. |
| Looks | Uses the existing Stubby/StubbyBuddy art only. He rests smiling and is eager to help. |
| Where he lives | The main character of Calendar. No floating button anywhere. Calendar itself (name, views, nav) stays the same. |

## 3. Stubby's voice (new; approve before PR 3)

The glossary changes from "Stubby never talks; it reacts" to: "Stubby talks only in Ask Stubby, on the Calendar stage, in short, warm lines. Everywhere else he still only reacts." The landing page, onboarding and Stubs stay as they are.

Rules for his lines:

- **Short.** One line, 12 words at most. One question at a time.
- **Warm, never pushy.** He never guilt-trips ("You haven't gone out in a while") and never makes anyone feel bad (the rule in `Stubby.tsx`).
- **Honest.** He says when nothing fits. He never claims he went somewhere or pretends to be a person. He doesn't promise prices or times he hasn't read.
- His lines come from a fixed list in `src/app/lib/stubbyLines.ts`, approved in the glossary. The model writes only the why line on each pick, under the rules in §6.3.
- He appears as a speech bubble from the Stubby at the top of Calendar. Screen readers read the text, and Stubby himself stays `aria-hidden`.

Starter lines (new, for approval):

| When | Line |
|---|---|
| Calendar opens | A line about your week (see the Calendar brief §2), or "What are you in the mood for?" |
| Missing who | "Going solo or with someone?" |
| Missing when | "When are you free?" |
| Missing vibe | "What kind of fun?" |
| Looking | "On it. Checking a few places." |
| Found | "Here's what I'd pick for you." |
| Nothing fits | "Nothing tonight that fits. Here's the soonest after." |
| Error | "Something went wrong on my end. Try again?" |
| Out of asks | "That's 3 for today. I'll look again tomorrow." |
| Bring-a-friend | "This one's better with a friend. Bring someone?" |

## 4. The flow, start to finish

```
Open Calendar → Stubby at the top says something about your week ("You're free tonight from 7. Want ideas?")
   ├─ type an ask, or tap a quick idea (Free tonight · This weekend · Something outdoors)
   ↓
Understand (code, instant): when · who · budget · vibe · place  →  chips shown at once
   ↓
Anything missing that matters?  ── yes → ONE question, tap answers (§5)  ── then ↓
   ↓ no
Search with live steps (§7): "Looking for: …" · "Checking 9 pages" · "Picking the best"
   ↓
3 picks (at most 5), each with when · where · price · why · Open · Keep · Not this
   ↓
Follow-ups: Cheaper · Closer · Later · Something different · More like this
   ↓
Keep → Stubby happy hop, it becomes a plan (existing Keep flow)
Not this → a new pick takes its place if there is one
   ↓
(PR 5) Every tap is a lesson → nightly note → better next time
```

## 5. When and how he asks

He needs three things: **who** (solo, partner, friends, family), **when** (a time window) and **what kind** (vibe or activity).

- Fill from the ask first, then the profile, then this session's earlier answers, then (after PR 5) what he's learned.
- Ask only if one is still missing, and only the one that changes results most. The order is: who, then when, then what kind.
  - "something fun": who is missing, so he asks "Going solo or with someone?"
  - "something fun with my girlfriend": when is missing; with free windows in the profile, use those and don't ask.
  - "pottery tonight": nothing important is missing, so search straight away.
- At most one question per ask. Answers are chips, plus Surprise me (skip and guess). Typing an answer works too.
- Answering a question doesn't use an ask. Only the search does.
- He remembers the answer for the session and shows it as a removable chip ("Solo ×"). After PR 5 he stops asking what he already knows ("You usually go with your partner" becomes the default chip, still removable).

Question chips (new, for approval):

- **Who:** Just me · With my partner · With friends · With family
- **When:** Tonight · Tomorrow · This weekend · Pick a day
- **What kind:** Active · Make something · Food & drink · Chill · Learn something · Surprise me

## 6. What he suggests

### 6.1 By who's coming

| Who | Lean toward | Avoid |
|---|---|---|
| Solo | A mix of three kinds: solo-friendly events (drop-in classes, workshops, open studios, where coming alone is normal), meet-people events (beginner socials, run clubs, group classes that make talking easy), and do-it-yourself ideas (no booking: a walk route, a free museum hour, a café to sketch in, a session on one of their own Pursuits). Default mix: 2 events and 1 idea. | Couples-only, "bring a partner", big-ticket shows |
| Partner | Things two people do together: classes for two, tastings, walks with a destination, workshops, a nice place to end up | Big group runs, long hikes, solo drop-ins |
| Friends | Group-friendly: games nights, team activities, markets, classes that take bookings for 3 or more | Things capped at 1 or 2 people |
| Family | All-ages, daytime, free or cheap | 21+, late nights |

**Bring-a-friend nudge (solo only):** at most once per set of results, on a pick the model marks `better_with_friend: true` (for example a pottery-for-two class). It shows "This one's better with a friend. Bring someone?" and opens the existing invite/Stub flow (the torn-tab half ticket). It never appears twice in a row in one session.

### 6.2 Do-it-yourself ideas (a new kind of pick)

Today every pick must be a dated event with its own page. Ideas need their own kind: `kind: "idea"`.

- An idea has a title, a suggested time inside their window, a place, and a real page for the place (the museum's hours page, the park's page) that came from the search. Or it's a Soosh link: a Corner guide (`src/app/data/cornerGuides.ts`), a Corner's start page (`/start/:space/:corner`), or one of their own Pursuits.
- Ideas are never presented as events. The card label is "An idea", not a date-and-time ticket. Prices only as the page states them.
- An idea fits only if it's in a Corner they picked, or the ask asked for it.

### 6.3 Quality rules (all asks)

- **"Tonight" means tonight.** The time window is a hard filter in code. If nothing fits, say so and show at most 3 of the soonest after, clearly labelled.
- **The event's own page only.** Drop landing, listing, roundup and calendar-index pages (`/lp/`, `/events/p\d+`, `/events/exhibits`, Substack posts, `/things-to-do`, any page listing many events). Tell the model: "If you find it in a roundup, search again for its own page."
- **No 21+ or bars unless asked:** brewery, bar, 21+, tasting.
- **Best 3 (at most 5),** ranked by fit to this person.
- **One why line per pick,** written for this person, 15 words at most. No hedges. Example: "A hands-on class for two, 15 minutes from you, under your budget." The price and checking notes become one clean line, never repeated. "Free" without an exclamation mark.

### 6.4 What he knows about the person (no learning needed)

Read in the edge function, as the caller, from their own rows only: their picked Corners (`profile_private.picks`), free windows (`free_windows`), monthly budget (`monthly_budget`, giving a per-outing ceiling of about a quarter, unless the ask says otherwise), neighborhood and city, and passes (`user_passes`). All of it goes into an "About this person" block, written as information and preferences, not instructions.

### 6.5 Picks come as a deck of cards (decided Nov 1, 2026)

Picks aren't shown as a list. They come as a deck: one card in front, the next ones peeking out behind it.

Each card: title, when, where, price, the why line, and Open (the event's page), plus two actions:

- **Keep:** the card flies into Your selection (a tray under the deck) and the next card comes forward. Stubby stamped. Keeping does not make a plan yet; it only shortlists.
- **Not now:** the card slides back into the deck and the next card comes forward. Stubby does a small shrug. (Chosen over "Put back", "Skip" and "Pass": it says the card isn't gone, it'll come around again.)
- **Bring it back:** a button that brings back the card you just said "Not now" to, so you can change your mind right away. It works for the last 3, newest first.

**Where a "Not now" card goes:** to the back of the deck, so it comes around again only after you've seen the rest. (The first idea was to put it just behind the next card. With that rule, passing two cards in a row swaps the same two forever and you'd never reach the third. "Bring it back" covers changing your mind instead.)

**Your selection:** up to 5 kept cards, shown as small tickets in a row. You can remove one there (it goes back into the deck). When you're ready, pick one or more, then Make it a plan, which uses the existing Keep flow (RSVP or join) and puts it on the calendar. Stubby stamped, a happy hop.

**When the deck runs out:** "That's all I found. Want more?" (new, for approval). Options: See the ones you skipped (the deck refills with them), Ask again (a new search, which uses an ask), or Go to your selection.

Feel and access:

- Swipe right to keep and left for not now, with the card tilting as you drag. Always with buttons too, so it works by keyboard and screen reader. The arrow keys work on desktop: → keep, ← not now, ⌫ bring it back.
- The card count is visible ("2 of 5"), and screen readers announce each new card.
- Under reduced motion, cards switch instantly with no fly or tilt.
- Follow-ups (Cheaper · Later · Something different…) sit under the deck and add new cards to the back of the deck instead of replacing it.

**Privacy:** until PR 5, the deck, "Not now" cards and selection stay in this browser, exactly like Keep and Not this today (`pickPrivacy.test.ts`). In PR 5, Keep and Not now become the main learning signals: "Not now" is a softer "no" than Not this used to be, and making a plan is the strongest "yes".

**Golden case:** a deck of A, B, C, D. Not now on A, then B: you see C, and the order is C, D, A, B. Bring it back: B is in front again. Keep B: B goes to the selection and C is in front. Keep C and D, then make a plan from B and D: two plans on the calendar, and C stays in the selection.

## 7. Feels alive while he looks

- **0 seconds:** the understood chips appear, and Stubby says "On it. Checking a few places." and switches to thinking.
- **Streamed steps** from the edge function (Server-Sent Events): understanding, each search (shown as "Looking for: …"), "Checking 9 pages", "Picking the best for you", then done. Ticks as each finishes.
- **After 12 seconds** with no new step: "Still looking. Good finds take a moment."
- **Picks reveal one by one,** and Stubby stamped on the first. Under reduced motion, everything appears at once.
- **Stop button:** aborts the search, and the ask still counts (it was paid for).
- **Errors:** Stubby tilt, his error line, and a Try again button.
- **Only this ask's results are shown.** Earlier ones go under a collapsed "Earlier today". The count matches what's shown.

## 8. Build order (one PR each, in this order)

| PR | What | Why this order |
|---|---|---|
| 1. Smarter picks | §5's intent reading in code (`intent.ts`: when, who, budget, vibe), §6.1 to 6.4 (who modes, solo mix, ideas, quality rules, profile), best 3 with why. Backend plus the card. | Fixes the bad results first. Everything else depends on picks being good. |
| 2. Alive while looking | §7: streaming, steps, one-by-one reveal, Stop, results grouped by ask. | Fixes "I thought it wasn't working". |
| 3. Conversation, voice and the deck | §3, §5 and §6.5: Stubby's lines and bubbles, the one question, the deck of cards and Your selection, follow-up chips, the bring-a-friend nudge, the glossary update. | Needs PRs 1 and 2 underneath. |
| 4. Stubby on Calendar | `claude-code-brief-stubby-calendar-hero.md`: remove the floating dock, and make Stubby the main character at the top of Calendar with the ask in the page. | Fixes the chat-widget look. Can be built first if you want it soon; it's independent of PRs 1 to 3. |
| 5. Learning and relearning | Signals, the nightly note, 60-day fade, What Stubby knows in Settings. The Privacy Policy line is approved first. | Needs the policy, and needs the taps from PRs 3 and 4. |

### PR 5 in more detail (unchanged from v2, plus solo and who)

- Draft the Privacy Policy line in the PR, and stop for approval. For example: "When you use Ask Stubby, we keep which picks you keep, pass on or open, who you usually go with, and a short note of what you like, so his picks get better. See, edit, clear or turn it off in Settings > What Stubby knows."
- `stubby_signals` (owner-only): `kind` (keep, not_now, remove, open, going, plan), `pick_kind` (event or idea), `corner`, `price_band`, `with` (solo, partner, friends or family), `starts_at`, `created_at`. The ask text is never stored. Update `pickPrivacy.test.ts` on purpose to match.
- `stubby_notes` (owner-only): one note of 600 characters at most, rewritten nightly by Haiku from the profile, the last 60 days of signals and the current note. For example: "Usually solo on weekdays, with partner on weekends; likes beginner pottery and evening runs; prefers meet-people events when solo; keeps things under $40."
- **Relearning:** signals older than 60 days fade out. Profile changes win immediately. Repeated recent "Not this" picks outweigh old Keeps. The person's own edits to the note always win.
- It cuts down questions: a confident "who" or "when" from the note becomes a default chip instead of a question.
- Settings > What Stubby knows: read, edit, clear, and a learning on/off switch.
- **Cost guard:** refresh only for people active in the last 30 days, using Haiku, with the count logged.

## 9. Where Stubby lives (decided Nov 1, 2026, evening)

The floating dock (PR #289) looked like a support-chat widget and covered content on phones. It's being removed. Stubby becomes the main character of the Calendar page, and everything else about Calendar stays the same. See `claude-code-brief-stubby-calendar-hero.md`. The once-a-day nudge goes away; his greeting line on Calendar does that job.

## 10. Still open (decide before the PR that needs it)

- **Follow-ups and limits (PR 3):** does a follow-up (Cheaper, Later…) cost a full ask? Suggestion: the first follow-up after an ask is free, and later ones count. The limit stays 3 asks a day, or 5 if follow-ups count.
- **Ideas and links (PR 1):** can an idea link only to a Soosh page (a Corner guide or Pursuit) with no outside page? Suggestion: yes.
- **Sharing (PR 1):** today asked-for finds are also added to everyone's City picks. Should solo and partner finds be shared too? Suggestion: share events only (never ideas), with no trace of who asked, as today.
- **Stubby talking elsewhere (later):** keep him silent on the landing page, onboarding and Stubs for now.
- **Model (PR 1):** stay on Haiku and compare with Sonnet on the golden cases (§11). Switch only if the picks are clearly better.

## 11. Golden test cases (every PR must keep them passing)

Fake search results, fixed clock: Sunday Nov 1, 2026, 5:00 pm New York.

| Ask | Profile | Expect |
|---|---|---|
| "something fun" | none | One question: "Going solo or with someone?". No search until it's answered. |
| "something fun to do with my girlfriend tonight" | none | The Nov 1 seven are all dropped (not tonight, landing or roundup links, brewery). Result: "Nothing tonight that fits" plus at most 3 soonest after, couple-friendly. |
| "something to do tonight", answered Just me | Corners: pottery, running | A mix of solo-friendly or meet-people events plus 1 idea, all ending by 11:59 pm tonight. At most one bring-a-friend nudge. |
| "pottery tonight" | budget $50/month | No question. Picks at most about $12 or free; anything pricier is dropped with a reason. |
| "free stuff this weekend with the kids" | none | Family mode, Fri 5 pm to Sun. Free only, no 21+, daytime first. |

## 12. Done when (whole plan)

- [ ] Stubby is the main character of Calendar, smiling, and talks only in short approved lines. No floating widget anywhere.
- [ ] Something changes on screen within 1 second of asking, and at least every 3 seconds after.
- [ ] He asks at most one question, only when something important is missing.
- [ ] Solo, partner, friends and family each get noticeably different picks, and solo includes do-it-yourself ideas.
- [ ] "Tonight" means tonight, and every link is the event's or place's own page.
- [ ] The best 3, each with a "why" for this person, and follow-ups to steer.
- [ ] After PR 5, with the policy approved, he learns and relearns, and people can see, edit, clear or turn it off.
