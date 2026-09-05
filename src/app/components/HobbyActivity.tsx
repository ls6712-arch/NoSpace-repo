import { useMemo } from "react";
import { Post } from "../data/posts";
import { useContent } from "../context/ContentContext";
import { deriveProjects } from "../lib/journal";
import { subHobbyLabel } from "../data/hobbies";

const WEEK = 7 * 86_400_000;

export interface HobbyActivityStats {
  newThisWeek: number;
  upcoming: number;
  openProjects: number;
}

/**
 * What is happening in a hobby, rather than how popular it is.
 *
 * "2.4K people exploring" tells you nothing you can act on and quietly asks
 * you to care about size. "312 new posts this week · 24 upcoming activities ·
 * 18 projects looking for collaborators" tells you whether there is anything
 * here for you this week, which is the actual question.
 */
export function activityStats(posts: Post[]): HobbyActivityStats {
  const now = Date.now();
  const projects = deriveProjects(
    posts.filter((p) => p.visibility === "public"),
    subHobbyLabel,
  );
  return {
    newThisWeek: posts.filter((p) => now - p.createdAt < WEEK).length,
    upcoming: posts.filter((p) => p.startsAt && p.startsAt > now).length,
    // A project is open to company if it is still moving.
    openProjects: projects.filter((p) => now - p.lastUpdatedAt < 3 * WEEK).length,
  };
}

export function useHobbyActivity(hobbySlug?: string, subSlug?: string): HobbyActivityStats {
  const { posts } = useContent();
  return useMemo(() => {
    const scoped = posts.filter((p) =>
      subSlug ? p.subHobby === subSlug : hobbySlug ? p.hobbySlug === hobbySlug : true,
    );
    return activityStats(scoped);
  }, [posts, hobbySlug, subSlug]);
}

/** The three numbers, as a quiet line of facts. */
export function HobbyActivity({
  hobbySlug,
  subSlug,
  className = "",
}: {
  hobbySlug?: string;
  subSlug?: string;
  className?: string;
}) {
  const stats = useHobbyActivity(hobbySlug, subSlug);

  const items = [
    stats.newThisWeek > 0
      ? `${stats.newThisWeek} new ${stats.newThisWeek === 1 ? "moment" : "moments"} this week`
      : "Nothing new this week",
    stats.upcoming > 0
      ? `${stats.upcoming} upcoming ${stats.upcoming === 1 ? "activity" : "activities"}`
      : null,
    stats.openProjects > 0
      ? `${stats.openProjects} ${stats.openProjects === 1 ? "project" : "projects"} still moving`
      : null,
  ].filter(Boolean) as string[];

  return (
    <ul className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${className}`}>
      {items.map((item, i) => (
        <li key={item} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-muted-foreground/50">·</span>}
          {item}
        </li>
      ))}
    </ul>
  );
}
