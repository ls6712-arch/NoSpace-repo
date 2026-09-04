import { useState } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName } from "../data/badges";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { useRewards } from "../context/RewardsContext";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";

export function ShareProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { points, level, stats, unlockedBadgeIds } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const { profile } = useAuth();
  // The link has to be one anyone can actually open — the page you are
  // standing on requires an account, the public shelf does not.
  const publicUrl = profile?.username
    ? `${window.location.origin}${window.location.pathname}#/u/${profile.username}`
    : window.location.href;
  const [copied, setCopied] = useState(false);

  const unlocked = badges.filter((b) => unlockedBadgeIds.includes(b.id));
  const creatorPoints = stats.postsCreated * 50;
  const creatorShare = Math.round(
    (creatorPoints / Math.max(creatorPoints + Math.max(points - creatorPoints, 0), 1)) * 100
  );

  const summary = `${stats.postsCreated} ${stats.postsCreated === 1 ? "session" : "sessions"} logged on NoSpace, ${unlocked.length} quiet ${unlocked.length === 1 ? "milestone" : "milestones"} reached. Create, don't just consume: ${publicUrl}`;

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
        <DialogTitle className="sr-only">Share your NoSpace profile</DialogTitle>
        <div className="rounded-3xl p-[1.5px] [background-image:var(--gradient-brand)]">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-[#05060B] p-7 text-center">
            <Avatar className="size-16 mx-auto mb-4">
              <AvatarFallback className="text-lg">YOU</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground mb-1 font-hud">Level {level}</div>
            <div className="font-hud text-4xl mb-1 text-gradient-brand">
              {stats.postsCreated} {stats.postsCreated === 1 ? "thing" : "things"} created
            </div>
            <div className="text-xs text-muted-foreground mb-6">
              {creatorShare}% creator on NoSpace
            </div>

            {unlocked.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {unlocked.slice(0, 5).map((b) => {
                  const Icon = (Icons as any)[b.icon] ?? Icons.Sparkles;
                  return (
                    <span
                      key={b.id}
                      title={badgeName(b, hobbySlug, hobbyLabel)}
                      className="flex size-9 items-center justify-center rounded-full text-white [background-image:var(--gradient-brand)]"
                    >
                      <Icon className="size-4" />
                    </span>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-muted-foreground mb-1">Create, Don't Just Consume.</div>
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
          <Button variant="brand" className="flex-1" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3 px-1">
          Screenshot the card above to share it as an image.
        </p>
      </DialogContent>
    </Dialog>
  );
}
