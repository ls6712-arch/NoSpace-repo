import { Link } from "react-router";
import { Circle } from "../data/circles";
import { getHobby } from "../data/hobbies";
import { useContent } from "../context/ContentContext";
import { useConnections } from "../context/ConnectionsContext";
import { useCircles } from "../context/CirclesContext";
import { Avatar, AvatarFallback } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * The Circles you've joined — a name, its member count, and a flat
 * colored-initial mark standing in for a Circle photo, same pattern as a
 * person's own avatar (ContentCard.tsx) rather than a per-card tinted
 * background. Member count is context, not a score: it tells you whether a
 * Circle is a room or a stadium, which is the one thing you actually want
 * to know before posting in it.
 */
function CircleCard({ circle }: { circle: Circle }) {
  const { circleMemberCounts, isCircleJoined } = useContent();
  const { myCircleIds } = useConnections();
  const { isRealCircle } = useCircles();
  const space = getHobby(circle.hobbySlug);
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
      className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3.5 transition-colors hover:border-[var(--coral-deep)]"
    >
      <Avatar className="size-9 shrink-0 ring-0">
        <AvatarFallback
          className="text-xs"
          style={{ backgroundImage: "none", backgroundColor: "var(--surface-muted)", color: "var(--foreground)" }}
        >
          {initials(circle.name)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span
          className="block truncate text-sm leading-tight text-foreground"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {circle.name}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {displayedMemberCount.toLocaleString()} members
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
      {shown.map((circle) => (
        <CircleCard key={circle.id} circle={circle} />
      ))}
    </div>
  );
}
