import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Check, Lock, PenLine, Share2, Sparkles, Target } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { seedPosts, Post } from "../data/posts";
import {
  Goal,
  Project,
  deriveProjects,
  finishProject,
  markGoalReached,
  setProjectShared,
  useJournalSlice,
} from "../lib/journal";
import { fetchPursuitById, mirrorPursuit, SharedPursuit } from "../lib/pursuitsRemote";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { ContentCard } from "../components/ContentCard";
import { GoalDialog } from "../components/GoalDialog";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(ts: number) {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30.44);
  return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/** What every source (the owner's own local journal, a shared row from
 * Supabase, or a demo Pursuit derived from sample content) gets normalized
 * into, so the rest of this page doesn't need to know which one it's
 * looking at. */
interface PursuitView {
  source: "own" | "shared" | "demo";
  id: string;
  title: string;
  hobbySlug?: string;
  interest?: string;
  customSpace?: string;
  startedAt: number;
  finishedAt?: number;
  goal?: Goal;
  shared?: boolean;
  ownerName: string;
  ownerAvatar?: string;
}

/**
 * A Pursuit's own place — not a Corner-filtered Space feed standing in for
 * one. Three sources, tried in order, normalized into one PursuitView:
 *
 *   1. The owner's own local journal (lib/journal.ts) — instant, works
 *      offline, the source of truth for the owner's own browser.
 *   2. A shared row from Supabase (sql/pursuits.sql) — someone else's
 *      Pursuit, or the owner's own on a different device than the one that
 *      created it (that case is shown read-only: local-journal actions
 *      like setProjectGoal only ever touch local state, so a Pursuit this
 *      browser doesn't have locally can't honestly offer them yet).
 *   3. A demo Pursuit derived the same way Home.tsx's own sample section
 *      already does (deriveProjects over seed content), keyed by that
 *      derivation's own key — what a logged-out landing page's "View
 *      Pursuit" links resolve to, since there's no real row to point at.
 */
export function Pursuit() {
  const { id = "" } = useParams();
  const { user, profile } = useAuth();
  const { posts } = useContent();
  const entryProject = useJournalSlice((s) => s.entryProject);
  const projects = useJournalSlice((s) => s.projects);
  const privateLogs = useJournalSlice((s) => s.privateLogs);
  const [goalOpen, setGoalOpen] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const [remote, setRemote] = useState<
    { status: "idle" | "loading" | "not-found" } | { status: "found"; data: SharedPursuit; ownerName: string; ownerAvatar?: string }
  >({ status: "idle" });

  const ownProject = useMemo(() => projects.find((p) => p.id === id), [projects, id]);

  const demo = useMemo(() => {
    if (ownProject) return undefined;
    const derived = deriveProjects(seedPosts, subHobbyLabel).find((p) => p.key === id);
    return derived;
  }, [ownProject, id]);

  // The remote lookup is the only async path — only needed when neither the
  // fast local nor the fast demo match already answered the question.
  useEffect(() => {
    if (ownProject || demo) return;
    if (!supabase) {
      setRemote({ status: "not-found" });
      return;
    }
    let cancelled = false;
    setRemote({ status: "loading" });
    (async () => {
      const data = await fetchPursuitById(id);
      if (cancelled) return;
      if (!data) {
        setRemote({ status: "not-found" });
        return;
      }
      const { data: profileRow } = await supabase!
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", data.userId)
        .maybeSingle();
      if (cancelled) return;
      setRemote({
        status: "found",
        data,
        ownerName: profileRow?.display_name?.trim() || "Someone",
        ownerAvatar: profileRow?.avatar_url ?? undefined,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, ownProject, demo]);

  const view: PursuitView | undefined = useMemo(() => {
    if (ownProject) {
      return {
        source: "own",
        id: ownProject.id,
        title: ownProject.title,
        hobbySlug: ownProject.hobbySlug,
        interest: ownProject.interest,
        customSpace: ownProject.customSpace,
        startedAt: ownProject.startedAt,
        finishedAt: ownProject.finishedAt,
        goal: ownProject.goal,
        shared: ownProject.shared,
        ownerName: profile?.display_name?.trim() || "You",
        ownerAvatar: profile?.avatar_url,
      };
    }
    if (demo) {
      return {
        source: "demo",
        id: demo.key,
        title: demo.title,
        hobbySlug: demo.hobbySlug,
        startedAt: demo.updates[demo.updates.length - 1]?.createdAt ?? demo.lastUpdatedAt,
        ownerName: demo.creator,
      };
    }
    if (remote.status === "found") {
      return {
        source: "shared",
        id: remote.data.id,
        title: remote.data.title,
        hobbySlug: remote.data.hobbySlug,
        interest: remote.data.interest,
        customSpace: remote.data.customSpace,
        startedAt: remote.data.startedAt,
        finishedAt: remote.data.finishedAt,
        goal: remote.data.goal,
        shared: true,
        ownerName: remote.ownerName,
        ownerAvatar: remote.ownerAvatar,
      };
    }
    return undefined;
  }, [ownProject, demo, remote, profile]);

  const updates: Post[] = useMemo(() => {
    if (demo) return demo.updates;
    if (!view) return [];
    return posts
      .filter((p) => p.pursuitId === view.id || entryProject[String(p.id)] === view.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [demo, view, posts, entryProject]);

  const reflections = useMemo(
    () => (view?.source === "own" ? privateLogs.filter((l) => l.projectId === view.id) : []),
    [view, privateLogs],
  );

  const loading = !view && remote.status === "loading";
  const notFound = !view && remote.status === "not-found";

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Looking…</p>
      </div>
    );
  }

  if (notFound || !view) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          This Pursuit isn't here.
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          It may have been kept private, or the link's out of date.
        </p>
        <Link to="/discover" className="mt-2">
          <Button variant="outline">Back to Discover</Button>
        </Link>
      </div>
    );
  }

  const owner = view.source === "own";
  const space = view.hobbySlug ? getHobby(view.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? view.customSpace;
  const goal = view.goal;

  // The task's own spec for a count goal: progress is the actual number of
  // attached updates, not a separately-tracked number someone has to keep
  // in sync by hand (that manual --/++ number, goal.current, still exists
  // for PursuitCard's own "+1" button elsewhere — this page just doesn't
  // use it, so the two numbers can't quietly disagree here).
  const goalCount = goal?.shape === "number" ? updates.length : undefined;
  const goalReached =
    !!goal?.reachedAt || (goal?.shape === "number" && goal.targetNumber != null && goalCount! >= goal.targetNumber);

  const toggleShare = async () => {
    if (!owner || !ownProject) return;
    const next = !ownProject.shared;
    setProjectShared(ownProject.id, next);
    if (user) void mirrorPursuit(user.id, { ...ownProject, shared: next });
    if (next) {
      const url = window.location.href;
      try {
        await navigator.clipboard.writeText(url);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        // Clipboard can be unavailable — the Pursuit is shared either way.
      }
    }
  };

  const markDone = () => {
    if (!owner || !ownProject) return;
    finishProject(ownProject.id);
    if (user) void mirrorPursuit(user.id, { ...ownProject, finishedAt: Date.now() });
  };

  const reachIt = () => {
    if (!owner || !ownProject) return;
    markGoalReached(ownProject.id);
  };

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="container mx-auto max-w-2xl px-4 pt-8">
        <Link
          to={owner ? "/my-space" : "/discover"}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>

        <div className="mb-2 flex items-center gap-2.5">
          <Avatar className="size-7">
            {view.ownerAvatar && <AvatarImage src={view.ownerAvatar} alt="" className="object-cover" />}
            <AvatarFallback className="text-[10px]">{initials(view.ownerName)}</AvatarFallback>
          </Avatar>
          <span className="text-sm text-muted-foreground">{view.ownerName}</span>
        </div>

        <h1 className="mb-2 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          {view.title}
        </h1>

        <div className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {view.interest && <span>{view.interest}</span>}
          {view.interest && spaceLabel && <span aria-hidden="true">·</span>}
          {spaceLabel && <span>{spaceLabel}</span>}
          {(view.interest || spaceLabel) && <span aria-hidden="true">·</span>}
          <span>{view.finishedAt ? `Finished ${timeAgo(view.finishedAt)}` : `Started ${timeAgo(view.startedAt)}`}</span>
        </div>

        {goal && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-4">
            {goalReached ? (
              <p className="flex items-center gap-2 text-sm">
                <Target className="size-4 shrink-0 text-[var(--violet-electric-bright)]" />
                <span>
                  Goal reached — <span className="text-muted-foreground">{goal.label}</span>
                </span>
              </p>
            ) : (
              <>
                <p className="mb-2 flex items-center gap-2 text-sm">
                  <Target className="size-4 shrink-0 text-muted-foreground" />
                  {goal.shape === "number"
                    ? `${goalCount} of ${goal.targetNumber}${goal.unit ? ` ${goal.unit}` : ""}`
                    : goal.label}
                </p>
                {goal.shape === "number" && goal.targetNumber ? (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full [background-color:var(--violet-electric)]"
                      style={{ width: `${Math.min(100, (goalCount! / goal.targetNumber) * 100)}%` }}
                    />
                  </div>
                ) : goal.shape === "date" && goal.targetDate ? (
                  <p className="text-xs text-muted-foreground">
                    {new Date(goal.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                ) : null}
              </>
            )}
          </div>
        )}

        {owner && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <Link to={`/create?pursuit=${view.id}`}>
              <Button variant="coral" size="sm">
                <PenLine className="size-3.5" />
                Add progress
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>
              <Target className="size-3.5" />
              {goal ? "Change goal" : "Set a goal"}
            </Button>
            {goal && !goal.reachedAt && !goalReached && (
              <Button variant="outline" size="sm" onClick={reachIt}>
                Reached it
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleShare}>
              {justCopied ? "Link copied!" : view.shared ? <Share2 className="size-3.5" /> : <Lock className="size-3.5" />}
              {justCopied ? "" : view.shared ? "Shared" : "Private"}
            </Button>
            {!view.finishedAt && (
              <Button variant="outline" size="sm" onClick={markDone}>
                <Check className="size-3.5" />
                Mark complete
              </Button>
            )}
          </div>
        )}

        {owner && reflections.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Lock className="size-3.5" />
              Private reflections — visible only to you
            </h2>
            <ul className="space-y-2">
              {reflections.map((log) => (
                <li key={log.id} className="rounded-2xl border border-border bg-card p-3.5 text-sm">
                  <p className="whitespace-pre-wrap">{log.note}</p>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{timeAgo(log.createdAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          {updates.length > 0 ? `${updates.length} update${updates.length === 1 ? "" : "s"}` : "Updates"}
        </h2>

        {updates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
            <Sparkles className="mx-auto mb-3 size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2">
            {updates.map((post) => (
              <ContentCard key={post.id} post={post} compact />
            ))}
          </div>
        )}
      </div>

      {owner && ownProject && (
        <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={ownProject as Project} />
      )}
    </div>
  );
}
