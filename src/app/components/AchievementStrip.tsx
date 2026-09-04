import { useState } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName, Badge as BadgeDef } from "../data/badges";
import { useRewards } from "../context/RewardsContext";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

export function AchievementStrip({ onShare }: { onShare: () => void }) {
  const { unlockedBadgeIds } = useRewards();
  const [selected, setSelected] = useState<BadgeDef | null>(null);
  // The craft badges are named after whatever you're furthest into.
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {badges.map((badge) => {
          const unlocked = unlockedBadgeIds.includes(badge.id);
          const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
          return (
            <button
              key={badge.id}
              onClick={() => setSelected(badge)}
              className="flex flex-col items-center gap-1.5 shrink-0 w-16"
            >
              <span
                className={`flex size-14 items-center justify-center rounded-full p-[2px] ${
                  unlocked ? "[background-image:var(--gradient-brand)]" : "bg-surface-muted"
                }`}
              >
                <span
                  className={`flex size-full items-center justify-center rounded-full bg-[var(--surface)] ${
                    unlocked ? "text-white" : "text-muted-foreground/50"
                  }`}
                >
                  <Icon className="size-5" />
                </span>
              </span>
              <span
                className={`text-[11px] text-center leading-tight line-clamp-2 ${
                  unlocked ? "text-foreground" : "text-muted-foreground/60"
                }`}
              >
                {badgeName(badge, hobbySlug, hobbyLabel)}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-xs text-center">
          {selected && (
            <>
              <DialogTitle className="sr-only">
                {badgeName(selected, hobbySlug, hobbyLabel)}
              </DialogTitle>
              {(() => {
                const Icon = (Icons as any)[selected.icon] ?? Icons.Sparkles;
                const unlocked = unlockedBadgeIds.includes(selected.id);
                return (
                  <>
                    <span
                      className={`mx-auto mb-4 flex size-16 items-center justify-center rounded-full ${
                        unlocked
                          ? "text-white [background-image:var(--gradient-brand)]"
                          : "bg-surface-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-7" />
                    </span>
                    <h3 className="text-lg mb-1">
                      {badgeName(selected, hobbySlug, hobbyLabel)}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-5">{selected.description}</p>
                    {unlocked ? (
                      <Button
                        variant="brand"
                        className="w-full"
                        onClick={() => {
                          setSelected(null);
                          onShare();
                        }}
                      >
                        <Icons.Share2 className="size-4" />
                        Share your profile
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not unlocked yet — keep going.</p>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
