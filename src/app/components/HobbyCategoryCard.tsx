import { Link } from "react-router";
import { ArrowUpRight, Users } from "lucide-react";
import { Hobby } from "../data/hobbies";
import { GeneratedArt } from "./GeneratedArt";

export function HobbyCategoryCard({ hobby }: { hobby: Hobby }) {
  return (
    <Link to={`/space/${hobby.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-white/10">
        <GeneratedArt
          hobbySlug={hobby.slug}
          seed={hobby.slug}
          className="h-full w-full transition-transform duration-500 group-hover:scale-110"
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t ${hobby.gradient} opacity-60 mix-blend-multiply`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur-md">
          <Users className="size-3" />
          <span className="font-hud">{hobby.creatorCount}</span> creators
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h3 className="text-white text-xl mb-1">{hobby.shortName}</h3>
              <p className="text-white/70 text-sm line-clamp-2">{hobby.tagline}</p>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 backdrop-blur-md transition-transform group-hover:translate-x-1 group-hover:-translate-y-1">
              <ArrowUpRight className="size-4 text-white" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
