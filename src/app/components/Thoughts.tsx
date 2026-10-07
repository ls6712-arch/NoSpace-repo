import { useState } from "react";
import { ChevronRight, Flag, Lock, MessageCircleQuestion, Trash2 } from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { ConfirmDialog } from "./ConfirmDialog";
import { MediaAttachPicker } from "./MediaAttachPicker";
import { ReportDialog } from "./ReportDialog";
import { Time } from "./ui/time";
import { ImageWithFallback } from "./ImageWithFallback";
import { withFirstFrame } from "../lib/mediaUrl";

/**
 * Thoughts, not comments — short, standalone reflections on a piece of work
 * rather than a threaded conversation; nobody is replying to anybody.
 *
 * No relationship is needed to leave one. The poster can switch a moment to
 * private thoughts, after which only they and the writer can see each one.
 */

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// "Keep going" was a reaction button before docs/moment-card-and-
// reactions-spec.md section 1 retired it as one — it survives here, a
// quick starter inside Add a thought rather than gone entirely.
const QUICK_STARTERS = ["Keep going", "How did you…?", "Show us the next one"];


export function Thoughts({
  postId,
  postOwnerId,
  postOwnerName,
  /** Only the owner sees the privacy control. */
  isOwner = false,
  privateThoughts = false,
  onTogglePrivate,
  compact = false,
  className = "",
  /** Lets a reply carry its own photo or video — opt-in per call site,
   * off by default so ContentCard and MomentDetail render exactly as
   * they did before this existed. */
  allowMedia = false,
  startOpen = false,
}: {
  postId: number;
  postOwnerId?: string;
  postOwnerName?: string;
  isOwner?: boolean;
  privateThoughts?: boolean;
  onTogglePrivate?: (next: boolean) => void;
  /** A smaller collapsed trigger. Everything it opens into — the composer,
   * existing thoughts — is unchanged. */
  compact?: boolean;
  className?: string;
  allowMedia?: boolean;
  /** Opens with the reply box already showing — used by the bell's
   * "Welcome to Soosh" button (MomentPage's ?reply=1). */
  startOpen?: boolean;
}) {
  const social = useSocial();
  const { user, profile } = useAuth();
  const myName = profile?.display_name || "You";
  const [openComposer, setOpenComposer] = useState(startOpen);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const thoughts = social.thoughtsFor(postId);

  const [failed, setFailed] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | string | null>(null);
  const [reportThoughtId, setReportThoughtId] = useState<number | string | null>(null);
  const reportingThought = thoughts.find((t) => t.id === reportThoughtId);

  const submit = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await social.addThought(postId, body, undefined, postOwnerId, postOwnerName, allowMedia ? media ?? undefined : undefined);
      setBody("");
      setMedia(null);
      setOpenComposer(false);
    } catch {
      // Keep what they wrote on screen — losing a thought to a dropped
      // connection is worse than showing an error.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      {isOwner && onTogglePrivate && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => onTogglePrivate(!privateThoughts)}
            aria-pressed={privateThoughts}
            className="flex items-center gap-1.5 text-caption text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="size-3" />
            {privateThoughts ? "Private thoughts only" : "Thoughts are public"}
          </button>
        </div>
      )}

      {!openComposer ? (
        <button
          type="button"
          onClick={() => setOpenComposer(true)}
          className={`mb-3 flex w-full items-center gap-2.5 rounded-control border border-[var(--border)] bg-surface text-left transition-colors hover:border-[var(--foreground)]/30 ${
            compact ? "px-2.5 py-1.5" : "px-3 py-2.5"
          }`}
        >
          <Avatar className={compact ? "size-5 shrink-0" : "size-6 shrink-0"}>
            <AvatarFallback className="text-caption">{initials(myName)}</AvatarFallback>
          </Avatar>
          <span className={`flex-1 truncate text-muted-foreground ${compact ? "text-caption" : "text-small"}`}>
            {compact ? "Add a thought" : "Add a thought…"}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="mb-3">
          {/* Fills the field, never posts on tap — a starting point to
              edit or send as-is, not a one-tap comment. */}
          {!body && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => setBody(starter)}
                  className="rounded-control border border-border bg-surface px-3 py-1 text-caption text-muted-foreground transition-colors hover:border-[var(--foreground)]/35 hover:text-foreground"
                >
                  {starter}
                </button>
              ))}
            </div>
          )}
          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            placeholder="What did this make you think?"
            className="min-h-20"
          />
          {allowMedia && (
            <div className="mt-2">
              <MediaAttachPicker file={media} onChange={setMedia} label="Add a photo" />
            </div>
          )}
          {failed && (
            <p className="mt-2 text-caption text-[var(--coral-text)]">
              That didn’t send. Your words are still here. Try again.
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">
              {privateThoughts
                ? "Only you and the maker will see this."
                : "Visible to anyone who can see this moment."}
            </span>
            <span className="flex shrink-0 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setOpenComposer(false);
                  setMedia(null);
                }}
              >
                Cancel
              </Button>
              <Button busy={saving} variant="coral" size="sm" disabled={!body.trim() || saving} onClick={submit}>
                Add thought
              </Button>
            </span>
          </div>
        </div>
      )}

      {thoughts.length > 0 && (
        <ul className="space-y-2">
          {thoughts.map((t) => (
            <li
              key={t.id}
              className="rounded-card border border-[var(--hairline)] bg-surface px-3.5 py-3"
            >
              {t.prompt && (
                <div className="mb-1.5 flex items-center gap-1.5 text-caption uppercase tracking-wide text-[var(--coral-text)]">
                  <MessageCircleQuestion className="size-3" />
                  {t.prompt}
                </div>
              )}
              <p className="text-small leading-relaxed">{t.body}</p>
              {t.media && (
                <div className="mt-2 overflow-hidden rounded-card border border-[var(--hairline)]">
                  {/^https?:\/\/.*\.(mp4|webm|mov)$/i.test(t.media) ? (
                    <video src={withFirstFrame(t.media)} controls playsInline preload="metadata" className="w-full" />
                  ) : (
                    <ImageWithFallback src={t.media} alt="" aspect="4 / 3" className="w-full" />
                  )}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Avatar className="size-5">
                  {t.authorAvatar && <AvatarImage src={t.authorAvatar} alt="" />}
                  <AvatarFallback className="text-caption">{initials(t.authorName)}</AvatarFallback>
                </Avatar>
                <span className="text-caption text-muted-foreground">
                  {t.authorName} · <Time value={t.createdAt} ago />
                </span>
                {user?.id === t.userId ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="ml-auto text-muted-foreground transition-colors hover:text-[var(--coral-text)]"
                    aria-label="Delete this thought"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setReportThoughtId(t.id)}
                    className="ml-auto text-muted-foreground transition-colors hover:text-foreground"
                    aria-label="Report this thought"
                  >
                    <Flag className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!social.isShared && thoughts.length > 0 && (
        <p className="mt-2 text-caption text-muted-foreground">
          Saved in this browser only. Sign in for thoughts other people can see.
        </p>
      )}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Delete this thought?"
        description="This can’t be undone. It’s gone for whoever else could see it too."
        onConfirm={async () => {
          if (confirmDeleteId !== null) await social.removeThought(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />

      {reportingThought && (
        <ReportDialog
          open={reportThoughtId !== null}
          onOpenChange={(o) => !o && setReportThoughtId(null)}
          targetUserId={reportingThought.userId}
          targetKind="thought"
          targetId={reportingThought.id}
          personName={reportingThought.authorName}
        />
      )}
    </div>
  );
}
