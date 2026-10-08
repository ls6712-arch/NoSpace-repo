# Style guide

Every change to user-facing text follows this page. The rules below are checked
by `src/app/lib/copyRules.test.ts` (dashes, banned phrases, hand-built plurals)
and by `npm test`. Terms live in `docs/glossary.md`.

## The five product nouns

| Noun | What it is |
|---|---|
| **Moment** | Anything you post: photo, video, text, or a link. Tagged with a Corner. Can stand alone or belong to a Pursuit. |
| **Shelf** | Your profile and portfolio. Public link anyone can view; only members can follow and react. |
| **Pursuit** | Something you are working toward, with countable progress. Shown on the Shelf. |
| **Corner** | A category for discovery (Pottery, Coding, Running). |
| **Space** | A host-created community. |

Nothing else in the UI gets a capitalized name. Corners and Spaces are different
things and are never labeled as each other. A broader group a Corner sits in
(the old "Category") is internal and never shown. A Pursuit shows its specific
Corner ("Badminton"), not that group.

### Proper names that keep their capitals

Two documents are named, not described, so they keep their capitals mid-sentence
and in every label: **Terms** and **Privacy Policy** ("agree to the Terms and
Privacy Policy", footer links, page titles). Never "terms of service" or
"Privacy policy". Everything else follows the sentence case rule. These two are
not product nouns and are not extended to other documents without asking.

## Rules

### Punctuation
1. No em dashes or en dashes. Use a period, comma or colon, or "to" for ranges ("Oct 1 to 5").
2. No spaced hyphens as dashes.
3. Buttons, tabs, labels, headers and menu items have no trailing period. Full-sentence helper text, empty states and messages do.
4. No exclamation marks unless the founder approves that string.
5. Curly apostrophes and quotes in display text.
6. "…" only for truncated text or a real in-progress state ("Saving…"). Not in placeholders or menu items.

### Capitalization
7. Sentence case for every label, button, tab, header, menu item and title.
8. The five nouns are always capitalized, mid-sentence too.
9. Every other word is lowercase mid-sentence (followers, friends, profile, invite).
10. No ALL CAPS and no `text-transform: uppercase` on text labels.

### Numbers and dates
11. Plurals come from `plural()` in `src/app/lib/plural.ts`. Never `count + " followers"`. Irregular units pass their plural: `plural(2, "loaf", "loaves")`.
12. Numbers are digits: "3 Moments".
13. Times come from `src/app/lib/dates.ts` (`formatWhen`, `formatDate`, `formatDateRange`): "2h ago", "Yesterday", "Oct 3".

### Voice
14. Say what a thing does. Never explain the philosophy behind it.
15. No "not X, not Y, just Z". No soft closing one-liners. No grand statements.
16. Short and specific. If a line adds nothing, delete it.
17. Empty states say what is empty and offer one action: "No Moments yet. Log your first one."
18. Errors say what happened and what to do. No apologies, no jokes.
19. No emoji in system copy.

### One action, one label
20. The same action has the same label everywhere (list below).

## Dropped language

These must not appear in copy: reflection or a private note, journal, diary,
habit, streak, "not ranked", "non-metric", "never scored", the five areas
(Make, Coin, Crew, Move, Learn). The one exception is the Corner name "Nature
journaling". Today's sheet, Books and the Public Scrapbook are hidden behind
`extraConceptsEnabled` in `src/app/config.ts`.

## Action labels

| Action | Label |
|---|---|
| Create a Moment | Log a Moment |
| Log another after saving | Log another |
| Create a Pursuit | Start a Pursuit |
| Pause / continue / end / reopen a Pursuit | Pause, Resume, Finish, Reopen |
| Create a Space | Create a Space |
| Create a Corner | Create a Corner |
| Join a Space | Join Space, then Requested |
| Sign in / out | Log in, Log out (new account: Sign up) |
| Ask for an invite | Request an invite |
| Use an invite | I have an invite |
| Comment on a Moment | Add a thought |
| Save an edit | Save changes |
| Post to an audience | Share |
| Save for yourself | Keep it private |
| Audience options | Only you, Followers, Public |
| Leave a screen | Back, Back to Home |
| Dismiss | Cancel, Discard, Done, Not now |
