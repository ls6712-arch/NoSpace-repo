import { Link } from "react-router";
import { ArrowUpRight, Users } from "lucide-react";
import { Hobby } from "../data/hobbies";
import { GeneratedArt } from "./GeneratedArt";

/**
 * Hover is a single coordinated gesture rather than four unrelated effects:
 * the card lifts, the illustration pushes in behind it, the tagline and the
 * creator chip step up, and the arrow leans toward where it's taking you.
 * Everything lands inside 300ms — long enough to read as intentional, short
 * enough that a fast scan across eight cards never feels sticky. Keyboard
 * focus gets the same treatment via focus-visible on the link.
 */
export function HobbyCategoryCard({ hobby }: { hobby: Hobby }) {
  return (
    <Link
      to={`/space/${hobby.slug}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border transition-[transform,box-shadow] duration-[280ms] ease-out group-hover:-translate-y-1.5 group-hover:shadow-[0_18px_38px_-18px_rgba(11,62,46,0.55)] group-focus-visible:-translate-y-1.5">
        <GeneratedArt
          hobbySlug={hobby.slug}
          seed={hobby.slug}
          className="h-full w-full transition-transform duration-[280ms] ease-out group-hover:scale-[1.07] group-focus-visible:scale-[1.07]"
        />
        {/* A tint, not a blackout: the artwork underneath is the point, so the
            gradient sits at a quarter strength and the legibility scrim is
            confined to the bottom third where the label actually is. */}
        <div className={`absolute inset-0 bg-gradient-to-t ${hobby.gradient} opacity-25 mix-blend-multiply`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest-ink)] from-0% via-[var(--forest-ink)]/25 via-42% to-transparent to-70%" />

        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-[var(--forest-ink)]/55 px-2.5 py-1 text-[10px] text-white/85 backdrop-blur-md transition-transform duration-[280ms] ease-out group-hover:-translate-y-0.5">
          <Users className="size-3" />
          <span className="font-hud">{hobby.creatorCount}</span> creators
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-2">
            <div className="transition-transform duration-[280ms] ease-out group-hover:-translate-y-1 group-focus-visible:-translate-y-1">
              <h3 className="text-white text-xl mb-1">{hobby.shortName}</h3>
              <p className="text-white/75 text-sm line-clamp-2">{hobby.tagline}</p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--cream)] text-[var(--forest)] transition-[transform,background-color,color] duration-[280ms] ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:bg-[var(--coral-deep)] group-hover:text-white group-focus-visible:translate-x-1 group-focus-visible:-translate-y-1">
              <ArrowUpRight className="size-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
