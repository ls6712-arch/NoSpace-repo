# Landing page assets

The interactive landing page uses the app's Stubby and local SVG illustrations
in `src/app/landing/ActivityArt.tsx`. It does not fetch photos, show example members
or depend on the older screenshot assets to render a section.

Older files under `public/landing/` and their capture tooling remain available for
historical previews. Their existing attribution records remain with those assets;
none of their photographs is displayed by the current landing page.

Social previews use the existing 512 px app icon with an accurate image description.
Page metadata, the crawler fallback and FAQ structured data use the new landing
copy. `src/indexHtml.test.ts` checks that they stay in sync.
