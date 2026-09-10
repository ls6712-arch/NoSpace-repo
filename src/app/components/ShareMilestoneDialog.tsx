import { useState } from "react";
import * as Icons from "lucide-react";
import { Badge as BadgeDef, badgeName } from "../data/badges";
import { useRewards } from "../context/RewardsContext";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

/**
 * Sharing one milestone, not the whole profile. Opening this never shares
 * anything by itself — only the button inside does, and it's a toggle: the
 * same dialog un-shares a milestone that's already out there. This is the
 * "shareable asset" a fresh unlock or a tap on an achieved milestone
 * produces — a small card to screenshot, same spirit as "Share your work",
 * just scoped to the one thing that just happened rather than the whole shelf.
 */
export function ShareMilestoneDialog({
  badge,
  open,
  onOpenChange,
}: {
  badge: BadgeDef | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { isBadgeShared, shareBadge, unshareBadge } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const [copied, setCopied] = useState(false);

  if (!badge) return null;

  const shared = isBadgeShared(badge.id);
  const name = badgeName(badge, hobbySlug, hobbyLabel);
  const Icon = (Icons as any)[badge.icon] ?? Icons.Sparkles;
  const summary = `A quiet milestone reached on NoSpace: ${name}. ${badge.description}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard may be unavailable — the card itself is still screenshot-able
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">Share this milestone</DialogTitle>
        <div className="rounded-3xl p-[1.5px] [background-image:var(--gradient-brand)]">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-[var(--surface)] p-7 text-center">
            <span
              className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--coral-deep) 46%, var(--surface-elevated))",
                border: "1px solid color-mix(in srgb, var(--coral-deep) 62%, transparent)",
                color: "var(--offwhite)",
              }}
            >
              <Icon className="size-7" strokeWidth={1.6} />
            </span>
            <h3 className="mb-1.5 text-lg" style={{ fontFamily: "var(--font-serif)" }}>
              {name}
            </h3>
            <p className="text-xs text-muted-foreground mb-1">{badge.description}</p>
            <div className="text-xs text-muted-foreground">Create, Don't Just Consume.</div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 px-1">
          <Button variant="outline" className="flex-1" onClick={handleCopy}>
            {copied ? (
              <>
                <Icons.Check className="size-4" />
                Copied
              </>
            ) : (
              <>
                <Icons.Copy className="size-4" />
                Copy as text
              </>
            )}
          </Button>
          <Button
            variant={shared ? "outline" : "brand"}
            className="flex-1"
            onClick={() => (shared ? unshareBadge(badge.id) : shareBadge(badge.id))}
          >
            {shared ? (
              <>
                <Icons.EyeOff className="size-4" />
                Unshare
              </>
            ) : (
              <>
                <Icons.Share2 className="size-4" />
                Share on your profile
              </>
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3 px-1">
          {shared
            ? "Visible on your public profile. Screenshot the card above to share it as an image."
            : "Only visible to you until you share it. Screenshot the card above to share it as an image."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
