# Landing page screenshots

The landing page ships without screenshots until real ones exist. Dropping a
file in is the whole change: no code edit.

| Slot | File to replace or add | Size | Notes |
|---|---|---|---|
| Hero (a full Shelf with range: bread, a GitHub project, a race, film photos) | `src/assets/hero-soosh.webp` | 1942 x 809 px | Replace the file. Also replace the small copy at `src/assets/hero-soosh-1000.webp` (1000 x 417 px). Update the `alt` text on the hero image in `src/app/pages/Home.tsx`. |
| Pursuit on a Shelf (landing section 4) | `src/assets/landing-pursuit.webp` | 780 x 1688 px (a 390 x 844 phone screenshot at 2x) | Add the file. The section shows it automatically. Nothing renders while the file is missing. |

Use real accounts and real Moments. Export as WebP under 300 KB.
