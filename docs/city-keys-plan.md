# Plan: a fixed list of city keys (for PR 4)

**Status: plan, decisions made by the founder on Nov 6, 2026. Nothing is built (it is PR 4).** All five NYC boroughs map to one
key, `new-york-ny`; the neighborhood stays in `area`; all nine other listed cities are included; a neighborhood alone implies
`new-york-ny` only from a fixed list that leaves out names shared with other places.

## Why

Top 10 in {city}, Never been done in {city} and the Founding Stub count Moments by city. Today
`post_private.city_key` (PR #342) is the lower-cased free text of the city, so "Brooklyn", "brooklyn, ny" and
"New York" are three different cities and no count means much. A fixed list turns free text into one key or into nothing.

## The key

- Format: `{city-slug}-{state}`, lower case, hyphens: `new-york-ny`, `rockdale-tx`. It is the same shape as the slug the
  Ticketmaster import already uses for a venue's city (brief section 5.2), so one key space covers people, towns and events. (Event imports were cancelled on Nov 7, 2026; the key format is unchanged and still covers people, towns and Soosh's own events.)
- The key never contains a neighborhood. Neighborhoods stay in `area` (standing slots, events) and `posts.neighborhood`.

## The list (one source, two places)

- Source: `data/city_keys.csv` (`key`, `name`, `state_code`, `lat`, `lng`, `aliases`), edited by the founder like the Corner catalog.
- A script writes `src/app/data/cityKeys.ts` (do-not-edit header) and a seed migration for two tables:
  - `public.city_keys (key primary key, name, state_code, lat, lng, active)`, read by signed-in members.
  - `public.city_key_aliases (alias text primary key, key references city_keys)`: the normalized spellings.
- Normalizing an alias or a person's text: lower case, accents and punctuation removed, spaces collapsed, a trailing
  state ("ny", "new york") and "usa" removed. **Exact match only. No fuzzy matching**: the list is fixed, so "Newark" never becomes New York.

### Starting entries (approved: every city the app suggests today)

Keys use the US state or Canadian province code, and the ISO country code everywhere else.

| Key | Name | Aliases (after normalizing) |
|---|---|---|
| `new-york-ny` | New York | new york, new york city, nyc, ny, manhattan, brooklyn, queens, bronx, the bronx, staten island, and each of those with ", ny" |
| `san-francisco-ca` | San Francisco | san francisco, sf, san fran |
| `los-angeles-ca` | Los Angeles | los angeles, la |
| `london-gb` | London | london, london uk, london england |
| `bangalore-in` | Bangalore | bangalore, bengaluru |
| `mumbai-in` | Mumbai | mumbai, bombay |
| `delhi-in` | Delhi | delhi, new delhi |
| `chennai-in` | Chennai | chennai, madras |
| `hyderabad-in` | Hyderabad | hyderabad |
| `pune-in` | Pune | pune, poona |

More are added by the founder when there is a reason to (a pilot town, a launch city). The towns table in PR 3 uses the
same key as its `slug`, so a pilot town and a person living there land on the same key.

**Short aliases are the riskiest part.** "la", "sf" and "ny" are only matched when they are the *whole* text, never inside a
longer one, and "la" is not matched with a state ("la, la" is Louisiana). Easy to extend, hard to make safe, which is why
there is no fuzzy matching.

### Neighborhoods that imply `new-york-ny` (fixed list)

Only when the profile has no city. Only these names, matched exactly after normalizing. The 47 names in
`src/app/data/nycNeighborhoods.ts` were each checked for another well-known place of the same name; **25 are left out**.

**Imply New York (22):** Alphabet City, East Harlem, Greenwich Village, Hell’s Kitchen, Lower East Side, Upper East Side,
Upper West Side, Washington Heights, Bay Ridge, Bed-Stuy, Boerum Hill, Bushwick, Carroll Gardens, Crown Heights, Downtown
Brooklyn, DUMBO, Fort Greene, Greenpoint, Park Slope, Jackson Heights, Long Island City, Mott Haven.

**Left out because the name is shared (25):** Chelsea (Boston, London), Chinatown (many cities), East Village (San Diego, Des
Moines), West Village, Financial District (San Francisco, Boston), Flatiron, Gramercy (Louisiana), Harlem (Georgia, Montana),
Inwood, Midtown (Atlanta, Memphis), Murray Hill (New Jersey), SoHo (London), Clinton Hill (Newark), Prospect Heights
(Illinois), Red Hook (a town in New York State), Sunset Park, Williamsburg (Virginia), Astoria (Oregon), Flushing (Michigan),
Forest Hills (many), Ridgewood (New Jersey), Sunnyside (Washington, Chicago), Fordham, Riverdale (Chicago, Georgia, Maryland),
St. George (Utah).

These are my judgement calls; move any name between the lists and I'll regenerate. A person who lives in Williamsburg and sets
no city simply gets no key until they add a city, which is the safe failure.

## Rules

1. A Moment's city text is the city it shows, else the author's profile city (as in PR #342). Same privacy rules: Everyone
   audience only, null if the person removed the city.
2. Text is normalized and looked up in `city_key_aliases`. **Found: that key. Not found: no key.** A Moment with no key is
   simply not counted in any city.
3. If a profile has no city but its neighborhood is one of the 22 names above, the key is `new-york-ny`. Any other neighborhood implies nothing.
4. Unmapped text is counted, not stored against a person: `public.unmapped_cities (text_normalized, seen)`, admin read only, so
   you can see "austin: 14" and add Austin to the list. No user id is kept there.
5. The key is never returned to a client: only counts leave the database (Top 10, Never been done).

## Changes PR 4 would make

- `private.city_key_of()` (PR #342) looks the text up instead of lower-casing it.
- A re-key migration rewrites existing `post_private.city_key` values through the list (and `stubs.city_key` for the Founding
  Stub, which is flag-off, so none exist yet).
- **Existing 'new-york' strings.** `city_picks.city` (58 live rows) and `CITY` in `lib/cityPicks.ts` use the older value
  `new-york`; PR 4 migrates them to `new-york-ny`. `standing_slots.city` and `SLOT_CITY` in PR #344 are already changed to
  `new-york-ny` (Nov 6, 2026), so that table never holds the old value.
- `discover_rows(...)` and `discover_rows_public(p_city)` take the key, not text.

## Verification and tests (when built)

- Every borough name and spelling above maps to `new-york-ny` (table-driven test, plus SQL).
- "Newark", "New York State" and an empty string map to nothing.
- "Brooklyn, NY" and "brooklyn" give the same key as "New York".
- Re-key is idempotent; the key is unreadable by any signed-in role; the unmapped table holds no user id.
