# Soosh content batch 1

30 original editorial activity drafts and 10 generic Pursuit templates, across
10 existing Corners. Created Nov 5, 2026. This is a review pack, not a live import.

## Files

- `content.md`: readable copy, including steps, requirements and shared versions.
- `content.csv`: 40 rows for review in a spreadsheet.
- `content.json`: detailed structured draft with stable IDs and linked activities.
- `validation.json`: counts and catalog/reference checks.

## Why this batch

The repository contains 149 built-in guide entries, 130 eligible for general
browsing after current hidden/merged/age flags, 143 single-idea entries and 55
fuller curated entries. These are code counts, not a live count of all Corners.
Most built-in Corners have one short idea. This batch adds depth within familiar
interests, with solo and shared options, rather than adding more empty topics.

Each activity has a concrete outcome, 3 steps, an estimated time range, setting,
required items, optional extras, alternative setups where relevant and a shared
version. Costs remain unknown rather than being labelled free. Timings include
setup and exclude shopping and travel. No local venue or event is invented.

Each Pursuit has a finish line and 3 milestones. Its starter activities are
linked by ID. There is no required deadline or claim about guaranteed progress.

## Batch overview

| Corner | Activities | Pursuit |
| --- | --- | --- |
| Drawing | Draw what is in your pocket; Draw a room with one continuous line; Make a tiny texture collection | Make a small drawing collection |
| Painting | Mix a page of colors; Paint a leaf with two colors; Paint a postcard-sized view | Make a set of small paintings |
| Reading | Read the opening of a book you already own; Read a short story in one sitting; Read the same passage in two ways | Finish a book you keep meaning to read |
| Writing | Write a scene around a lost object; Write a conversation without explanations; Rewrite one scene from another viewpoint | Finish a short story |
| Photography | Photograph five shades of one color; Make an ordinary object look unfamiliar; Photograph light in one small space | Make a photo set about one ordinary thing |
| Cooking | Make a chickpea salad from what you have; Cook a small pot of tomato beans; Roast a tray of vegetables you will actually eat | Build a small recipe collection |
| Guitar | Make a two-note guitar pattern; Practice one chord change slowly; Try a simple strumming pattern | Play one song from start to finish |
| Gardening | Check the care needs of one plant; Sow a small pot of herbs; Make useful labels for your plants | Care for one plant and keep a simple record |
| Chess | Explore how a knight moves; Play chess without a clock; Replay the opening of a game | Play a game and explain three choices |
| City walks | Notice five details on a familiar route; Take a short walk with no errands; Make a tiny guide to one block | Make a small guide to a route you enjoy |

## Editorial checks before publication

The copy is drafted, not independently verified. Complete any missing practical
references, especially plant care, guitar guides and the tested vegetable
roasting guide. Choose owned or properly licensed images that match each actual
activity. Do not present this editorial content as member Moments, reviews,
confirmed events or personal progress.

User goals and preferences remain separate from these public generic templates.
Trying an activity, sharing a Moment or creating a personal Pursuit are user
choices. No member accounts, goals, invitations or events were created.

## App integration

The current `CORNER_IDEAS` object holds one idea per Corner. Do not overwrite
those entries to fit this batch. A later implementation should support several
activity records per Corner and connect their duration, setting and resource
facts to actual recommendation filters and ranking. The draft format is not
yet an approved database schema or a production import script.

Validation checks canonical browsable Corner keys, all 40 unique IDs, time
ranges, complete alternative setups, 3 steps per activity, 3 linked activities
per Pursuit and no exact existing idea-title duplicates. It does not certify
external facts, safety, venue access, prices, image rights or recommendation
quality in a deployed app.


## Included images

Six real Corner covers are linked from the existing `public/landing/photos`
assets for Painting, Reading, Photography, Cooking, Guitar and City walks.
The pack uses existing 400/800 px variants and 1600 px where available; it
does not duplicate images or upscale them. `image-gallery.html` provides a
local review after checking out this repository, and `image-manifest.json`
records credits, source pages, variants and hashes.

These are illustrative Corner covers. They are not step photographs for every
activity or evidence of a member’s progress. Five are from the supplied archive;
the City walks cover uses the existing Richard Fox pier image. Source records
are preserved and have not been independently reverified on the web.

Drawing, Writing, Gardening and Chess still need suitable downloaded covers.
Their existing app photo references are in `pending-image-sources.json` and
`image-source-list.csv`. A reference is not a downloaded or verified asset.
The current network proxy returned 403 for the photo host.

## Review and validation

Run from the repository root:

```sh
node scripts/check-content-batch.mjs
```

This verifies catalog membership, draft status, unique IDs, duration ranges,
Pursuit activity references and all linked local-image hashes. It does not
certify source-page licenses, external facts or readiness for live import.
This PR adds editorial review material only; no application page, recommendation
retrieval, account, data table, live event or production flag changes.
