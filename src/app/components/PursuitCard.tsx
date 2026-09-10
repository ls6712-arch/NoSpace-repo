import { useState } from "react";
import { Link } from "react-router";
import { Check, Lock, Share2, Sparkles, Target } from "lucide-react";
import { getHobby } from "../data/hobbies";
import { Post } from "../data/posts";
import {
  Project,
  setProjectShared,
  finishProject,
  projectProgress,
  useJournalSlice,
  markGoalReached,
  goalProgressText,
} from "../lib/journal";
import { mirrorPursuit } from "../lib/pursuitsRemote";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { GeneratedArt } from "./GeneratedArt";
import { PostMedia } from "./PostMedia";
import { GoalDialog } from "./GoalDialog";

function timeAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/** What a Pursuit card actually needs — either the owner's own live Project
 * (with edit actions) or someone else's shared row (read-only). */
export type PursuitLike = {
  id: string;
  title: string;
  hobbySlug?: string;
  interest?: string;
  customSpace?: string;
  startedAt: number;
  finishedAt?: number;
};

/**
 * One Pursuit, as a card someone would actually want to look at: its own
 * inspiration image when it has one (a real photo if the maker uploaded
 * one, the same illustrated fallback as everywhere else in NoSpace
 * otherwise), the Space and Interest as quiet metadata rather than a
 * taxonomy to fill in, and a status worked out from what's actually
 * happened rather than a field someone has to remember to update.
 */
export function PursuitCard({
  pursuit,
  inspirationPost,
  owner = false,
  className = "",
}: {
  pursuit: PursuitLike;
  inspirationPost?: Post;
  /** Only the owner's own view gets the share toggle and "Mark complete". */
  owner?: boolean;
  className?: string;
}) {
  const { user, profile } = useAuth();
  const { posts } = useContent();
  const entryProject = useJournalSlice((s) => s.entryProject);
  const [goalOpen, setGoalOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  // Only the owner's own card is ever backed by a full Project (with a
  // `shared` flag and edit actions) — a friend's view only ever gets the
  // read-only PursuitLike shape, so this cast is safe exactly when owner is.
  const asProject = owner ? (pursuit as Project) : null;
  const shared = !!asProject?.shared;

  const { count, lastUpdatedAt } = owner
    ? projectProgress(entryProject, posts, pursuit.id)
    : { count: 0, lastUpdatedAt: undefined };

  const space = pursuit.hobbySlug ? getHobby(pursuit.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? pursuit.customSpace;
  const status = pursuit.finishedAt ? "Completed" : count > 0 ? "In progress" : "Just started";
  const moved = pursuit.finishedAt ?? lastUpdatedAt ?? pursuit.startedAt;

  const toggleShare = async () => {
    if (!asProject) return;
    const next = !shared;
    setProjectShared(pursuit.id, next);
    if (user) void mirrorPursuit(user.id, { ...asProject, shared: next });

    // Turning sharing on is the moment someone actually wants a link to
    // hand to someone — do that copy right here instead of leaving them to
    // hunt for a separate "share" action afterward, which is what made this
    // button feel like it didn't do anything.
    if (next) {
      const url = profile?.username
        ? `${window.location.origin}${window.location.pathname}#/u/${profile.username}`
        : window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        // Clipboard can be unavailable (permissions, non-secure context) —
        // the Pursuit is still shared either way, just without the copy.
      }
    }
  };

  const markDone = () => {
    if (!asProject) return;
    finishProject(pursuit.id);
    if (user) void mirrorPursuit(user.id, { ...asProject, finishedAt: Date.now() });
  };

  const goal = asProject?.goal;
  const goalText = goal
    ? goal.shape === "number"
      ? goalProgressText(goal)
      : goal.shape === "date"
        ? goal.label
        : goal.label
    : undefined;

  const reachIt = () => {
    if (!asProject) return;
    markGoalReached(pursuit.id);
  };

  return (
    <div
      className={`group flex w-64 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] ${className}`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        {inspirationPost ? (
          <PostMedia
            media={inspirationPost.media}
            type={inspirationPost.type}
            hobbySlug={inspirationPost.hobbySlug}
            seed={inspirationPost.id}
            preview
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <GeneratedArt
            hobbySlug={pursuit.hobbySlug ?? "crafts-making"}
            seed={pursuit.id}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <span
          className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-md ${
            pursuit.finishedAt ? "bg-[var(--forest)]/80" : "bg-[var(--void)]/55"
          }`}
        >
          {status}
        </span>
        {owner && (
          <button
            type="button"
            onClick={toggleShare}
            title={
              justCopied
                ? "Link copied"
                : shared
                  ? "Shared on your profile (tap to make private)"
                  : "Private (tap to share and copy a link)"
            }
            aria-pressed={shared}
            className="absolute right-2.5 top-2.5 flex h-8 min-w-8 items-center gap-1.5 rounded-full bg-[var(--void)]/55 px-2.5 backdrop-blur-md transition-colors hover:bg-[var(--void)]/75"
          >
            {justCopied ? (
              <span className="text-[10px] font-medium text-white">Copied!</span>
            ) : shared ? (
              <Share2 className="size-3.5" strokeWidth={1.9} style={{ color: "white" }} />
            ) : (
              <Lock className="size-3.5" strokeWidth={1.9} style={{ color: "white" }} />
            )}
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-base leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          {pursuit.title}
        </p>
        {(pursuit.interest || spaceLabel) && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {[pursuit.interest, spaceLabel].filter(Boolean).join(" · ")}
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          {pursuit.finishedAt ? `Finished ${timeAgo(moved)}` : `Updated ${timeAgo(moved)}`}
        </p>

        {owner && (
          <button
            type="button"
            onClick={() => setGoalOpen(true)}
            className={`mt-2.5 flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
              goal
                ? goal.reachedAt
                  ? "border-border bg-surface-muted text-muted-foreground"
                  : "border-[var(--coral-deep)]/50 bg-[color-mix(in_srgb,var(--coral)_14%,var(--surface-elevated))] text-foreground hover:border-[var(--coral-deep)]"
                : "border-dashed border-border text-muted-foreground hover:border-[var(--violet-electric)] hover:text-foreground"
            }`}
          >
            <Target className="size-4 shrink-0" strokeWidth={1.8} />
            <span className={`truncate font-medium ${goal?.reachedAt ? "line-through decoration-1" : ""}`}>
              {goal ? (goal.reachedAt ? `Reached it — ${goalText}` : goalText) : "Set a goal"}
            </span>
          </button>
        )}

        {owner && (
          <div className="mt-3 flex items-center gap-2">
            <Link
              to={`/create?pursuit=${pursuit.id}`}
              className="flex-1 rounded-full border border-[var(--hairline)] bg-surface px-3 py-1.5 text-center text-xs font-medium text-foreground transition-colors hover:border-[var(--coral-deep)]"
            >
              Add progress
            </Link>
            {goal && !goal.reachedAt && (
              <button
                type="button"
                onClick={reachIt}
                title="Reached it"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--violet-electric)] hover:text-foreground"
              >
                <Target className="size-3.5" strokeWidth={2} />
              </button>
            )}
            {!pursuit.finishedAt && (
              <button
                type="button"
                onClick={markDone}
                title="Mark complete"
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-muted-foreground transition-colors hover:border-[var(--violet-electric)] hover:text-foreground"
              >
                <Check className="size-3.5" strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {owner && asProject && (
        <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={asProject} />
      )}
    </div>
  );
}

/** Icon used for empty-state "start one" prompts around Pursuits. */
export const PursuitIcon = Sparkles;
