import { useEffect, useState } from "react";
import { Link } from "react-router";
import { fetchFollowers, fetchFollowing, type FollowListPerson } from "../lib/profileFollows";
import { profilePath } from "../lib/people";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Who follows, and who's followed — one dialog, two tabs, reused from both
 * your own page and anyone else's. Reopens on whichever tab it was asked to
 * (`initialTab`), never the tab it happened to be left on last time. */
export function FollowListDialog({
  open,
  onOpenChange,
  profileId,
  initialTab,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  initialTab: "followers" | "following";
}) {
  const [tab, setTab] = useState<"followers" | "following">(initialTab);
  const [people, setPeople] = useState<FollowListPerson[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const fetcher = tab === "followers" ? fetchFollowers : fetchFollowing;
    fetcher(profileId).then((found) => {
      if (!cancelled) {
        setPeople(found);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, tab, profileId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
            {tab === "followers" ? "Followers" : "Following"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-full border border-border p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setTab("followers")}
            className={`flex-1 rounded-full px-3 py-1 transition-colors ${
              tab === "followers" ? "bg-[var(--coral-deep)] text-white" : "text-muted-foreground"
            }`}
          >
            Followers
          </button>
          <button
            type="button"
            onClick={() => setTab("following")}
            className={`flex-1 rounded-full px-3 py-1 transition-colors ${
              tab === "following" ? "bg-[var(--coral-deep)] text-white" : "text-muted-foreground"
            }`}
          >
            Following
          </button>
        </div>

        <div className="mt-2">
          {loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Loading…</p>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              {tab === "followers" ? "No followers yet." : "Not following anyone yet."}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {people.map((person) => (
                <li key={person.id}>
                  <Link
                    to={profilePath(person)}
                    onClick={() => onOpenChange(false)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                  >
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(person.displayName)}</AvatarFallback>
                    </Avatar>
                    {person.displayName}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
