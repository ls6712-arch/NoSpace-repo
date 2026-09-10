import { useEffect, useState } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName } from "../data/badges";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { useRewards } from "../context/RewardsContext";
import { ShareMilestoneDialog } from "./ShareMilestoneDialog";

/**
 * Fires once, right when a milestone is actually crossed — never on every
 * Moment logged, since RewardsContext only ever sets a new
 * lastUnlockedBadgeId the instant a badge test flips from false to true (see
 * checkNewBadges). Skippable, not a blocking modal: it auto-dismisses on its
 * own, and dismissing it (or ignoring it entirely) still leaves the
 * milestone unlocked on the owner's own profile — only "Share" makes it
 * visible to anyone else, and that stays available later too, from the
 * profile itself.
 */
export function BadgeUnlockToast() {
  const { lastUnlockedBadgeId, dismissLastBadge, isBadgeShared } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const badge = badges.find((b) => b.id === lastUnlockedBadgeId);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(dismissLastBadge, 6000);
    return () => clearTimeout(t);
  }, [badge, dismissLastBadge]);

  if (!badge) return null;

  const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
  const shared = isBadgeShared(badge.id);

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100%-2.5rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in">
      <div className="glass-panel glow-violet flex items-start gap-3 rounded-2xl p-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-full"
          style={{
            backgroundColor: "color-mix(in srgb, var(--coral-deep) 46%, var(--surface-elevated))",
            border: "1px solid color-mix(in srgb, var(--coral-deep) 62%, transparent)",
            color: "var(--offwhite)",
          }}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-[var(--coral-text)] mb-0.5">
            Milestone reached
          </div>
          <div className="text-sm font-medium">{badgeName(badge, hobbySlug, hobbyLabel)}</div>
          <div className="mb-1.5 text-xs text-muted-foreground">{badge.description}</div>
          {shared ? (
            <span className="text-xs text-muted-foreground">Shared on your profile</span>
          ) : (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1 text-xs text-[var(--coral-text)] hover:underline"
            >
              <Icons.Share2 className="size-3" />
              Share
            </button>
          )}
        </div>
        <button
          onClick={dismissLastBadge}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          <Icons.X className="size-4" />
        </button>
      </div>

      <ShareMilestoneDialog badge={shareOpen ? badge : null} open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
}
