import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft, ArrowRight, Check, Lock, Moon, PenLine, Play, Plus, Send, Share2, Target } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { SendToChatDialog } from "../components/SendToChatDialog";
import { useContent } from "../context/ContentContext";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { seedPosts, Post } from "../data/posts";
import {
  CHECK_IN_OPTIONS,
  DEFAULT_CHECK_IN_DAYS,
  Goal,
  Project,
  deriveProjects,
  goalDeadlineText,
  markGoalReached,
  pauseProject,
  pursuitStatus,
  resumeProject,
  setCheckInDays,
  setProjectShared,
  useJournalSlice,
} from "../lib/journal";
import {
  PursuitMoment,
  collectPursuitMoments,
  firstAndLatestPhoto,
  groupByMonth,
  startedLabel,
} from "../lib/pursuitTrail";
import { fetchPursuitById, mirrorPursuit, SharedPursuit } from "../lib/pursuitsRemote";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Button } from "../components/ui/button";
import { MomentCard, MOMENT_GRID } from "../components/MomentCard";
import { MomentDetail } from "../components/MomentDetail";
import { GoalDialog } from "../components/GoalDialog";
import { GoalProgressTap } from "../components/GoalProgressTap";
import { QuickLog } from "../components/QuickLog";
import { EndingDialog } from "../components/EndingDialog";
import { PursuitProgressPanel } from "../components/pursuit/PursuitProgressPanel";
import { ProgressBar } from "../components/pursuit/ui";
import { formatAmount, hasMeasure, unitFor } from "../lib/pursuitProgress";
import { usePursuitProgress } from "../lib/usePursuitProgress";

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
  pausedAt?: number;
  endingNote?: string;
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
  const { logs: privateLogs } = usePrivateLogs();
  const [goalOpen, setGoalOpen] = useState(false);
  const [endingOpen, setEndingOpen] = useState<null | "finish" | "edit">(null);
  const [logging, setLogging] = useState(false);
  const [searchParams] = useSearchParams();
  const isNew = searchParams.get("new") === "1";
  const [justCopied, setJustCopied] = useState(false);
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [sendToOpen, setSendToOpen] = useState(false);
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
        pausedAt: ownProject.pausedAt,
        endingNote: ownProject.endingNote,
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
        pausedAt: remote.data.pausedAt,
        endingNote: remote.data.endingNote,
        goal: remote.data.goal,
        shared: true,
        ownerName: remote.ownerName,
        ownerAvatar: remote.ownerAvatar,
      };
    }
    return undefined;
  }, [ownProject, demo, remote, profile]);

  // Every Moment on this Pursuit, oldest first — shared posts, plus (for
  // the owner only) their "Only you" entries, which used to sit in a
  // separate "Private reflections" box and never counted as progress.
  // Amount each Moment logged, keyed the same way as the timeline's keys —
  // so a Moment that didn't count toward progress can say so.
  const progressEntries = usePursuitProgress(ownProject && hasMeasure(ownProject) ? ownProject.id : undefined);
  const amountByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of progressEntries) {
      if (e.postId != null) m.set(`post-${e.postId}`, (m.get(`post-${e.postId}`) ?? 0) + e.amount);
      if (e.logId != null) m.set(`log-${e.logId}`, (m.get(`log-${e.logId}`) ?? 0) + e.amount);
    }
    return m;
  }, [progressEntries]);

  const moments: PursuitMoment[] = useMemo(() => {
    if (demo) {
      return [...demo.updates]
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((p) => ({
          key: `post-${p.id}`,
          createdAt: p.createdAt,
          image: p.type === "photo" ? (p.mediaUrls?.[0] ?? p.media) : undefined,
          text: p.caption ?? "",
          private: false,
          post: p,
        }));
    }
    if (!view) return [];
    return collectPursuitMoments(view.id, posts, entryProject, view.source === "own" ? privateLogs : []);
  }, [demo, view, posts, entryProject, privateLogs]);

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
  // A Pursuit you joined is in your journal too, but its goal, sharing and
  // ending belong to whoever created it.
  const isCreator = owner && ownProject?.role !== "member";
  const space = view.hobbySlug ? getHobby(view.hobbySlug) : undefined;
  const spaceLabel = space?.shortName ?? view.customSpace;
  const goal = view.goal;
  const status = pursuitStatus(view);
  const photos = firstAndLatestPhoto(moments);
  const months = groupByMonth(moments);

  // Progress toward a numeric goal is the goal's own tap-logged current —
  // see GoalProgressTap.tsx and journal.ts's logProgress.
  const goalCount = goal?.shape === "number" ? (goal.current ?? 0) : undefined;
  const goalReached =
    !!goal?.reachedAt || (goal?.shape === "number" && goal.targetNumber != null && goalCount! >= goal.targetNumber);

  const mirror = (p: Project | undefined) => {
    if (user && p) void mirrorPursuit(user.id, p);
  };

  const toggleShare = async () => {
    if (!owner || !ownProject) return;
    const next = !ownProject.shared;
    setProjectShared(ownProject.id, next);
    mirror({ ...ownProject, shared: next });
    if (next) {
      const url = window.location.href.replace(/[?&]new=1/, "");
      try {
        await navigator.clipboard.writeText(url);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
      } catch {
        // Clipboard can be unavailable — the Pursuit is shared either way.
      }
    }
  };

  const reachIt = () => {
    if (!owner || !ownProject) return;
    markGoalReached(ownProject.id);
  };

  const statusLine =
    status === "complete"
      ? `Finished ${timeAgo(view.finishedAt!)}`
      : status === "resting"
        ? `Resting since ${new Date(view.pausedAt!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : startedLabel(view.startedAt);

  // The goal as one plain sentence — "4 of 10 pieces · aiming for Nov 15".
  // No bar and no percentage, anywhere.
  const goalSentence = goal
    ? [
        goal.shape === "number" ? `${goalCount} of ${goal.targetNumber}${goal.unit ? ` ${goal.unit}` : ""}` : goal.label,
        goal.shape === "number" && goalDeadlineText(goal) ? `aiming for ${goalDeadlineText(goal)}` : undefined,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

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

        <div className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {view.interest && <span>{view.interest}</span>}
          {view.interest && spaceLabel && <span aria-hidden="true">·</span>}
          {spaceLabel && <span>{spaceLabel}</span>}
          {(view.interest || spaceLabel) && <span aria-hidden="true">·</span>}
          <span>{statusLine}</span>
          {moments.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                {moments.length} Moment{moments.length === 1 ? "" : "s"}
              </span>
            </>
          )}
        </div>

        {/* The ending note — "What would you tell yourself on day one?" —
            leads a finished Pursuit, above everything else. */}
        {status === "complete" && (view.endingNote || owner) && (
          <div className="mb-6 rounded-2xl border border-border bg-card p-5">
            <p className="ns-section-kicker mb-2 text-gold-text">To day one</p>
            {view.endingNote ? (
              <p className="whitespace-pre-wrap text-lg leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                {view.endingNote}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">What would you tell yourself on day one?</p>
            )}
            {owner && (
              <button type="button" onClick={() => setEndingOpen("edit")} className="mt-3 text-xs text-accent hover:underline">
                {view.endingNote ? "Edit" : "Write it"}
              </button>
            )}
          </div>
        )}

        {status === "resting" && owner && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm">
              <Moon className="size-4 shrink-0 text-muted-foreground" />
              Resting. Nothing's lost, and there's no clock running.
            </p>
            <Button variant="outline" size="sm" onClick={() => mirror(resumeProject(view.id))}>
              <Play className="size-3.5" /> Pick it back up
            </Button>
          </div>
        )}

        {/* ── Progress header ─────────────────────────────────────────── */}
        {ownProject && hasMeasure(ownProject) && (
          <PursuitProgressPanel project={ownProject} viewerIsOwner={ownProject.role !== "member"} />
        )}
        {goal && !(ownProject && hasMeasure(ownProject)) && (
          <div className="mb-4 rounded-2xl border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm">
              <Target className={`size-4 shrink-0 ${goalReached ? "text-[var(--violet-electric-bright)]" : "text-muted-foreground"}`} />
              {goalReached ? (
                <span>
                  Goal reached — <span className="text-muted-foreground">{goal.label}</span>
                </span>
              ) : (
                <span>{goalSentence}</span>
              )}
            </p>
            {!goalReached && goal.shape === "date" && goal.targetDate && (
              <p className="mt-1 pl-6 text-xs text-muted-foreground">
                {new Date(goal.targetDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
            {!goalReached && goal.shape === "number" && goal.targetNumber ? (
              <ProgressBar fraction={(goalCount ?? 0) / goal.targetNumber} className="mt-3" />
            ) : null}
            {!goalReached && goal.shape === "number" && goal.targetNumber && owner && ownProject && (
              <div className="mt-3">
                <GoalProgressTap project={ownProject} goal={goal} fullWidth />
              </div>
            )}
          </div>
        )}

        {photos && (
          <ComparePhotos first={photos.first} latest={photos.latest} owner={owner} />
        )}

        {/* A new Pursuit's empty state. There used to be a separate "Day
            Zero" box here with its own inline logger — a third way to add a
            Moment, next to Add a Moment. It's gone: the before-and-after
            already uses whichever Moment has the first photo, so the only
            thing worth keeping is the nudge to make that one a photo. */}
        {owner && ownProject && moments.length === 0 && (
          <div className={`mb-6 rounded-2xl border p-4 ${isNew ? "border-[var(--coral-deep)]" : "border-dashed border-border"}`}>
            <p className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
              Add your first Moment
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              A photo of where you're starting makes the best before-and-after later.
            </p>
            {!hasMeasure(ownProject) && (
              <Link to={`/pursuit/${ownProject.id}/moment`} className="mt-3 inline-block">
                <Button variant="coral" size="sm">
                  <Plus className="size-3.5" />
                  Add a Moment
                </Button>
              </Link>
            )}
          </div>
        )}

        {owner && ownProject && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {moments.length > 0 && !hasMeasure(ownProject) && (
                <Button variant="coral" size="sm" onClick={() => setLogging((v) => !v)} aria-expanded={logging}>
                  <Plus className="size-3.5" />
                  Add a Moment
                </Button>
              )}
              <Link to={`/create?pursuit=${view.id}`}>
                <Button variant="outline" size="sm">
                  <PenLine className="size-3.5" />
                  Full form
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={() => setSendToOpen(true)}>
                <Send className="size-3.5" />
                Send to…
              </Button>
              {isCreator && !hasMeasure(ownProject) && (
                <Button variant="outline" size="sm" onClick={() => setGoalOpen(true)}>
                  <Target className="size-3.5" />
                  {goal ? "Change goal" : "Set a goal"}
                </Button>
              )}
              {goal && !goal.reachedAt && !goalReached && (
                <Button variant="outline" size="sm" onClick={reachIt}>
                  Reached it
                </Button>
              )}
              {/* The label always names the action a click takes, never the
                  current state. */}
              {isCreator && (
              <Button variant="outline" size="sm" onClick={toggleShare} aria-pressed={view.shared}>
                {justCopied ? (
                  "Link copied!"
                ) : view.shared ? (
                  <>
                    <Lock className="size-3.5" />
                    Make private
                  </>
                ) : (
                  <>
                    <Share2 className="size-3.5" />
                    Share
                  </>
                )}
              </Button>
              )}
              {isCreator && status === "active" && (
                <Button variant="outline" size="sm" onClick={() => mirror(pauseProject(view.id))}>
                  <Moon className="size-3.5" />
                  Rest it
                </Button>
              )}
              {!isCreator ? null : status !== "complete" ? (
                <Button variant="outline" size="sm" onClick={() => setEndingOpen("finish")}>
                  <Check className="size-3.5" />
                  Mark complete
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => mirror(resumeProject(view.id))}>
                  <Play className="size-3.5" />
                  Reopen
                </Button>
              )}
            </div>

            {logging && (
              <div className="mb-4">
                <QuickLog pursuit={ownProject} onDone={() => setLogging(false)} />
              </div>
            )}

            {status === "active" && (
              <div className="mb-8 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Check in with me:</span>
                {CHECK_IN_OPTIONS.map((o) => {
                  const current = ownProject.checkInDays ?? DEFAULT_CHECK_IN_DAYS;
                  return (
                    <button
                      key={o.days}
                      type="button"
                      aria-pressed={current === o.days}
                      onClick={() => mirror(setCheckInDays(ownProject.id, o.days))}
                      className={`rounded-full border px-2.5 py-1 transition-colors ${
                        current === o.days ? "border-[var(--coral-deep)] text-foreground" : "border-border hover:text-foreground"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* A visitor (not the owner) gets no action row above at all — this
            is their one chance to share this Pursuit into a chat. */}
        {!owner && (
          <div className="mb-4">
            <Button variant="outline" size="sm" onClick={() => setSendToOpen(true)}>
              <Send className="size-3.5" />
              Send to…
            </Button>
          </div>
        )}

        {/* ── Timeline, grouped by month, newest first ───────────────── */}
        {moments.length === 0 ? (
          !owner && (
            <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
              <p className="text-sm text-muted-foreground">No Moments shared yet.</p>
            </div>
          )
        ) : (
          <div className="space-y-10">
            {months.map((month) => (
              <section key={month.key}>
                <MonthHeader label={month.label} moments={month.moments} />
                <div className={MOMENT_GRID}>
                  {month.moments.map((m) => {
                    const measure = ownProject && hasMeasure(ownProject) ? ownProject.measure : undefined;
                    const amount = amountByKey.get(m.key);
                    return (
                      <div key={m.key}>
                        {m.post ? (
                          <MomentCard post={m.post} surface="pursuit" size="standard" onOpen={() => setOpenPost(m.post!)} />
                        ) : (
                          <PrivateMomentCard moment={m} />
                        )}
                        {measure && owner && (
                          <p className={`mt-1.5 text-xs ${amount ? "text-foreground" : "text-muted-foreground"}`}>
                            {amount
                              ? `+${formatAmount(amount)} ${unitFor(measure, amount)}`
                              : "Not counted toward progress"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {owner && ownProject && (
        <>
          <GoalDialog open={goalOpen} onOpenChange={setGoalOpen} project={ownProject as Project} />
          <EndingDialog
            open={endingOpen !== null}
            onOpenChange={(o) => !o && setEndingOpen(null)}
            project={ownProject}
            mode={endingOpen ?? "finish"}
            firstImage={photos?.first.image}
          />
        </>
      )}

      <MomentDetail
        post={openPost}
        owned={!!user && openPost?.userId === user.id}
        onOpenChange={(o) => !o && setOpenPost(null)}
      />

      <SendToChatDialog open={sendToOpen} onOpenChange={setSendToOpen} kind="pursuit" pursuitId={view.id} />
    </div>
  );
}

function shortDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * "Where you started → where you are": the first photo next to the latest.
 * With only one photo so far, the second slot says what goes there instead
 * of sitting empty.
 */
function ComparePhotos({
  first,
  latest,
  owner,
}: {
  first: PursuitMoment;
  latest?: PursuitMoment;
  owner: boolean;
}) {
  return (
    <figure className="mb-6">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3">
        <PhotoTile moment={first} caption={`Day one · ${shortDate(first.createdAt)}`} />
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
        {latest ? (
          <PhotoTile moment={latest} caption={`Latest · ${shortDate(latest.createdAt)}`} />
        ) : (
          <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {owner ? "Your next photo goes here" : "More to come"}
          </div>
        )}
      </div>
      <figcaption className="mt-2 text-center text-xs text-muted-foreground">
        {owner ? "Where you started → where you are" : "Where it started → where it is"}
      </figcaption>
    </figure>
  );
}

function PhotoTile({ moment, caption }: { moment: PursuitMoment; caption: string }) {
  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-xl bg-surface-muted">
        <img src={moment.image} alt={moment.text || caption} className="size-full object-cover" />
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">{caption}</p>
    </div>
  );
}

/**
 * A month's heading, with a look-back built only from the maker's own
 * Moments: that month's first and last photo and its most recent line.
 * No count — "6 Moments" reads as a score, and one Moment is not a failure.
 */
function MonthHeader({ label, moments }: { label: string; moments: PursuitMoment[] }) {
  // moments arrive newest first
  const withImage = moments.filter((m) => m.image);
  const newest = withImage[0];
  const oldest = withImage[withImage.length - 1];
  const line = moments.find((m) => m.text.trim())?.text.trim();
  const showLookBack = moments.length > 1 && (withImage.length > 1 || !!line);

  return (
    <div className="mb-4">
      <h2 className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>
        {label}
      </h2>
      {showLookBack && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-card p-3">
          {withImage.length > 1 && (
            <div className="flex shrink-0 items-center gap-1">
              <img src={oldest.image} alt="" className="size-10 rounded-md object-cover" />
              <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
              <img src={newest.image} alt="" className="size-10 rounded-md object-cover" />
            </div>
          )}
          {line && (
            <p className="min-w-0 text-sm italic text-foreground/90 line-clamp-2">
              “{line}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** An "Only you" Moment — owner's eyes only, marked as such. */
function PrivateMomentCard({ moment }: { moment: PursuitMoment }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Lock className="size-3" /> Only you · {shortDate(moment.createdAt)}
      </p>
      {moment.image && <img src={moment.image} alt="" className="mb-2 aspect-square w-full rounded-xl object-cover" />}
      <p className="whitespace-pre-wrap text-sm">{moment.text}</p>
    </div>
  );
}
