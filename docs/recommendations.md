# How the Corners home picks what to show you

A small version of how a streaming service decides what to put in front of you.
Nothing here is shown to anyone: no scores, counts, ranks or reasons. It only
changes the order of rows and cards, for the person looking.

## How a service like Netflix does it

1. **Signals.** Mostly implicit: what you played, how much of it, when, what
   you searched, what you saved or skipped. Recent behaviour counts more.
2. **Candidate generation.** From the whole catalogue, pick a few hundred
   titles that might fit, by (a) content similarity to what you watched,
   (b) collaborative filtering ("people with a history like yours watched
   this") and (c) what is popular or trending right now.
3. **Ranking.** A model scores each candidate for you, blending those signals.
4. **Page construction.** The page is rows, and the rows themselves are chosen
   and ordered per person (the best rows first, a "continue watching" row pinned
   at the top). Titles within a row are ordered by score, and near copies are
   spread out so a row is not ten of the same thing.
5. **Cold start.** A new person has no history, so the service leans on
   popularity and context until it has signals.
6. **Exploration.** A little randomness and fresh items, so the page does not
   freeze around yesterday's taste.

## What Soosh does with that

| Step | Here |
|---|---|
| Signals | `my_corner_affinity()` (migration `20261029000000`): your own Moments (private ones too, only for you), Pursuits, likes and saves of public Moments, followed Corners, joined Spaces, "I’m going" RSVPs. Each is weighted (Pursuit 4, Moment 3, "I’m going" 2.5, save and follow and Space 2, like 1.5) and fades with a 45 day half-life. |
| Candidates | Every one of the 158 Corners gets a score. |
| Similar to what you do | The taste profile is your 6 strongest Corners. A Corner's content score is its similarity to them (`cornerSimilarity.ts`: moods, kind of pursuit, solo or together, indoors or out, start with what you have, group of the 18, setting, time). This is how "you do Pottery" lifts Ceramics, which you never touched. |
| People like you | `peers`: for each other person with public Moments in the last 90 days, how many Corners they share with yours (cosine), summed over the people who post in a Corner. Only counted when 2 or more different people contribute. |
| Trending | `trending`: how many different people posted publicly in a Corner in 30 days. Only counted at 2 or more people. |
| Score | `0.30 own + 0.08 own Space + 0.30 similar + 0.14 people like you + 0.10 trending + 0.03 curated + a daily shuffle of up to 0.04` (`recommend.ts`, `WEIGHTS`). |
| Rows | A row's relevance is the mean of its best 4 Corners' scores (its own Corners, before any filling). Best rows first, so a group you never touch sinks. "Happening this week" stays in front, because it is about time. Group rows and the extra rows are woven together as before. |
| Cards | Best first, then each next card loses 0.2 times its similarity to the cards already placed (so a row is not all near copies). |
| Billboard | Corners with events this week first, then your best fits (otherwise the week's rotation). |
| Cold start | No signal (a new person, signed out, or the function not applied yet): the default order, unchanged. |
| Exploration | The daily shuffle, seeded by you and the date, so it is steady within a day and moves a little tomorrow. |

## Privacy

* The function is `security definer` and takes no arguments: it reads **your**
  rows by `auth.uid()` and, for other people, only **public** Moments in
  aggregate. Private Moments (`just_me`, `followers`, `space`) of anyone else are never read.
* Output never names or points at another person. People-like-you and trending
  are dropped unless 2 or more people contribute.
* Anonymous callers have no execute right.
* The page caches your last scores in this browser for 6 hours so it opens in
  your order. Nothing is stored in the database.

## Verification

`supabase/verification/corner_affinity_check.sql` (14 checks): a recent public
Moment, your private Moment, decay, likes, people like you, a single poster
hidden, an untouched Corner absent, a Space-level row, another person never
seeing your private Corner, trending without personal activity, anonymous
refused, security definer with a pinned search_path.

## What it cannot do yet

* There is no negative signal ("not interested", skipping a row). Adding one
  needs a control in the UI and a place to store it.
* It does not read searches or time spent on a Corner page.
* With few people on Soosh, "people like you" and "trending" are mostly empty
  and the similarity score does most of the work. They fill in as people post.
* The weights are set by hand. When there is enough activity, tune them against
  what people actually open from the page.
* Every request recomputes from the posts table. Fine at this size; at scale,
  compute the scores on a schedule and store them.

## Home v2: what to do this week (Oct 30, 2026)

`public.home_suggestions(p_limit)` (migration `20261030172959`) ranks events in
open Spaces and open Pursuits with room, for the signed-in caller, over the next
7 days. It reads only the caller's own private answers (`profile_private`:
picks, free windows, area and city, monthly budget; `user_passes`) and never
returns a price, a count of people or another person's data. Followed friends
who are going count toward the score, but a friend is named (first name only,
and the `friend_going` reason) only where the caller could already see that
person's place: an active member of the event's Space (the `event_rsvps` read
rule), or a joined member of the Pursuit. Otherwise the next reason is used.

| Signal | Weight | How |
|---|---|---|
| window | 0.22 | Start time falls in one of the caller's free windows (Daytime 06:00 to 17:59, Evening from 18:00, New York time). No windows saved: 0.5, not 0 |
| picked | 0.20 | The Corner is one of the caller's picks |
| affinity | 0.08 | `my_corner_affinity()` for the Corner (0 to 1) |
| friends | 0.16 | People the caller follows who are going or in it, 2 or more count as full |
| nearby | 0.12 | Same area 1.0, same city 0.6, elsewhere 0, online 0.3, nothing saved 0.3 |
| trending | 0.06 | New RSVPs and joins in the last 48 hours against that Corner's usual rate over 28 days, damped |
| budget | 0.04 | A budget of 0 lifts listings with no price or a price that reads as free |
| pass | 0.06 | One of the caller's passes covers the Corner (map in `home_ranking_v1`: climbing, cycling, fitness to strength training, yoga and running, museum to drawing and life drawing, library to reading, book clubs, drawing and life drawing) |
| soon | 0.06 | Fades from 1 to 0 over the next 48 hours |

All of them, the caps and the pass-to-Corner map live in one row,
`app_config` key `home_ranking_v1`. After scoring, the top 4 are 4 different
Corners, and a daily jitter (up to 0.03, seeded by caller and date) keeps the
order steady within a day. The reasons returned are the 2 largest contributions
among `fits_window`, `picked`, `affinity`, `friend_going`, `nearby`,
`trending`, `pass`, `soon`.

What is shown and done is logged in `suggestion_events` through
`log_suggestion_event()` (owner-only read, no direct insert), so the weights can
be tuned against what people open and join. Rows are kept 90 days:
`purge_suggestion_events()` runs nightly at 03:45 UTC from pg_cron (job
`purge-suggestion-events`). The app calls the logger only while
`suggestionLoggingEnabled` in `src/app/config.ts` is on, which it is because the
Privacy Policy now says: "We keep a short record of the suggestions we show you
on Home and which ones you open or join, for 90 days." The app has no data export yet; when it
gets one, it must include `suggestion_events` (the owner can already read their
own rows). Verification:
`supabase/verification/home_suggestions_check.sql`.
