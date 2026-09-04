import { useEffect } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName } from "../data/badges";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { useRewards } from "../context/RewardsContext";

export function BadgeUnlockToast() {
  const { lastUnlockedBadgeId, dismissLastBadge } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const badge = badges.find((b) => b.id === lastUnlockedBadgeId);

  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(dismissLastBadge, 5000);
    return () => clearTimeout(t);
  }, [badge, dismissLastBadge]);

  if (!badge) return null;

  const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;

  return (
    <div className="fixed bottom-5 right-5 z-[60] w-[calc(100%-2.5rem)] max-w-sm animate-in slide-in-from-bottom-4 fade-in">
      <div className="glass-panel glow-violet flex items-start gap-3 rounded-2xl p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full text-white [background-image:var(--gradient-brand)]">
          <Icon className="size-5" />
        </span>
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-[var(--coral-text)] mb-0.5">
            Badge unlocked
          </div>
          <div className="text-sm font-medium">{badgeName(badge, hobbySlug, hobbyLabel)}</div>
          <div className="text-xs text-muted-foreground">{badge.description}</div>
        </div>
        <button
          onClick={dismissLastBadge}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          <Icons.X className="size-4" />
        </button>
      </div>
    </div>
  );
}
