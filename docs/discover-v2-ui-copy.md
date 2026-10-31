# Discover v2: copy that still needs approval

Status: **proposed, waiting for founder approval.** The strings drawn on the artboard (section 7.1 of the
brief) are approved and are in `docs/glossary.md` under "Discover v2". Everything below is a placeholder in
the code until you approve or change it.

## The brief's 7.2 list

| Where | Proposed | Where it is in the code |
|---|---|---|
| A Corner tab with no supply | Be the first (opens Create a Pursuit for With people, Create a Space for At a place) | `BE_THE_FIRST` in `lib/discoverCorners.ts` |
| Ideas empty state | Nothing fits that mix yet, with the link Try Treat me (loosens Spend to Treat me) | `IDEAS_EMPTY_LINE`, `IDEAS_LOOSEN_LINK` in `components/discover/IdeasRow.tsx` |
| City feed empty state | Nothing new nearby yet, with the link Log a Moment | `CITY_FEED_EMPTY_LINE` in `components/discover/CityFeed.tsx` |
| Each Corner card's hook line | The guide's own description (`cornerGuides.ts` `about`), unchanged | `cornerCardModel()` |
| At home tab line | The idea's title, a short thing to do (for example Start a sourdough starter) | `cornerCardModel()` |
| With people tab line | Open Pursuits with room | `PEOPLE_LINE` |
| At a place tab line | Spaces and events near you | `PLACE_LINE` |
| Each idea's title and how line | The 143 in `docs/discover-v2-idea-proposals.md` | `data/cornerIdeas.ts` |
| Category browse chips | **Not built** (see below) | |

## Other words I had to put somewhere

| Where | Proposed | Why it is needed |
|---|---|---|
| Sign up prompt title, body | Make an account to do that / Browsing stays open. An account is for following, joining and keeping what you make. | The prompt a signed-out visitor sees on Follow, Join, Ask to join and the city picker. The button labels are the existing ones |
| Feed heading with no city saved | What your city is making | The heading needs a name when the person has not set a city |
| Header with no city saved | Discover (the existing word) | Same |
| Pill accessible labels | Time: Tonight, Spend: Free, Who: A friend (the label names the current value) | The pills are buttons, so a screen reader needs the value |
| Section label for the jump chips | Sections | Accessible name of the chip row |
| Label for the Corner chips above the feed | Corners | Accessible name of that row |
| After asking to follow an author | Requested (the existing word, disabled) | A follow is a request until accepted |

## Category browse chips

The artboard shows chips like "Make with your hands" under Corners new to you. **They are not built.**
Categories stay internal after the Spaces rework (the word is never shown, and the 18 groups appear only on
Discover's old Browse tiles, on /corners and on category pages). If you want them back, say so and decide where
they go and what they open; the 18 group names already exist in `data/cornerCategories.ts`.
