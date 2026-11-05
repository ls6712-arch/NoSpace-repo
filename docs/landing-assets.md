# Landing page photography and Motion

The current landing page uses six real photographs supplied by the owner in
`Archive.zip`. They are hosted under `public/landing/photos/`; displayed landing
photos no longer depend on an external image server. The previous pier image and
other older assets remain historical and are not substituted for these uploads.

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
engine (`motion/mini`) with the shared page transition tokens; the device
preference comes from `motion/react`. Photo swaps and the goal-preview content
fade and move slightly, keeping the controls outside the moving content. Cleanup
cancels animation and restores fully visible content on pause, reduced motion,
selection change or unmount. Pointer tilt, touch swiping and tappable Stubby are
preserved. There is no autoplay activity carousel or saved motion preference.

[Current evidence and reproduction](qa/landing-local-photos/README.md) includes
actual browser photo loading, responsive variants, Motion frames and missing-file
recovery. Earlier reports with blocked external photos remain historical.
