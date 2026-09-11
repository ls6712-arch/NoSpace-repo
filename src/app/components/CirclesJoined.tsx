import { Link } from "react-router";
import * as Icons from "lucide-react";
import { Circle } from "../data/circles";
import { getHobby } from "../data/hobbies";
import { hobbyIconName } from "../data/hobbyIcons";
import { useContent } from "../context/ContentContext";
import { useConnections } from "../context/ConnectionsContext";
import { useCircles } from "../context/CirclesContext";

/**
 * The Circles you've joined, as soft tinted cards — a name, its icon, and how
 * many people are in it. Member count is context, not a score: it tells you
 * whether a Circle is a room or a stadium, which is the one thing you actually
 * want to know before posting in it.
 */
const TINTS = [
  "var(--pastel-sage)",
  "var(--pastel-stone)",
  "var(--pastel-clay)",
  "var(--pastel-sky)",
  "var(--pastel-wheat)",
  "var(--pastel-rose)",
];

function CircleCard({ circle, tint }: { circle: Circle; tint: string }) {
  const { circleMemberCounts, isCircleJoined } = useContent();
  const { myCircleIds } = useConnections();
  const { isRealCircle } = useCircles();
  const space = getHobby(circle.hobbySlug);
  const Icon = (Icons as any)[hobbyIconName(undefined, circle.hobbySlug)] ?? Icons.Users;
  // A real Circle's own memberCount (CirclesContext) is already the live,
  // accurate count — the seed-circle compound math below doesn't apply to it.
  const displayedMemberCount = isRealCircle(circle.id)
    ? circle.memberCount
    : circle.memberCount +
      (circleMemberCounts[circle.id] ?? 0) +
      (isCircleJoined(circle.id) && !myCircleIds.includes(circle.id) ? 1 : 0);

  return (
    <Link
      to={`/circles/${circle.id}`}
      className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: `color-mix(in srgb, ${tint} 30%, var(--surface-elevated))`,
        border: `1px solid color-mix(in srgb, ${tint} 45%, transparent)`,
      }}
    >
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, ${tint} 55%, var(--surface-elevated))` }}
      >
        <Icon className="size-4 text-foreground" strokeWidth={1.6} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span
          className="block truncate text-sm leading-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {circle.name}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {circle.memberCount.toLocaleString()} members
          {space ? ` · ${space.shortName}` : ""}
        </span>
      </span>
    </Link>
  );
}

export function CirclesJoined({ limit }: { limit?: number } = {}) {
  const { joinedCircleIds } = useContent();
  const { myCircleIds } = useConnections();
  const { getCircle, myRealCircleIds } = useCircles();
  // Local direct joins, real accepted invitations, and a real Circle's own
  // membership are all genuinely "joined" — a Circle you got into any of
  // these ways belongs here too.
  const allJoinedIds = [...new Set([...joinedCircleIds, ...myCircleIds, ...myRealCircleIds])];
  const joined = allJoinedIds.map((id) => getCircle(id)).filter((c): c is Circle => !!c);

  if (joined.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          You haven't joined a Circle yet. Small groups built around doing a
          thing together, by skill level, city, or shared project.
        </p>
        <Link
          to="/circles"
          className="mt-3 inline-block text-sm text-[var(--coral-text)] hover:underline"
        >
          Browse Circles →
        </Link>
      </div>
    );
  }

  const shown = limit ? joined.slice(0, limit) : joined;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {shown.map((circle, i) => (
        <CircleCard key={circle.id} circle={circle} tint={TINTS[i % TINTS.length]} />
      ))}
    </div>
  );
}
