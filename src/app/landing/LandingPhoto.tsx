import { useState } from "react";
import { SubHobbyArt } from "../components/SubHobbyArt";
import { LANDING_COPY } from "./copy";
import { PHOTOS, localSrc, localSrcSet, photoSrc, photoSrcSet, type PhotoKey } from "./photos";

/**
 * Fills its parent (which sets the shape). A photo gets one shared soft, warm
 * look from CSS (.lp-photo-real); an illustration is shown as it is. If a photo
 * does not load, the illustration for the same thing takes its place.
 */
export function LandingPhoto({
  image,
  widths,
  sizes,
  eager = false,
  className = "",
}: {
  image: PhotoKey;
  widths: number[];
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const spec = PHOTOS[image];
  const [failed, setFailed] = useState(false);
  const showPhoto = !!(spec.photo || spec.local) && !failed;
  const alt = (LANDING_COPY.photoAlt as Partial<Record<PhotoKey, string>>)[image];

  if (showPhoto) {
    return (
      <span className={`lp-photo lp-photo-real ${className}`}>
        {/* design-token-ignore: plain img with srcSet; its own onError swaps in the illustration, the fixed-size box is set by the parent */}
        <img
          src={spec.local ? localSrc(spec.local, widths[0]) : photoSrc(spec.photo!, widths[0])}
          srcSet={spec.local ? localSrcSet(spec.local, widths) : photoSrcSet(spec.photo!, widths)}
          sizes={sizes}
          alt={alt ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className={`lp-photo lp-photo-art ${className}`} aria-hidden="true">
      {spec.art && <SubHobbyArt hobbySlug={spec.art.hobby} subSlug={spec.art.sub} />}
    </span>
  );
}
