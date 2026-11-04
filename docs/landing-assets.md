# Landing page assets

The interactive landing page combines real activity photography with the app's
Stubby and small animated SVG activity graphics. It does not show example members
or depend on the older screenshot assets to render a section.

`src/app/landing/ActivityPhoto.tsx` reuses `data/hobbyPhotos.ts` for drawing,
guitar, cooking, reading and birdwatching. The photo-walk example uses the existing
local pier photograph by Richard Fox (`public/landing/photos/shelf-pier-*`), with
its recorded Unsplash source. Other old screenshot assets remain historical.

Photographs use `ImageWithFallback`: the hero loads eagerly, gallery photographs
load lazily, and fixed aspect ratios prevent layout shifts. If a request fails,
the corresponding local activity illustration is shown. Recorded credits appear
under the hero photograph. Old library entries without a photographer credit use
the Unsplash license link, without inventing a name.

The animated badge, pointer tilt, photo transitions and tappable Stubby are
presentation only. The motion control pauses them locally; the device's reduced
motion preference always wins. Touch swiping has native button equivalents and
does not prevent vertical scrolling. There is no automatic activity carousel.

The cloud environment blocks `images.unsplash.com`. Browser tests verify the
actual local photograph and intentional remote-image failure paths. Loading and
visual review of the external library photographs remain a preview release check;
the tests do not substitute an unrelated photo and call it a successful download.

Social previews use the existing 512 px app icon with an accurate image description.
Page metadata, the crawler fallback and FAQ structured data use the new landing
copy. `src/indexHtml.test.ts` checks that they stay in sync.
