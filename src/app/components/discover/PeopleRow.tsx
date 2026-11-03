import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HorizontalRow } from "../HorizontalRow";
import { PersonCard } from "../PersonCard";
import { peopleByIds, type Person } from "../../lib/people";
import type { Post } from "../../data/posts";

const SHOWN = 8;

/**
 * The people behind the feed, so finding someone is not only scrolling their Moments: the
 * newest authors first, each one once, never yourself. The feed already leaves out people you
 * follow, so this does too. No counts and no ranking by audience (see People.tsx). Each card
 * opens their Shelf. With nobody to show, the whole section is left out.
 */
export function PeopleRow({ posts, viewerId, heading }: { posts: Post[]; viewerId: string; heading: ReactNode }) {
  const ids = useMemo(() => {
    const seen = new Set<string>();
    for (const p of [...posts].sort((a, b) => b.createdAt - a.createdAt)) {
      if (!p.userId || p.userId === viewerId || seen.has(p.userId)) continue;
      seen.add(p.userId);
      if (seen.size === SHOWN) break;
    }
    return [...seen];
  }, [posts, viewerId]);
  const key = ids.join("|");

  const [people, setPeople] = useState<Person[]>([]);
  useEffect(() => {
    if (!key) return setPeople([]);
    let live = true;
    void peopleByIds(key.split("|")).then((list) => live && setPeople(list));
    return () => {
      live = false;
    };
  }, [key]);

  // A person followed from the feed leaves at once, before any reload.
  const shown = people.filter((p) => ids.includes(p.id));
  if (shown.length === 0) return null;
  return (
    <section id="discover-people" aria-labelledby="people-title" className="scroll-mt-24">
      {heading}
      <HorizontalRow name="discover.people" label="People near you" contentKey={shown.map((p) => p.id).join("|")}>
        {shown.map((p) => (
          <li key={p.id} className="w-[260px] shrink-0 snap-start">
            <PersonCard person={p} className="h-full" />
          </li>
        ))}
      </HorizontalRow>
    </section>
  );
}
