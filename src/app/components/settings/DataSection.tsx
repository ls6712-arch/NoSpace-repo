import { useState } from "react";
import { Lock } from "lucide-react";
import { usePrivateLogs } from "../../context/PrivateLogsContext";
import { useRewards } from "../../context/RewardsContext";
import { SectionHeader } from "../ui/section-header";
import { ConfirmDialog } from "../ConfirmDialog";
import { plural } from "../../lib/plural";
import { Time } from "../ui/time";
import { EmptyState } from "../StateViews";
import { ImageWithFallback } from "../ImageWithFallback";
import { withFirstFrame } from "../../lib/mediaUrl";


export function DataSection() {
  const { logs, remove } = usePrivateLogs();
  const { points } = useRewards();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <section>
      <SectionHeader n={6} eyebrow="Your data" title="Your data" />
      <p className="mb-4 text-small text-muted-foreground">
        What’s kept here, and only here.
      </p>

      <div className="rounded-control border border-border bg-card p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-small">
          <Lock className="size-4 text-muted-foreground" />
          “Only you” Moments
        </div>
        <p className="mb-3 text-caption leading-relaxed text-muted-foreground">
          Kept here and nowhere else. These never appear in a Space, a feed, or your public Shelf.
        </p>
        {logs.length === 0 ? (
          <EmptyState size="rail" className="mt-0" line="Nothing here yet." action={{ label: "Log a Moment", to: "/create" }} />
        ) : (
          <ul className="space-y-3">
            {logs.map((entry) => (
              <li key={entry.id} className="rounded-control border border-[var(--hairline)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-caption text-muted-foreground">
                    Only you · <Time value={entry.createdAt} ago />
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="min-h-11 text-caption text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
                {entry.media && (
                  <div className="mb-2 overflow-hidden rounded-card border border-[var(--hairline)]">
                    {entry.mediaType === "video" ? (
                      <video src={withFirstFrame(entry.media)} controls playsInline preload="metadata" className="w-full" />
                    ) : (
                      <ImageWithFallback src={entry.media} alt="" aspect="4 / 3" className="w-full" />
                    )}
                  </div>
                )}
                <p className="whitespace-pre-line text-small leading-relaxed">{entry.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {points > 0 && (
        <p className="mt-4 text-caption text-muted-foreground">
          {plural(points, "point")} earned so far.
        </p>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Delete this?"
        description="This can’t be undone. Nobody else saw it, and there is no copy left once it’s deleted."
        onConfirm={async () => {
          if (confirmDeleteId !== null) await remove(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </section>
  );
}
