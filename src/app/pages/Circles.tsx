import { Link } from "react-router";
import { Users, MapPin } from "lucide-react";
import { circles } from "../data/circles";
import { getHobby } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { Button } from "../components/ui/button";

/**
 * Every circle in one place. Circles previously existed only as a tab inside a
 * space, which meant there was no way to browse them — this is the destination
 * the "Circles" nav item points at.
 *
 * Grouped by space, with the geographic ones marked, because "is there one
 * near me" is the question people actually arrive with.
 */
const TINTS = [
  "var(--pastel-sage)",
  "var(--pastel-stone)",
  "var(--pastel-clay)",
  "var(--pastel-sky)",
  "var(--pastel-wheat)",
  "var(--pastel-rose)",
];

export function Circles() {
  const { isCircleJoined, joinCircle, leaveCircle } = useContent();

  const bySpace = new Map<string, typeof circles>();
  for (const circle of circles) {
    const list = bySpace.get(circle.hobbySlug) ?? [];
    list.push(circle);
    bySpace.set(circle.hobbySlug, list);
  }

  return (
    <div className="min-h-screen bg-surface py-10">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl mb-3" style={{ fontFamily: "var(--font-serif)" }}>
          Circles
        </h1>
        <p className="text-muted-foreground text-lg mb-10 max-w-xl">
          Hobby communities and local groups. Join a global one for the craft, or a
          city one for the people.
        </p>

        {[...bySpace.entries()].map(([hobbySlug, list], groupIndex) => {
          const hobby = getHobby(hobbySlug);
          return (
            <div key={hobbySlug} className="mb-10">
              <div className="mb-3 flex items-end justify-between gap-4">
                <h2 className="text-xl" style={{ fontFamily: "var(--font-serif)" }}>
                  {hobby?.name ?? hobbySlug}
                </h2>
                <Link
                  to={`/space/${hobbySlug}`}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Open space →
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {list.map((circle, i) => {
                  const joined = isCircleJoined(circle.id);
                  const tint = TINTS[(groupIndex + i) % TINTS.length];
                  return (
                    <div
                      key={circle.id}
                      className="rounded-2xl px-4 py-4"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${tint} 12%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${tint} 25%, transparent)`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                            {circle.name}
                          </div>
                          {circle.location && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MapPin className="size-3" strokeWidth={1.8} />
                              {circle.location}
                            </div>
                          )}
                        </div>
                        <Button
                          variant={joined ? "outline" : "coral"}
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            joined ? leaveCircle(circle.id) : joinCircle(circle.id)
                          }
                        >
                          {joined ? "Joined" : "Join"}
                        </Button>
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {circle.description}
                      </p>
                      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Users className="size-3" strokeWidth={1.8} />
                        {circle.memberCount.toLocaleString()} members
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
