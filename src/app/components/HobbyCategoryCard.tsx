import { Link } from "react-router";
import { useState } from "react";
import { ArrowUpRight, Plus } from "lucide-react";
import { Hobby } from "../data/hobbies";
import { spacePhoto } from "../data/hobbyPhotos";
import { GeneratedArt } from "./GeneratedArt";
import { useCorners, isDiscoverable } from "../context/CornersContext";

/**
 * Hover is a single coordinated gesture: the space lifts, the artwork pushes
 * in behind it, and the title and arrow lean toward the space it opens.
 *
 * `showCorners` adds a row of the Space's real Corners as chips below the
 * card, ranked by actual Moment count, plus a Create a Corner action. Off
 * by default: it's a landing-page ask, not something every card everywhere
 * needs to carry.
 */
export function HobbyCategoryCard({
  hobby,
  showCorners = false,
}: {
  hobby: Hobby;
  showCorners?: boolean;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = photoFailed ? undefined : spacePhoto(hobby.slug, 1200);
  const { cornersFor } = useCorners();
  const topCorners = showCorners
    ? cornersFor(hobby.slug).filter(isDiscoverable).slice(0, 3)
    : [];

  return (
    <div>
      <Link
        to={`/space/${hobby.slug}`}
        className="group block outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
      >
        <div className="ns-space-card relative aspect-[4/5] overflow-hidden border border-border">
          {photo ? (
            <img
              src={photo}
              alt=""
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
            />
          ) : (
            <GeneratedArt
              hobbySlug={hobby.slug}
              seed={hobby.slug}
              className="h-full w-full transition-transform duration-[700ms] ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
            />
          )}
          <div className={`absolute inset-0 bg-gradient-to-t ${hobby.gradient} opacity-20 mix-blend-multiply`} />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest-ink)] via-[var(--forest-ink)]/20 to-transparent" />
          <div className="ns-space-card-index">OPEN SPACE</div>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <div className="flex items-end justify-between gap-2">
              <div className="transition-transform duration-300 ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
                <h3 className="mb-1 text-2xl leading-none text-white" style={{ fontFamily: "var(--font-serif)" }}>{hobby.shortName}</h3>
                <p className="text-sm text-white/80">{hobby.tagline}</p>
              </div>
              <ArrowUpRight className="mb-1 size-5 shrink-0 text-white transition-transform duration-300 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-focus-visible:translate-x-1 group-focus-visible:-translate-y-1" />
            </div>
          </div>
        </div>
      </Link>

      {showCorners && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {topCorners.map((corner) => (
            <Link
              key={corner.slug}
              to={`/space/${hobby.slug}?hobby=${corner.slug}`}
              className="rounded-full border border-[var(--hairline)] bg-surface px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/35 hover:text-foreground"
            >
              {corner.name}
              {corner.momentCount > 0 && (
                <span className="ml-1 text-[10px] opacity-60">{corner.momentCount}</span>
              )}
            </Link>
          ))}
          {/* Corners are created by tagging, not suggested for review: this
              points at the one place that's actually true, logging a Moment,
              rather than opening a submission form for something that
              doesn't need approval. */}
          <Link
            to={`/create?hobby=${hobby.slug}`}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--hairline)] px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[var(--foreground)]/35 hover:text-foreground"
          >
            <Plus className="size-3" />
            Create a Corner
          </Link>
        </div>
      )}
    </div>
  );
}
