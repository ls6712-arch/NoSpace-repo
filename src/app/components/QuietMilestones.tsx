import { useState, type CSSProperties } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName, Badge as BadgeDef } from "../data/badges";
import { useRewards } from "../context/RewardsContext";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { ShareMilestoneDialog } from "./ShareMilestoneDialog";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

/** The disc's own achieved/locked look — the only thing that differs between
 * the owner's full shelf and a stranger's shared-only view. Locked stays the
 * existing muted, dashed outline untouched; achieved shifts to the product's
 * one existing warm accent (--coral-deep, the same one primary buttons use)
 * rather than each badge's own pastel tint, so an achieved milestone reads
 * as "reached," not as a trophy in a case. */
function badgeDiscStyle(unlocked: boolean): CSSProperties {
  return unlocked
    ? {
        backgroundColor: "color-mix(in srgb, var(--coral-deep) 46%, var(--surface-elevated))",
        border: "1px solid color-mix(in srgb, var(--coral-deep) 62%, transparent)",
        color: "var(--offwhite)",
      }
    : {
        backgroundColor: "var(--surface-muted)",
        border: "1px dashed var(--border)",
        color: "var(--lavender-faint)",
      };
}

function BadgeDetailDialog({
  badge,
  onOpenChange,
  hobbySlug,
  hobbyLabel,
  unlocked,
}: {
  badge: BadgeDef | null;
  onOpenChange: (open: boolean) => void;
  hobbySlug?: string;
  hobbyLabel?: string;
  unlocked: boolean;
}) {
  return (
    <Dialog open={!!badge} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="sm:max-w-xs text-center">
        {badge && (
          <>
            <DialogTitle className="sr-only">{badgeName(badge, hobbySlug, hobbyLabel)}</DialogTitle>
            {(() => {
              const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
              return (
                <>
                  <span
                    className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full"
                    style={badgeDiscStyle(unlocked)}
                  >
                    <Icon className="size-7" strokeWidth={1.6} />
                  </span>
                  <h3 className="mb-1 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
                    {badgeName(badge, hobbySlug, hobbyLabel)}
                  </h3>
                  <p className="mb-1 text-sm text-muted-foreground">{badge.description}</p>
                  {!unlocked && <p className="mt-4 text-xs text-muted-foreground">Not yet. No rush.</p>}
                </>
              );
            })()}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The owner's own shelf — every milestone, locked and achieved, exactly as
 * only they ever see it. An achieved one carries a small share toggle of its
 * own (bottom-right of the disc); nothing here is bulk-shareable, because
 * sharing is a decision made one milestone at a time, not a "share these →"
 * link that hands over the whole shelf at once.
 */
export function QuietMilestones() {
  const { unlockedBadgeIds, isBadgeShared } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const [selected, setSelected] = useState<BadgeDef | null>(null);
  const [shareTarget, setShareTarget] = useState<BadgeDef | null>(null);

  return (
    <>
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {badges.map((badge) => {
          const unlocked = unlockedBadgeIds.includes(badge.id);
          const shared = isBadgeShared(badge.id);
          const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
          return (
            <div key={badge.id} className="relative flex w-[82px] shrink-0 flex-col items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelected(badge)}
                className="flex flex-col items-center gap-2.5"
              >
                <span
                  className="flex size-16 items-center justify-center rounded-full transition-opacity duration-200 hover:opacity-80"
                  style={badgeDiscStyle(unlocked)}
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

              {/* The per-milestone share affordance — only ever on an
                  achieved one. Replaces the old bulk "Share these →" link:
                  sharing is now a choice made about this one milestone,
                  never all of them at once. */}
              {unlocked && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShareTarget(badge);
                  }}
                  aria-label={shared ? "Shared — manage sharing" : "Share this milestone"}
                  title={shared ? "Shared on your profile" : "Share this milestone"}
                  className={`absolute right-1 top-11 flex size-6 items-center justify-center rounded-full border transition-colors ${
                    shared
                      ? "border-transparent bg-[var(--coral-deep)] text-white"
                      : "border-[var(--hairline)] bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {shared ? <Icons.Check className="size-3" /> : <Icons.Share2 className="size-3" />}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <BadgeDetailDialog
        badge={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        hobbySlug={hobbySlug}
        hobbyLabel={hobbyLabel}
        unlocked={!!selected && unlockedBadgeIds.includes(selected.id)}
      />
      <ShareMilestoneDialog
        badge={shareTarget}
        open={!!shareTarget}
        onOpenChange={(o) => !o && setShareTarget(null)}
      />
    </>
  );
}

/**
 * A stranger's view — exactly the milestones this person chose to show, in
 * their achieved styling, and nothing else. No locked discs, no hint of how
 * many more exist: the whole point of "private by default, one at a time" is
 * that a non-owner never learns anything about a milestone that wasn't
 * explicitly shared, including whether it exists.
 */
export function SharedMilestones({
  badgeIds,
  primary,
}: {
  badgeIds: string[];
  primary?: { slug?: string; label?: string };
}) {
  const [selected, setSelected] = useState<BadgeDef | null>(null);
  const shown = badges.filter((b) => badgeIds.includes(b.id));

  if (shown.length === 0) return null;

  return (
    <>
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {shown.map((badge) => {
          const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
          return (
            <button
              key={badge.id}
              onClick={() => setSelected(badge)}
              className="flex w-[82px] shrink-0 flex-col items-center gap-2.5"
            >
              <span
                className="flex size-16 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105"
                style={badgeDiscStyle(true)}
              >
                <Icon className="size-6" strokeWidth={1.5} />
              </span>
              <span
                className="text-center text-[11.5px] leading-tight text-foreground"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {badgeName(badge, primary?.slug, primary?.label)}
              </span>
            </button>
          );
        })}
      </div>

      <BadgeDetailDialog
        badge={selected}
        onOpenChange={(o) => !o && setSelected(null)}
        hobbySlug={primary?.slug}
        hobbyLabel={primary?.label}
        unlocked
      />
    </>
  );
}
