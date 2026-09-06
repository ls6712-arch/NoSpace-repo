import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { Hobby } from "../data/hobbies";

/**
 * Hover is a single coordinated gesture: the room lifts, the photograph pushes
 * in behind it, and the title and arrow lean toward the room it opens.
 */
export function HobbyCategoryCard({ hobby }: { hobby: Hobby }) {
  return (
    <Link
      to={`/space/${hobby.slug}`}
      className="group block outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral-deep)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
    >
      <div className="ns-room-card relative aspect-[4/5] overflow-hidden border border-border">
        <img
          src={hobby.coverImage}
          alt=""
          className="h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.06] group-focus-visible:scale-[1.06]"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${hobby.gradient} opacity-20 mix-blend-multiply`} />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--forest-ink)] via-[var(--forest-ink)]/20 to-transparent" />
        <div className="ns-room-card-index">OPEN ROOM</div>
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
  );
}
