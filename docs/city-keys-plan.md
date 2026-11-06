# Plan: a fixed list of city keys (for PR 4)

**Status: plan for founder approval. Nothing is built.** Decided by the founder (Nov 6, 2026): all five NYC boroughs
map to one key, `new-york-ny`; the neighborhood stays in `area`.

## Why

Top 10 in {city}, Never been done in {city} and the Founding Stub count Moments by city. Today
`post_private.city_key` (PR #342) is the lower-cased free text of the city, so "Brooklyn", "brooklyn, ny" and
"New York" are three different cities and no count means much. A fixed list turns free text into one key or into nothing.

## The key

- Format: `{city-slug}-{state}`, lower case, hyphens: `new-york-ny`, `rockdale-tx`. It is the same shape as the slug the
  Ticketmaster import already uses for a venue's city (brief section 5.2), so one key space covers people, towns and events.
- The key never contains a neighborhood. Neighborhoods stay in `area` (standing slots, events) and `posts.neighborhood`.

## The list (one source, two places)

- Source: `data/city_keys.csv` (`key`, `name`, `state_code`, `lat`, `lng`, `aliases`), edited by the founder like the Corner catalog.
- A script writes `src/app/data/cityKeys.ts` (do-not-edit header) and a seed migration for two tables:
  - `public.city_keys (key primary key, name, state_code, lat, lng, active)`, read by signed-in members.
  - `public.city_key_aliases (alias text primary key, key references city_keys)`: the normalized spellings.
- Normalizing an alias or a person's text: lower case, accents and punctuation removed, spaces collapsed, a trailing
  state ("ny", "new york") and "usa" removed. **Exact match only. No fuzzy matching**: the list is fixed, so "Newark" never becomes New York.

### Starting entries (proposed)

| Key | Aliases |
|---|---|
| `new-york-ny` | new york, new york city, nyc, ny, manhattan, brooklyn, queens, bronx, the bronx, staten island, and each of those with ", ny" |

Everything else is added by the founder when there is a reason to (a pilot town, a launch city). The towns table in PR 3
uses the same key as its `slug`, so a pilot town and a person living there land on the same key.

**Decision for you:** the app's city suggestions today also offer Bangalore, Mumbai, Delhi, Chennai, Hyderabad, Pune,
London, San Francisco and Los Angeles. The key format ends in a US state. For those I would use a country code
(`london-gb`, `bangalore-in`) and add only the ones you want counted. Until you list them they get no key (below).

## Rules

1. A Moment's city text is the city it shows, else the author's profile city (as in PR #342). Same privacy rules: Everyone
   audience only, null if the person removed the city.
2. Text is normalized and looked up in `city_key_aliases`. **Found: that key. Not found: no key.** A Moment with no key is
   simply not counted in any city.
3. If a profile has no city but a neighborhood from the New York list (`NYC_NEIGHBORHOODS`), the key is `new-york-ny`.
   Only those neighborhoods imply a city; **decision for you**, say if you'd rather not infer.
4. Unmapped text is counted, not stored against a person: `public.unmapped_cities (text_normalized, seen)`, admin read only, so
   you can see "austin: 14" and add Austin to the list. No user id is kept there.
5. The key is never returned to a client: only counts leave the database (Top 10, Never been done).

## Changes PR 4 would make

- `private.city_key_of()` (PR #342) looks the text up instead of lower-casing it.
- A re-key migration rewrites existing `post_private.city_key` values through the list (and `stubs.city_key` for the Founding
  Stub, which is flag-off, so none exist yet).
- **Existing 'new-york' strings.** `city_picks.city`, `standing_slots.city` (PR #344) and `SLOT_CITY` / `CITY` in code use the
  older value `new-york`. They should become `new-york-ny`. For `standing_slots`, which is unmerged and empty, I'd change the
  column default and constant in PR #344 now (a one-line change plus a re-run of its verification) rather than migrate later.
  `city_picks` has live rows, so PR 4 migrates it. **Say if you want me to make the PR #344 change.**
- `discover_rows(...)` and `discover_rows_public(p_city)` take the key, not text.

## Verification and tests (when built)

- Every borough name and spelling above maps to `new-york-ny` (table-driven test, plus SQL).
- "Newark", "New York State" and an empty string map to nothing.
- "Brooklyn, NY" and "brooklyn" give the same key as "New York".
- Re-key is idempotent; the key is unreadable by any signed-in role; the unmapped table holds no user id.
