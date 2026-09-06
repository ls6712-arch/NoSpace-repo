import { useState } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName, Badge as BadgeDef } from "../data/badges";
import { useRewards } from "../context/RewardsContext";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

/**
 * Milestones as soft pastel discs rather than glowing trophies. Earned ones
 * carry their tint at full strength; unearned ones sit faint and outlined —
 * present, so you can see what's ahead, but never nagging. No counts, no
 * ranking, no comparison to anyone else.
 */
export function QuietMilestones({
  onShare,
  unlockedIds,
  primary,
}: {
  onShare?: () => void;
  /** Supply to render someone else's milestones (public profiles). */
  unlockedIds?: string[];
  /** Which craft names to use, when not reading the viewer's own ledger. */
  primary?: { slug?: string; label?: string };
}) {
  const { unlockedBadgeIds: ownUnlocked } = useRewards();
  const ownPrimary = usePrimaryHobbyKey();
  const [selected, setSelected] = useState<BadgeDef | null>(null);

  const unlockedBadgeIds = unlockedIds ?? ownUnlocked;
  const { slug: hobbySlug, label: hobbyLabel } = primary ?? ownPrimary;

  return (
    <>
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {badges.map((badge) => {
          const unlocked = unlockedBadgeIds.includes(badge.id);
          const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
          return (
            <button
              key={badge.id}
              onClick={() => setSelected(badge)}
              className="flex w-[82px] shrink-0 flex-col items-center gap-2.5"
            >
              <span
                className="flex size-16 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
                style={
                  unlocked
                    ? {
                        backgroundColor: `color-mix(in srgb, ${badge.tint} 46%, var(--cream))`,
                        border: `1px solid color-mix(in srgb, ${badge.tint} 62%, transparent)`,
                        color: "var(--forest-ink)",
                      }
                    : {
                        backgroundColor: "var(--surface-muted)",
                        border: "1px dashed var(--border)",
                        color: "color-mix(in srgb, var(--forest-ink) 32%, transparent)",
                      }
                }
              >
                <Icon className="size-6" strokeWidth={1.5} />
              </span>
              <span
                className={`text-center text-[11.5px] leading-tight ${
                  unlocked ? "text-foreground" : "text-muted-foreground"
                }`}
                style={{ fontFamily: "var(--font-serif)" }}
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
                      className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full"
                      style={
                        unlocked
                          ? {
                              backgroundColor: `color-mix(in srgb, ${selected.tint} 46%, var(--cream))`,
                              border: `1px solid color-mix(in srgb, ${selected.tint} 62%, transparent)`,
                              color: "var(--forest-ink)",
                            }
                          : {
                              backgroundColor: "var(--surface-muted)",
                              border: "1px dashed var(--border)",
                              color: "color-mix(in srgb, var(--forest-ink) 32%, transparent)",
                            }
                      }
                    >
                      <Icon className="size-7" strokeWidth={1.6} />
                    </span>
                    <h3 className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                      {badgeName(selected, hobbySlug, hobbyLabel)}
                    </h3>
                    <p className="mb-5 text-sm text-muted-foreground">{selected.description}</p>
                    {unlocked && onShare ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setSelected(null);
                          onShare();
                        }}
                      >
                        <Icons.Share2 className="size-4" />
                        Share your profile
                      </Button>
                    ) : unlocked ? null : (
                      <p className="text-xs text-muted-foreground">Not yet. No rush.</p>
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
