import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchYouInspired, InspiredEntry } from "../lib/youInspired";
import { subHobbyLabel } from "../data/hobbies";

function snippet(caption: string): string {
  const trimmed = caption.trim();
  return trimmed.length <= 28 ? trimmed : `${trimmed.slice(0, 28).trimEnd()}…`;
}

function clause(entry: InspiredEntry): string {
  const activity = (entry.subHobby ? subHobbyLabel(entry.subHobby) : undefined) ?? entry.pursuitTitle;
  return `${activity.toLowerCase()} after your "${snippet(entry.inspiringPostCaption)}"`;
}

function joinClauses(clauses: string[]): string {
  if (clauses.length === 1) return clauses[0];
  if (clauses.length === 2) return `${clauses[0]} and ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(", ")}, and ${clauses[clauses.length - 1]}`;
}

/**
 * Right rail, item 3 (docs/my-space-spec.md's newest round). Private to the
 * viewing user only — signed-in only, and even then only reads
 * you_inspired_this_month() (staged migration, not yet run — see
 * lib/youInspired.ts), which itself only ever returns rows about *this*
 * account's own Moments. Never rendered on PublicProfile.tsx; nothing here
 * is a view/impression count, and nothing ranks one person's follow-through
 * against another's — it's a count and a couple of named examples, not a
 * leaderboard.
 */
export function InspiredRail() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<InspiredEntry[] | null>(null);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    fetchYouInspired().then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Loading (entries === null) renders nothing rather than a skeleton —
  // this is a quiet, easy-to-miss-on-purpose section; a loading flash
  // would draw more attention to it than the finished state ever does.
  if (entries === null) return null;

  return (
    <section>
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Quiet, but real
      </h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing yet this month.</p>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          This month, {entries.length} {entries.length === 1 ? "person" : "people"} started a
          Pursuit not long after seeing yours — {joinClauses(entries.map(clause))}.
        </p>
      )}

      <p className="mt-3 text-xs italic text-muted-foreground">
        Visible only to you. Counted from real follow-throughs, not views. Nothing here is
        ranked against anyone else.
      </p>
    </section>
  );
}
