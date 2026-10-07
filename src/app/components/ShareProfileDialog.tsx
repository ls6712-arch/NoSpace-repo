import { useState } from "react";
import * as Icons from "lucide-react";
import { badges, badgeName } from "../data/badges";
import { usePrimaryHobbyKey } from "./usePrimaryHobbyKey";
import { useRewards } from "../context/RewardsContext";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { APP_NAME } from "../config";
import { plural } from "../lib/plural";

export function ShareProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { stats, unlockedBadgeIds } = useRewards();
  const { slug: hobbySlug, label: hobbyLabel } = usePrimaryHobbyKey();
  const { profile } = useAuth();
  // The link has to be one anyone can actually open — the page you are
  // standing on requires an account, the public shelf does not.
  const publicUrl = profile?.username
    ? `${window.location.origin}${window.location.pathname}#/u/${profile.username}`
    : window.location.href;
  const [copied, setCopied] = useState(false);

  const unlocked = badges.filter((b) => unlockedBadgeIds.includes(b.id));

  const summary = `${plural(stats.postsCreated, "Moment")} logged on ${APP_NAME}, ${plural(unlocked.length, "Quiet milestone")} reached. ${publicUrl}`;

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
        <DialogTitle className="sr-only">Share your {APP_NAME} profile</DialogTitle>
        <div className="rounded-card p-[1.5px] [background-image:var(--gradient-brand)]">
          <div className="rounded-card bg-[var(--surface)] p-7 text-center">
            <Avatar className="size-16 mx-auto mb-4">
              <AvatarFallback className="text-lead">YOU</AvatarFallback>
            </Avatar>
            <div className="font-hud text-display mb-6 text-gradient-brand">
              {plural(stats.postsCreated, "Moment")} logged
            </div>

            {unlocked.length > 0 && (
              <div className="flex items-center justify-center gap-2 mb-6">
                {unlocked.slice(0, 5).map((b) => {
                  const Icon = (Icons as any)[b.icon] ?? Icons.Sparkles;
                  return (
                    <span
                      key={b.id}
                      title={badgeName(b, hobbySlug, hobbyLabel)}
                      className="flex size-9 items-center justify-center rounded-full text-on-brand [background-image:var(--gradient-brand)]"
                    >
                      <Icon className="size-4" />
                    </span>
                  );
                })}
              </div>
            )}

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
        <p className="text-center text-caption text-muted-foreground mt-3 px-1">
          Screenshot the card above to share it as an image.
        </p>
      </DialogContent>
    </Dialog>
  );
}
