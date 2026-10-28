# Corners build: founder decisions

Newest first. Briefs are checked against this log; where they differ, this log wins.

## Oct 26, 2026

Not in this file yet. The text of the Oct 26 log was not attached when this file was added, so nothing is recorded here for that date rather than guessing it. Paste it in below this heading.

## Oct 28, 2026: Corners wave 1 (PR #203)

1. Soccer and Basketball are `kind: "skill"` in `cornerGuides.ts`, like the other ball sports (Tennis, Pickleball, Padel, Volleyball). The brief's `"games"` was wrong. Ultimate frisbee's `traits.kind` is `"skill"` too.
2. Sauna & cold plunge is `together: "together"`, so it stays under "Be around people".
3. Improv leaving "Start with what you have" is correct (`haveIt: false`).
4. Live music `worth` reads "Small rooms, close to the band", not "Small shows are cheap" (no price words).
5. City walks keeps "Stories behind places you pass daily" (not a target).
6. The 12 new Corners ship without their own photos; the photo IDs come later, and each Corner is removed from `AWAITING_PHOTO` in `homeCorners.test.ts` as its photo lands.

## Oct 27, 2026: tickets (overrides the Door list brief)

1. "Take the ticket" is cut everywhere. Tapping the cover card or the "Admit one" sticker opens the ticket.
2. Tickets are only for real events. When a Corner has an upcoming event in an Open Space, the cover story and Start here cards show a ticket to that event: event title, Space, time, place, "I’m going" (the existing event RSVP). Cards keep the order they are ranked in now.
3. When no event fits, the card is a plain "How to start" card showing the Corner's first step, linking to the Corner. No "Admit one", serial or stub edge.
4. Not built: `ticket_saves`, `posts.from_ticket`, the "From a ticket" Stub type. Stub types are silver, with someone, event, plain.
5. `docs/glossary.md` updated: "Take the ticket" removed, "ticket" now means a ticket to an event, "How to start" covers the Discover card.
