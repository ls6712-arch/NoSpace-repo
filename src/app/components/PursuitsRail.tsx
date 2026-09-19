import { useState } from "react";
import { Post } from "../data/posts";
import { Project } from "../lib/journal";
import { isStillMoving, pursuitMoments } from "../lib/pursuitTrail";
import { PursuitTrack } from "./PursuitTrack";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

/**
 * Right rail, item 2 — own Pursuits only (docs/my-space-spec.md section 4.2).
 * Not the earlier "Pursuits still moving" section that showed OTHER
 * people's ongoing work from the public feed; that concept is retired.
 */
export function PursuitsRail({
  pursuits,
  posts,
  entryProject,
}: {
  pursuits: Project[];
  posts: Post[];
  entryProject: Record<string, string>;
}) {
  const [seeAll, setSeeAll] = useState(false);

  const lastMomentAt = (p: Project) => {
    const moments = pursuitMoments(posts, p.id, entryProject);
    return moments[moments.length - 1]?.createdAt;
  };

  const moving = pursuits
    .filter((p) => isStillMoving(lastMomentAt(p)))
    .sort((a, b) => (lastMomentAt(b) ?? 0) - (lastMomentAt(a) ?? 0))
    .slice(0, 5);

  return (
    <section>
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        Pursuits still moving
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        The ones you haven't set down yet.
      </p>

      {pursuits.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No Pursuits yet. Start one from any Moment.
        </p>
      ) : (
        <>
          <div className="mt-2 divide-y divide-border">
            {moving.map((p) => (
              <PursuitTrack key={p.id} pursuit={p} posts={posts} entryProject={entryProject} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSeeAll(true)}
            className="mt-2 text-xs text-accent hover:underline"
          >
            See all my Pursuits
          </button>
        </>
      )}

      <Dialog open={seeAll} onOpenChange={setSeeAll}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader className="text-left">
            <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>
              All your Pursuits
            </DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-border">
            {pursuits.map((p) => (
              <PursuitTrack key={p.id} pursuit={p} posts={posts} entryProject={entryProject} />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
