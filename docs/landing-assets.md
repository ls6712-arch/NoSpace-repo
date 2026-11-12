# Landing page photography and Motion

The current landing page uses six real photographs supplied by the owner in
`Archive.zip`. They are hosted under `public/landing/photos/`; displayed landing
photos no longer depend on an external image server. The Photography card uses
the existing locally hosted sunset pier photo by
Richard Fox (https://unsplash.com/photos/Uujb21HwpBw), so it differs from the
hero photograph. The solo/shared section uses the reading and cooking uploads
with responsive size hints appropriate to their larger display widths.

| Activity | Original upload | Credit from filename | Source |
| --- | --- | --- | --- |
| Painting | sincerely-media-s3tPywNsLSo-unsplash.jpg | Sincerely Media | https://unsplash.com/photos/s3tPywNsLSo |
| Guitar | parker-coffman-GgsG8aNLgjQ-unsplash.jpg | Parker Coffman | https://unsplash.com/photos/GgsG8aNLgjQ |
| Photography | alex-gorin-31KvOn6d818-unsplash.jpg | Alex Gorin | https://unsplash.com/photos/31KvOn6d818 |
| Cooking together | maarten-van-den-heuvel-EzH46XCDQRY-unsplash.jpg | Maarten van den Heuvel | https://unsplash.com/photos/EzH46XCDQRY |
| Reading at home | sergei-nikulin-tglfT2WsX8E-unsplash.jpg | Sergei Nikulin | https://unsplash.com/photos/tglfT2WsX8E |
| Reading outside | paniz-gm-XGZ72Knysyg-unsplash.jpg | Paniz GM | https://unsplash.com/photos/XGZ72Knysyg |

Credits and source ids are recorded from the uploaded filenames, not a new
external search or independently fetched source page. The photos were visually
inspected. They illustrate activities, not example members or bookable venues.
The watercolor photograph is used for Painting, not Drawing. Both reading photos
are used in their matching settings. The all-interests gallery lists each Corner
once; the outside filter can show the outdoor reading alternative.

`public/landing/photos/uploaded-photos.json` records original hashes, dimensions,
source/license URLs, crop rectangles and output sizes. The original archive is
retained outside the repository; only optimized assets ship. Rebuild from an
extracted copy with:

```sh
node scripts/landing-photos.mjs /path/to/originals
```

The 18 WebP variants total 1,610,190 bytes. Each photo has 400, 800 and 1600 px
versions. Subject-preserving crops are 16:10; the hero displays them at 16:9.
Sharp strips embedded EXIF from the exports. Responsive `srcSet` and `sizes`
select an appropriate file; the hero loads eagerly and gallery images lazily.
A failed responsive candidate retries the source without `srcSet` before using
its local activity graphic. A photographer credit appears only after a photo
successfully loads. Old example ids remain valid for existing request drafts,
without making them fetch unrelated or external photographs.

Motion is already a dependency. `useLandingTransition` uses its native animation
engine (`motion/mini`) with the shared page transition tokens. A media-query
subscription follows device preference changes during the visit; Motion’s
current reduced-motion hook only snapshots the initial setting. Photo swaps and the goal-preview content
fade and move slightly, keeping the controls outside the moving content. Cleanup
cancels animation and restores fully visible content on reduced motion,
selection change or unmount. Pointer tilt and touch swiping remain optional
shortcuts to native controls. The logo is static. The streamlined hero has one
“Another example” control, with no ongoing loop or pause control. There is no
autoplay activity carousel or saved motion preference.

[Current evidence and reproduction](qa/landing-streamlined/README.md) includes
actual browser photo loading, responsive variants, Motion frames and missing-file
recovery. Earlier reports with blocked external photos remain historical.
