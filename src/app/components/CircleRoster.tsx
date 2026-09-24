import { useEffect, useState } from "react";
import { Circle } from "../data/circles";
import { useCircles, CircleMember } from "../context/CirclesContext";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Who's actually in a Circle. A real Circle's roster comes from
 * circle_members (only visible to a member or the owner — see
 * sql/circles.sql — so this renders nothing for anyone else, same as the
 * table's own RLS would return). A seed Circle has no members table behind
 * it at all, so this falls back to its hand-written moderators list.
 */
export function CircleRoster({ circle }: { circle: Circle }) {
  const { isRealCircle, fetchRoster } = useCircles();
  const [members, setMembers] = useState<CircleMember[] | null>(null);

  useEffect(() => {
    if (!isRealCircle(circle.id)) {
      setMembers(null);
      return;
    }
    let cancelled = false;
    fetchRoster(circle.id).then((list) => {
      if (!cancelled) setMembers(list);
    });
    return () => {
      cancelled = true;
    };
  }, [circle.id, isRealCircle, fetchRoster]);

  if (!isRealCircle(circle.id)) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-sm">Moderators</div>
        <p className="text-xs text-muted-foreground">{circle.moderators.join(" and ")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span>Members</span>
        <span className="text-xs text-muted-foreground">{circle.memberCount.toLocaleString()}</span>
      </div>
      {members === null ? (
        <p className="text-xs text-muted-foreground">Looking…</p>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Join this Circle to see who else is in it.
        </p>
      ) : (
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2.5">
              <Avatar className="size-6 shrink-0">
                {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
                <AvatarFallback className="text-[9px]">{initials(m.displayName)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-xs">{m.displayName}</span>
              {m.role === "owner" && (
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                  Owner
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
