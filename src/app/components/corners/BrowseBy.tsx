import { HorizontalRow } from "../HorizontalRow";
import { ImageWithFallback } from "../ImageWithFallback";
import { PressLink } from "../afterhours/PressLink";
import { CORNER_CATEGORIES } from "../../data/cornerCategories";
import { categoryStyle } from "../../lib/categoryStyle";
import { categoryPhotoCorner } from "../../lib/categoryPhoto";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { SECTION_GAP } from "../../lib/pageGrid";

/**
 * "Browse by": the 18 groups of Corners as photo tiles in a row, each opening
 * its page (/browse/:slug). A tile's photo is its first curated Corner's, and
 * no two tiles share a picture (categoryPhoto.ts). Used on /corners and on
 * Discover, the same row in both places.
 */
export function BrowseBy() {
  return (
    <section className={SECTION_GAP} aria-labelledby="browse-by-title">
      <h2 id="browse-by-title" className="mb-3 text-lead font-semibold md:text-title">
        Browse by
      </h2>
      <HorizontalRow name="corners.browseBy" label="Browse by">
        {CORNER_CATEGORIES.map((cat) => {
          const c = categoryPhotoCorner(cat.slug);
          return (
            <li key={cat.slug} className="w-40 shrink-0 snap-start md:w-52" style={categoryStyle(cat.slug)}>
              <PressLink
                to={`/browse/${cat.slug}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-card bg-[var(--cat)] text-on-media shadow-card transition-shadow duration-base hover:z-10 hover:shadow-glow focus-visible:shadow-glow"
              >
                {c && (
                  <ImageWithFallback
                    src={cornerPhoto(c.spaceSlug, c.slug, 400)}
                    alt={cornerPhotoAlt(c.slug)}
                    width={208}
                    tint
                    className="absolute inset-0 size-full"
                  />
                )}
                <span className="bg-scrim pointer-events-none absolute inset-0" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 p-3">
                  <span className="line-clamp-2 block text-body font-semibold">{cat.name}</span>
                </span>
              </PressLink>
            </li>
          );
        })}
      </HorizontalRow>
    </section>
  );
}
