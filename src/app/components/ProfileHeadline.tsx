import { useContent } from "../context/ContentContext";
import { getHobby, subHobbyLabel } from "../data/hobbies";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Works out what you're actually into and how long you've been at it: the
 * hobby you've logged the most, and the date you first logged it. Sub-hobbies
 * win over spaces, because "3 months into pottery" says far more than
 * "3 months into The Workbench".
 */
export function pickPrimaryHobby(
  myPosts: { hobbySlug: string; subHobby?: string; createdAt: number }[],
): { label: string; firstActivityAt: number } | null {
  if (myPosts.length === 0) return null;

  // Count by sub-hobby first; fall back to the space for untagged posts, so
  // someone who never tags a hobby still gets a real headline.
  const tally = new Map<
    string,
    { count: number; first: number; label: string; tagged: boolean }
  >();

  for (const post of myPosts) {
    const key = post.subHobby ?? `space:${post.hobbySlug}`;
    const label = post.subHobby
      ? subHobbyLabel(post.subHobby) ?? post.subHobby
      : getHobby(post.hobbySlug)?.shortName ?? post.hobbySlug;

    const existing = tally.get(key);
    if (existing) {
      existing.count += 1;
      existing.first = Math.min(existing.first, post.createdAt);
    } else {
      tally.set(key, { count: 1, first: post.createdAt, label, tagged: !!post.subHobby });
    }
  }

  // Most-logged wins. On a tie, a named hobby beats a whole space ("3 months
  // into baking" reads better than "into kitchen table"), then earliest start.
  const winner = [...tally.values()].sort(
    (a, b) =>
      b.count - a.count ||
      Number(b.tagged) - Number(a.tagged) ||
      a.first - b.first,
  )[0];

  return { label: winner.label.toLowerCase(), firstActivityAt: winner.first };
}

/** Hook form of {@link pickPrimaryHobby}, reading your own logged posts. */
export function usePrimaryHobby() {
  const { myPosts } = useContent();
  return pickPrimaryHobby(myPosts);
}

/**
 * "3 months into pottery" — how long you've been at the thing, not what tier
 * the platform has sorted you into. Deliberately not a level: the milestone
 * belongs to the hobby, not to NoSpace.
 */
export function milestoneText(label: string, firstActivityAt: number, now = Date.now()) {
  const days = Math.floor((now - firstActivityAt) / DAY);

  if (days < 1) return `Day one of ${label}`;
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} into ${label}`;

  // Clamped to at least 1 in both branches: an average month is 30.44 days, so
  // a plain floor turns day 30 into "0 months" and day 365 into "0 years".
  if (days < 365) {
    const months = Math.max(1, Math.floor(days / 30.44));
    return `${months} ${months === 1 ? "month" : "months"} into ${label}`;
  }

  const years = Math.max(1, Math.floor(days / 365.25));
  return `${years} ${years === 1 ? "year" : "years"} into ${label}`;
}

/**
 * The profile's one headline stat. Pass `hobbyLabel`/`firstActivityAt` to drive
 * it from your own data; leave them off and it derives both from what you've
 * logged.
 */
export function ProfileHeadline({
  hobbyLabel,
  firstActivityAt,
  variant = "hero",
}: {
  hobbyLabel?: string;
  firstActivityAt?: number;
  /**
   * "hero" is the big gradient headline. "quiet" is the one-line form used
   * under a name, where the shelf is carrying the visual weight instead.
   */
  variant?: "hero" | "quiet";
}) {
  const derived = usePrimaryHobby();

  const label = hobbyLabel ?? derived?.label;
  const startedAt = firstActivityAt ?? derived?.firstActivityAt;

  const headline =
    label && startedAt ? milestoneText(label, startedAt) : "Just getting started";

  if (variant === "quiet") {
    return (
      <p className="text-sm text-muted-foreground">
        {headline} <span className="text-muted-foreground/60">· Keep going.</span>
      </p>
    );
  }

  return (
    <div>
      <div className="font-hud text-3xl sm:text-4xl mb-1 text-gradient-brand">
        {headline}
      </div>
      <div className="text-sm text-muted-foreground/70 font-hud">Keep going.</div>
    </div>
  );
}
