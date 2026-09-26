import { useEffect, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { Button } from "./ui/button";

/** Links one of the member's own existing Moments into this Space —
 * space_moments' own "the poster or a host links/unlinks" policy already
 * allows this as a direct insert, no RPC needed. Posting mode ('immediate'
 * vs 'approval') is enforced by the table's own before-insert trigger, not
 * here — a linked Moment on an approval Space just lands pending, same as
 * anywhere else that trigger applies. With no existing Moments to pick
 * from, "Log a new Moment" sends the member to the composer instead
 * (/create?space=<id>) — Log.tsx does that same space_moments insert
 * itself once the new post exists. */
export function AddMomentToSpaceDialog({
  spaceId,
  open,
  onOpenChange,
  onAdded,
}: {
  spaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called right after a link succeeds, so a parent showing this Space's
   * Moments (count, "On the table") can refetch instead of going stale
   * until the next full reload. */
  onAdded?: () => void;
}) {
  const { user } = useAuth();
  const [posts, setPosts] = useState<{ id: number; caption: string; media_url: string | null }[] | "loading">("loading");
  const [linking, setLinking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open || !supabase || !user) return;
    setPosts("loading");
    setError(null);
    setDone(false);
    supabase
      .from("posts")
      .select("id, caption, media_url")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setPosts(data ?? []));
  }, [open, user]);

  const link = async (postId: number) => {
    if (!supabase) return;
    setLinking(postId);
    setError(null);
    const { error: insertError } = await supabase.from("space_moments").insert({ space_id: spaceId, post_id: postId });
    setLinking(null);
    if (insertError) return setError(insertError.message);
    setDone(true);
    onAdded?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Add a Moment</DialogTitle>
          <DialogDescription>Pick one of your Moments to show here.</DialogDescription>
        </DialogHeader>
        {done ? (
          <p className="py-4 text-sm text-muted-foreground">Added.</p>
        ) : posts === "loading" ? (
          <div className="py-6" />
        ) : posts.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-sm text-muted-foreground">You don't have any Moments yet.</p>
            <Link to={`/create?space=${spaceId}`} onClick={() => onOpenChange(false)} className="mt-3 inline-block">
              <Button variant="coral" size="sm">Log a new Moment</Button>
            </Link>
          </div>
        ) : (
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {posts.map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={linking !== null}
                onClick={() => link(p.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-50"
              >
                {p.media_url && (
                  <img src={p.media_url} alt="" className="size-10 shrink-0 rounded-md object-cover" />
                )}
                <span className="line-clamp-2 flex-1">{p.caption || `Moment #${p.id}`}</span>
                {linking === p.id && <span className="text-xs text-muted-foreground">Adding…</span>}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
