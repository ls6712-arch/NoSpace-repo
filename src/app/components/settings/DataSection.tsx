import { useState } from "react";
import { Lock } from "lucide-react";
import { usePrivateLogs } from "../../context/PrivateLogsContext";
import { useRewards } from "../../context/RewardsContext";
import { SectionHeader } from "../ui/section-header";
import { ConfirmDialog } from "../ConfirmDialog";

function timeAgo(ts: number) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DataSection() {
  const { logs, remove } = usePrivateLogs();
  const { points } = useRewards();
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <section>
      <SectionHeader n={5} eyebrow="YOUR DATA" title="Your data" />
      <p className="mb-4 text-sm text-muted-foreground">
        What's kept here, and only here.
      </p>

      <div className="rounded-btn border border-border bg-card p-4 sm:p-5">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <Lock className="size-4 text-muted-foreground" />
          "Only you" Moments
        </div>
        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          Kept here and nowhere else. These never appear in a Space, a feed, or your public shelf.
        </p>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing here yet.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((entry) => (
              <li key={entry.id} className="rounded-btn border border-[var(--hairline)] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-muted-foreground">
                    Only you · {timeAgo(entry.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(entry.id)}
                    className="min-h-11 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
                {entry.media && (
                  <div className="mb-2 overflow-hidden rounded-md border border-[var(--hairline)]">
                    {entry.mediaType === "video" ? (
                      <video src={entry.media} controls className="w-full" />
                    ) : (
                      <img src={entry.media} alt="" className="w-full" />
                    )}
                  </div>
                )}
                <p className="whitespace-pre-line text-sm leading-relaxed">{entry.note}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {points > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          {points} {points === 1 ? "point" : "points"} earned so far.
        </p>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Delete this?"
        description="This can't be undone — nobody else ever saw it, and once it's gone there's no copy left anywhere."
        onConfirm={async () => {
          if (confirmDeleteId !== null) await remove(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
    </section>
  );
}
