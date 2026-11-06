# Draft privacy-policy line: profile city used for activity counts

**Status: draft for founder approval. Not in the app.** `src/app/pages/PrivacyPolicy.tsx` is unchanged;
when approved, the paragraph goes into the page (and `src/app/pages/legalCopy.test.tsx` is updated with it).

**Why:** Top 10 in {city}, Never been done in {city} and the Founding Stub count Moments by city. For a
Moment that does not show a city, the count falls back to the city on the author's profile, which is
kept private. That is a new use of the profile city, so the policy should say so.

**What the system does (migration `20261118000000_post_city_key.sql`):**

- A Moment shared with Everyone gets a private city key: the city the Moment shows, else the author's profile city.
- Not shared with Everyone, or the person took the city off that Moment: no key.
- The key is stored where no signed-in person can read it, never shown, and used only inside counts
  ("41 people this week"). Nothing returns a key or names a person.

## Proposed text

Place it under **What we collect**, after the paragraphs about date of birth.

> **Your city.** If you add a city to your profile, we use it to count activity by city, for example how many people logged a Moment in a Corner in your city this week. We count a Moment toward your city only if you shared it with Everyone, and not if you took the city off that Moment. A Moment shows a city only when you leave it on. The totals never name anyone, and we use your city for nothing else here.

## For the founder to decide

1. Wording and placement (the paragraph above uses the product nouns Moment and Corner, no dashes, sentence case).
2. "Nothing else here" is a promise: Stubby already uses a city you tell it, and Discover reads the profile city to pick things near you. If you want the sentence to cover those, say "and for showing you things near you".
3. If the Founding Stub flag is ever turned on, a line saying a Founding Stub may show the city of that Moment.
