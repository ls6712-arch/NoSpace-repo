import { useContent } from "../context/ContentContext";
import { subHobbyLabel } from "../data/hobbies";

const DAY = 24 * 60 * 60 * 1000;

/**
 * Works out what you're actually into and how long you've been at it: the
 * Corner you've logged the most, and the date you first logged it. Category
 * never appears here — spec change ("Corners carry discovery"): Category is
 * internal-only, so an untagged Moment can no longer stand in for one
 * ("3 months into The Workbench" is gone, not just deprioritized). A post
 * with no Corner simply doesn't enter the tally; `label` comes back null
 * when nothing ever has, but `firstActivityAt` still reflects the earliest
 * post overall, so "Started N days ago" (see milestoneText) has a real date
 * to work from even then.
 */
export function pickPrimaryHobby(
  myPosts: { hobbySlug: string; subHobby?: string; createdAt: number }[],
): { label: string | null; firstActivityAt: number } | null {
  if (myPosts.length === 0) return null;

  const firstActivityAt = Math.min(...myPosts.map((p) => p.createdAt));

  const tally = new Map<string, { count: number; first: number; label: string }>();
  for (const post of myPosts) {
    if (!post.subHobby) continue;
    const label = subHobbyLabel(post.subHobby) ?? post.subHobby;
    const existing = tally.get(post.subHobby);
    if (existing) {
      existing.count += 1;
      existing.first = Math.min(existing.first, post.createdAt);
    } else {
      tally.set(post.subHobby, { count: 1, first: post.createdAt, label });
    }
  }

  if (tally.size === 0) return { label: null, firstActivityAt };

  // Most-logged Corner wins; a tie goes to whichever started earlier.
  const winner = [...tally.values()].sort((a, b) => b.count - a.count || a.first - b.first)[0];
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
 * belongs to the Corner, not to Sushii. `label: null` (no Corner-tagged
 * Moment yet — see pickPrimaryHobby) drops the "into X" entirely rather
 * than naming a Category: "Started 3 days ago", never "3 days into travel &
 * adventure".
 */
export function milestoneText(label: string | null, firstActivityAt: number, now = Date.now()) {
  const days = Math.floor((now - firstActivityAt) / DAY);

  if (label === null) {
    if (days < 1) return "Started today";
    return `Started ${days} ${days === 1 ? "day" : "days"} ago`;
  }

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

  // hobbyLabel/firstActivityAt (explicit props) always win when passed —
  // `derived?.label` can be legitimately null (posts exist, none tagged
  // with a Corner yet), which is a real, renderable state ("Started N days
  // ago"), not "nothing to show" the way `derived` itself being null is
  // (no posts at all).
  const label = hobbyLabel !== undefined ? hobbyLabel : derived?.label ?? null;
  const startedAt = firstActivityAt ?? derived?.firstActivityAt;

  const headline = startedAt !== undefined ? milestoneText(label, startedAt) : "Just getting started";

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
