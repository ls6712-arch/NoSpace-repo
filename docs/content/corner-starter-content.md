# Visible Corner starter content

The starter library now renders in the application. Previously, the activity and Pursuit batch and the specialist website directory were review files only. Merging those files did not add sections to a page.

## Where to find it

Open a Corner from Discover or `/corners`, then scroll below its introduction:

- **Things to try:** three expandable activities, with steps, estimated duration, required supplies, optional supplies, alternatives and a shared version. Cost remains unknown.
- **Pursuit ideas:** one editable checklist template. **Start a Pursuit** opens the existing creation form. Browsing or opening the form creates nothing.
- **Resources:** relevant specialist websites with original descriptions and outbound links. A Corner with no matching resources has no Resources section.

The first batch covers Drawing, Painting, Reading, Writing, Photography, Cooking, Guitar, Gardening, Chess and City walks. There are 30 activities, 10 Pursuit templates and 16 distinct websites. Cooking and Chess currently have activities and a Pursuit idea but no website entries. Other Corners keep their existing content.

Examples after release: `/#/corners/drawing`, `/#/corners/reading`, `/#/corners/painting`, and `/#/corners/guitar`. These are Corner sections, not new Discover tabs or personal Pursuits automatically added to accounts.

## Data and behavior

`src/app/data/starterContent.json` contains public editorial content. `starterContentFor` resolves canonical Corner aliases, filters the relevant entries and allows only credential-free HTTPS resource URLs. No profile, preference or member progress is read to select this batch.

`CornerStarterContent` renders inside `CornerDetail`, before the existing live rows. Existing events, Spaces, people and Moments retain their existing queries and access checks. Discover, Search, recommendations and navigation are unchanged.

A Pursuit link passes an allowlisted template ID to the existing `/pursuits/new` form. The form copies its title and full milestone instructions into editable checklist items with fresh UUIDs. It keeps the canonical Corner and uses the current owner's identity. Nothing copies completion, a member, an invitation, a deadline or sample progress. The existing creation action, validation, private defaults and retry handling remain responsible for saving. More options retains the edited title and Corner when opening the existing legacy builder; that builder retains its own goal controls.

Restricted visitors use the existing signup redirect, carrying the template ID. Completing live OAuth and account approval remains a release check; the local browser test verifies the handoff URL.

## Images and website rights

The six supplied local cover sets are used for Painting, Reading, Photography, Cooking, Guitar and City walks. They are illustrative Corner photos, not evidence of an activity's result. Local responsive variants, alt text and supplied credits are retained. The other four use the existing Corner photo lookup and its existing fallback. This change downloads no new external photos.

Resource cards contain website names, original short descriptions and visit links only. They copy no source images, logos, articles or extracts, and embed no third-party pages. The owner's request to make these resources visible authorizes this link-only implementation. It does not grant rights to republish material from the linked sites. Current availability and source terms were not verified from this environment; historical review records keep their original verification status.

## Provenance and maintenance

The activity/Pursuit source is `docs/content/starter-batch-01/content.json` on commit `95b6a7e` of `content/starter-library-batch-01`. The website source is `docs/content/website-directory/websites.json` on main. The runtime catalog selects display fields from those review records and adds no live venues, events, endorsements or member activity.

To extend the batch, add editorial entries using canonical Corner keys in the runtime JSON, keep IDs unique and retain the distinction between required, optional and alternative supplies. Costs need actual evidence before being described as free. Check descriptions, destination URLs and image rights before adding new sources. Add a corresponding regression case and run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run e2e:corner-starters`.

No database migration or seed is required. Roll back the implementation commit and redeploy the preceding application build to remove the sections. Pursuits deliberately created by members remain normal member-owned records and must not be deleted as part of rollback.
