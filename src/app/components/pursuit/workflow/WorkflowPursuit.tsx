import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Check,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import { usePrivateLogs } from "../../../context/PrivateLogsContext";
import { useContent } from "../../../context/ContentContext";
import { ImageWithFallback } from "../../ImageWithFallback";
import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../../lib/supabase";
import { ReportDialog } from "../../ReportDialog";
import { BlockConfirmDialog } from "../../BlockConfirmDialog";
import {
  addJoinedProject,
  dropProject,
  projectWorkflowProgress,
  useJournalSlice,
  type Project,
} from "../../../lib/journal";
import {
  type Contribution,
  type Discussion,
  type Meeting,
  type PersonalGoal,
  type Workflow,
  canChangeTracking,
  progressFor,
  validateContribution,
  validateWorkflow,
  weeklyOccurrences,
  shiftOccurrence,
  workflowOf,
} from "../../../lib/pursuitWorkflow";
import {
  measureFor,
  newWorkflowId,
  saveWorkflowProject,
  useWorkflowData,
} from "../../../lib/pursuitWorkflowStore";
import { usePursuitMembers } from "../../../lib/usePursuitProgress";
import { formatDate, formatDateTime, formatWhen } from "../../../lib/dates";
import { formatAmount, toDateInput } from "../../../lib/pursuitProgress";
import { plural } from "../../../lib/plural";
import { Button } from "../../ui/button";
import { BottomSheet } from "../../ui/BottomSheet";
import { GoalFields, Field, fieldClass } from "./GoalFields";
import { PersonAvatar } from "../../../pages/CreatePursuit";
import { fetchPursuitAsProject } from "../../../lib/pursuitsRemote";
import {
  compatibleProject,
  legacyLabel,
} from "../../../lib/pursuitCompatibility";
import { NextSessionCard } from "../NextSessionCard";
import { usePeopleSearch } from "../../../lib/people";

const panel = "rounded-card border border-border bg-card p-4 tab:p-5";
const action =
  "inline-flex min-h-11 items-center gap-2 text-small underline underline-offset-4";
type Sheet =
  | null
  | "progress"
  | "edit"
  | "personal"
  | "session"
  | "finish"
  | "people";
export function WorkflowPursuit({ project: initial }: { project: Project }) {
  const navigate = useNavigate();
  const [reportUser, setReportUser] = useState("");
  const [blockUser, setBlockUser] = useState("");
  const { posts } = useContent();
  const { logs: privateLogs } = usePrivateLogs();
  const privateMoments = privateLogs.filter(
    (log) => log.projectId === initial.id,
  );
  const { user, profile } = useAuth();
  const uid = user?.id ?? "local";
  const [project, setProject] = useState(initial);
  const w = workflowOf(project)!;
  const shared = project.mode !== "solo";
  const collective = project.mode === "group";
  const host =
    !user ||
    project.ownerId === user.id ||
    (!project.ownerId && project.role !== "member");
  const {
    data,
    loading,
    error: loadError,
    retry,
    put,
  } = useWorkflowData(project.id, !!user, w.legacy ? project : undefined, uid);
  const [membersVersion, setMembersVersion] = useState(0);
  const members = usePursuitMembers(
    project,
    {
      userId: project.ownerId ?? uid,
      displayName: host ? profile?.display_name || "You" : "Owner",
      status: "joined",
      role: "owner",
    },
    membersVersion,
  );
  const people = members.length
    ? members
    : [
        {
          userId: uid,
          displayName: "You",
          status: "joined" as const,
          role: "owner" as const,
        },
      ];
  const name = (id: string) =>
    id === uid
      ? "You"
      : (people.find((p) => p.userId === id)?.displayName ?? "Someone");
  const cachedProject = useJournalSlice((state) =>
    state.projects.find((p) => p.id === project.id),
  );
  const privatePlan = cachedProject ?? initial;
  const entryProject = useJournalSlice((state) => state.entryProject);
  const moments = posts.filter(
    (p) =>
      p.pursuitId === project.id || entryProject[String(p.id)] === project.id,
  );
  const personal = data.goals.find((g) => g.user_id === uid);
  useEffect(() => {
    if (loading || loadError || w.legacy) return;
    const rows = data.contributions
      .filter((e) => collective || e.user_id === uid)
      .filter(
        (e) =>
          w.tracking !== "checklist" ||
          w.items.some((i) => i.id === e.item_id && !i.archived),
      )
      .map((e) => ({
        id: e.id,
        projectId: project.id,
        userId: e.user_id,
        amount: e.amount,
        createdAt: Date.parse(e.occurred_at),
        postId: e.post_id ?? undefined,
        note: e.note,
      }));
    projectWorkflowProgress(
      project.id,
      rows,
      collective ? undefined : personal,
    );
  }, [data, loading, loadError, collective, uid, project.id, w, personal]);

  const status = collective
    ? project.finishedAt || project.letGoAt
      ? "finished"
      : project.pausedAt
        ? "paused"
        : "active"
    : (personal?.status ??
      (project.finishedAt || project.letGoAt
        ? "finished"
        : project.pausedAt
          ? "paused"
          : "active"));
  const summary = progressFor(
    w,
    !user && w.legacy?.kind === "moments"
      ? moments.map((p) => ({
          id: `moment:${p.id}`,
          pursuit_id: project.id,
          user_id: uid,
          amount: 1,
          occurred_at: new Date(p.createdAt).toISOString(),
          created_at: new Date(p.createdAt).toISOString(),
          note: "",
          post_id: p.id,
        }))
      : data.contributions,
    collective ? undefined : uid,
    collective ? w.target : personal ? personal.target : w.target,
  );
  const [tab, setTab] = useState("progress");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    const refreshProject = async () => {
      if (document.hidden || guard.current) return;
      const latest = await fetchPursuitAsProject(project.id);
      if (live && latest && !latest.plan) {
        const updated = compatibleProject({ ...latest, role: project.role });
        setProject(updated);
        if (!workflowOf(updated)?.legacy) addJoinedProject(updated);
      }
    };
    void refreshProject();
    const timer = window.setInterval(() => void refreshProject(), 15000);
    window.addEventListener("focus", refreshProject);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshProject);
    };
  }, [project.id, user?.id]);

  const [thread, setThread] = useState<string | null>(null);
  const [reply, setReply] = useState<Discussion | null>(null);
  const [text, setText] = useState("");
  const messageId = useRef(newWorkflowId());
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toDateInput(Date.now()));
  const [itemId, setItemId] = useState("");
  const [postId, setPostId] = useState("");
  const [entry, setEntry] = useState<Contribution | null>(null);
  const entryId = useRef(newWorkflowId());
  const entryCreatedAt = useRef(new Date().toISOString());
  const [draft, setDraft] = useState<Workflow>(w);
  const [title, setTitle] = useState(project.title);
  const [personalTarget, setPersonalTarget] = useState("");
  const [personalDate, setPersonalDate] = useState("");
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [sessionTitle, setSessionTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [place, setPlace] = useState("");
  const [sessionNote, setSessionNote] = useState("");
  const [repeat, setRepeat] = useState(false);
  const [repeatEnd, setRepeatEnd] = useState("");
  const [scope, setScope] = useState("one");
  const [query, setQuery] = useState("");
  const { people: searchResults } = usePeopleSearch(query);
  const sessionIds = useRef<string[]>([]);
  const sessionSeriesId = useRef(newWorkflowId());
  async function run(fn: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  function openProgress(existing?: Contribution, session?: Meeting) {
    setPostId(existing?.post_id ? String(existing.post_id) : "");
    setEntry(existing ?? null);
    entryId.current = existing?.id ?? newWorkflowId();
    entryCreatedAt.current = existing?.created_at ?? new Date().toISOString();
    setAmount(String(existing?.amount ?? project.measure?.defaultAmount ?? 1));
    setNote(existing?.note ?? "");
    setDate(
      toDateInput(existing ? Date.parse(existing.occurred_at) : Date.now()),
    );
    setItemId(existing?.item_id ?? "");
    setMeeting(session ?? null);
    setSheet("progress");
    setError("");
  }
  function openSession(existing?: Meeting) {
    setMeeting(existing ?? null);
    setSessionTitle(existing?.title ?? "");
    const d = existing ? new Date(existing.starts_at) : new Date();
    setStarts(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
    setPlace(existing?.place ?? "");
    setSessionNote(existing?.note ?? "");
    setRepeat(false);
    setRepeatEnd("");
    setScope("one");
    sessionIds.current = [];
    sessionSeriesId.current = newWorkflowId();
    setSheet("session");
  }
  async function saveProgress() {
    if (!date || !Number.isFinite(Date.parse(`${date}T12:00:00`)))
      throw new Error("Choose a valid date.");
    const row: Contribution = {
      id: entryId.current,
      pursuit_id: project.id,
      user_id: uid,
      amount: w.tracking === "total" ? Number(amount) : 1,
      occurred_at: entry?.legacy_id
        ? entry.occurred_at
        : new Date(`${date}T12:00:00`).toISOString(),
      created_at: entryCreatedAt.current,
      note: note.trim(),
      legacy_id: entry?.legacy_id,
      post_id: postId ? Number(postId) : null,
      item_id: w.tracking === "checklist" ? itemId : null,
      session_id: meeting?.id ?? entry?.session_id ?? null,
    };
    validateContribution(w, row);
    const duplicate = data.contributions.find(
      (e) =>
        e.id !== row.id &&
        (collective || e.user_id === uid) &&
        ((row.item_id && e.item_id === row.item_id) ||
          (row.session_id &&
            w.tracking === "sessions" &&
            e.session_id === row.session_id)),
    );
    if (duplicate) throw new Error("This is already recorded.");
    await put("contributions", [row]);
    setSheet(null);
  }
  function goalRow(patch: Partial<PersonalGoal>): PersonalGoal {
    return {
      pursuit_id: project.id,
      user_id: uid,
      target: personal ? personal.target : (w.target ?? null),
      finish_by: personal ? personal.finish_by : (w.finishBy ?? null),
      status: personal?.status ?? status,
      muted: personal?.muted ?? false,
      reminder_minutes: personal?.reminder_minutes ?? null,
      ...patch,
    };
  }
  async function changeStatus(next: PersonalGoal["status"]) {
    if (collective) {
      const updated = {
        ...project,
        finishedAt: next === "finished" ? Date.now() : undefined,
        pausedAt: next === "paused" ? Date.now() : undefined,
        letGoAt: undefined,
      };
      if (project.letGoAt && user && supabase) {
        const result = await supabase
          .from("pursuits")
          .update({ let_go_at: null })
          .eq("id", project.id);
        if (result.error)
          throw new Error("Changes couldn’t be saved. Try again.");
      }
      await saveWorkflowProject(updated, !!user);
      setProject(updated);
    } else await put("goals", [goalRow({ status: next })]);
    setSheet(null);
  }
  async function sendMessage() {
    if (!text.trim()) return;
    const mentions = people
      .filter(
        (p) => p.userId && text.includes(`@${p.username || p.displayName}`),
      )
      .map((p) => p.userId!);
    await put("messages", [
      {
        id: messageId.current,
        pursuit_id: project.id,
        user_id: uid,
        body: text.trim(),
        thread: thread ?? "chat",
        parent_id: reply?.id ?? null,
        mentions,
        created_at: new Date().toISOString(),
      },
    ]);
    messageId.current = newWorkflowId();
    setText("");
    setReply(null);
  }
  async function saveSession() {
    if (!sessionTitle.trim()) throw new Error("Name your session.");
    const occurrences = weeklyOccurrences(
      starts,
      repeat ? repeatEnd : undefined,
    );
    if (repeat && !repeatEnd) throw new Error("Choose a repeat end date.");
    const series = meeting?.series_id ?? sessionSeriesId.current;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let rows: Meeting[];
    if (meeting) {
      rows = data.sessions
        .filter(
          (s) =>
            s.id === meeting.id ||
            (scope === "future" &&
              s.series_id === meeting.series_id &&
              s.starts_at >= meeting.starts_at),
        )
        .map((s) => ({
          ...s,
          title: sessionTitle.trim(),
          starts_at: shiftOccurrence(
            s.starts_at,
            meeting.starts_at,
            new Date(starts).toISOString(),
            s.timezone,
          ),
          place,
          note: sessionNote,
        }));
    } else
      rows = occurrences.map((when, index) => ({
        id:
          sessionIds.current[index] ??
          (sessionIds.current[index] = newWorkflowId()),
        pursuit_id: project.id,
        user_id: uid,
        title: sessionTitle.trim(),
        starts_at: when,
        place,
        note: sessionNote,
        series_id: series,
        timezone,
        cancelled: false,
      }));
    await put("sessions", rows);
    setSheet(null);
  }
  function comments(key: string) {
    setThread(key);
    setReply(null);
    setText("");
  }
  function progressText(current: number, target?: number) {
    if (!w.unit && w.legacy)
      return target != null
        ? `${formatAmount(current)} of ${formatAmount(target)}`
        : formatAmount(current);
    const unit =
      w.tracking === "sessions"
        ? "sessions"
        : w.tracking === "checklist"
          ? "items"
          : w.unit;
    return target != null
      ? `${formatAmount(current)} of ${plural(target, unit === "sessions" ? "session" : unit === "items" ? "item" : unit, unit)}`
      : `${formatAmount(current)} ${unit}`;
  }
  const sortedSessions = data.sessions
    .filter((s) => !s.cancelled)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const now = new Date().toISOString();
  const upcoming = [
    ...sortedSessions.filter((s) => s.starts_at >= now).slice(0, 3),
    ...sortedSessions
      .filter((s) => s.starts_at < now)
      .slice(-2)
      .reverse(),
  ];
  const conversation = data.messages
    .filter((m) => m.thread === (thread ?? "chat"))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const due = collective
    ? w.finishBy
    : personal
      ? personal.finish_by
      : w.finishBy;
  return (
    <main className="mx-auto w-full max-w-[calc(680px+2rem)] tab:max-w-[calc(680px+3rem)] desk:max-w-[calc(680px+4rem)] px-4 pb-32 pt-6 tab:px-6 desk:px-8">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/my-space" className={action}>
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Button
          variant="ghost"
          aria-label="Pursuit options"
          onClick={() => {
            setTitle(project.title);
            setDraft(structuredClone(w));
            setSheet("edit");
          }}
        >
          <MoreHorizontal />
        </Button>
      </div>
      <h1 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
        {project.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {people
          .filter((p) => p.status === "joined")
          .map((p) => (
            <span
              key={p.userId}
              className="flex items-center gap-2 text-caption"
            >
              <PersonAvatar name={p.displayName} src={p.avatarUrl} />
              {p.userId === uid ? "You" : p.displayName}
            </span>
          ))}
      </div>
      {shared && (
        <div
          role="tablist"
          aria-label="Pursuit"
          className="my-6 flex rounded-control border border-border p-1"
        >
          {["progress", "chat"].map((value) => (
            <button
              key={value}
              role="tab"
              id={`pursuit-tab-${value}`}
              aria-selected={tab === value}
              tabIndex={tab === value ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "progress"
                    : event.key === "End"
                      ? "chat"
                      : value === "progress"
                        ? "chat"
                        : "progress";
                setTab(next);
                (
                  event.currentTarget.parentElement?.querySelector(
                    `#pursuit-tab-${next}`,
                  ) as HTMLButtonElement | null
                )?.focus();
              }}
              aria-controls={`pursuit-${value}`}
              className={`min-h-11 flex-1 rounded-control text-small ${tab === value ? "bg-surface-muted font-semibold" : ""}`}
              onClick={() => setTab(value)}
            >
              {value === "progress" ? "Progress" : "Chat"}
            </button>
          ))}
        </div>
      )}
      {loading && (
        <p role="status" className="my-6 text-small text-muted-foreground">
          Loading…
        </p>
      )}
      {loadError && (
        <div role="alert" className={`${panel} my-6`}>
          <p>{loadError}</p>
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      )}
      {error && !sheet && !thread && (
        <p role="alert" className="my-4 text-small text-destructive">
          {error}
        </p>
      )}
      {!loading && !loadError && (
        <>
          {data.notices.filter((n) => !n.read_at).length > 0 && (
            <aside className={`${panel} my-4`}>
              <h2 className="text-small font-semibold">Notifications</h2>
              {data.notices
                .filter((n) => !n.read_at)
                .map((n) => (
                  <p key={n.id} className="mt-2 text-small">
                    {n.body}
                  </p>
                ))}
              <button
                className={action}
                onClick={() =>
                  void run(async () => {
                    await put(
                      "notices",
                      data.notices
                        .filter((n) => !n.read_at)
                        .map((n) => ({
                          ...n,
                          read_at: new Date().toISOString(),
                        })),
                    );
                  })
                }
              >
                Mark as read
              </button>
            </aside>
          )}
          {tab === "progress" ? (
            <div
              id="pursuit-progress"
              role="tabpanel"
              className="mt-6 space-y-6"
            >
              <section className={panel}>
                <div className="flex items-center justify-between">
                  <h2 className="text-small font-medium">
                    {collective ? "Shared goal" : "Your goal"}
                  </h2>
                  {status !== "active" && (
                    <span className="text-caption">
                      {status === "finished" ? "Finished" : "Paused"}
                    </span>
                  )}
                </div>
                {w.legacy && legacyLabel(project) && (
                  <p className="mt-3 text-small text-muted-foreground">
                    {legacyLabel(project)}
                  </p>
                )}
                {w.legacy?.measure?.milestones?.filter(Boolean).length ? (
                  <ul className="mt-3 list-inside list-disc text-small">
                    {w.legacy.measure.milestones
                      .filter(Boolean)
                      .map((name, index) => (
                        <li key={index}>{name}</li>
                      ))}
                  </ul>
                ) : null}
                {w.tracking !== "updates" ? (
                  <>
                    <p className="mt-3 text-title">
                      {progressText(summary.current, summary.target)}
                    </p>
                    {summary.target != null && (
                      <div
                        role="progressbar"
                        aria-label="Progress"
                        aria-valuenow={summary.current}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(
                          summary.target,
                          summary.current,
                        )}
                        className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"
                      >
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${summary.fraction * 100}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-small text-muted-foreground">
                    Share how it’s going without counting progress.
                  </p>
                )}
                {due && (
                  <p className="mt-3 text-caption text-muted-foreground">
                    Finish by {formatDate(`${due}T12:00:00`)}
                  </p>
                )}
                {summary.reached && (
                  <p className="mt-3 flex items-center gap-2 text-small">
                    <Check className="size-4" />
                    Target reached
                  </p>
                )}
                {status === "active" ? (
                  w.tracking === "updates" || w.legacy?.kind === "moments" ? (
                    <Link
                      to={`/create?pursuit=${project.id}`}
                      className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-accent text-small font-semibold text-accent-foreground"
                    >
                      Log a Moment
                    </Link>
                  ) : (
                    <Button
                      variant="coral"
                      className="mt-4 min-h-11 w-full"
                      onClick={() => openProgress()}
                    >
                      <Plus />
                      Add progress
                    </Button>
                  )
                ) : (
                  <Button
                    variant="outline"
                    className="mt-4 min-h-11"
                    disabled={busy || (collective && !host)}
                    onClick={() => void run(() => changeStatus("active"))}
                  >
                    {status === "paused" ? "Resume" : "Reopen"}
                  </Button>
                )}
                {status === "finished" && (
                  <Button
                    variant="outline"
                    className="mt-3 min-h-11"
                    onClick={() =>
                      void run(async () => {
                        const text = `${project.title}: ${w.tracking === "updates" ? "Finished" : progressText(summary.current, summary.target)}`;
                        if (navigator.share)
                          await navigator.share({ title: project.title, text });
                        else await navigator.clipboard.writeText(text);
                      })
                    }
                  >
                    Share recap
                  </Button>
                )}
                {!collective && (
                  <button
                    className={action}
                    onClick={() => {
                      setPersonalTarget(
                        String(
                          personal ? (personal.target ?? "") : (w.target ?? ""),
                        ),
                      );
                      setPersonalDate(
                        personal
                          ? (personal.finish_by ?? "")
                          : (w.finishBy ?? ""),
                      );
                      setSheet("personal");
                    }}
                  >
                    Edit your goal
                  </button>
                )}
                {w.tracking === "checklist" && (
                  <ul className="mt-4 divide-y divide-border">
                    {w.items
                      .filter((i) => !i.archived)
                      .map((i) => {
                        const completed = data.contributions.find(
                          (e) =>
                            e.item_id === i.id &&
                            (collective || e.user_id === uid),
                        );
                        return (
                          <li
                            key={i.id}
                            className="flex min-h-11 items-center gap-3"
                          >
                            <input
                              type="checkbox"
                              aria-label={i.title}
                              checked={!!completed}
                              disabled={busy || status !== "active"}
                              onChange={() =>
                                completed
                                  ? void run(async () => {
                                      await put(
                                        "contributions",
                                        [],
                                        completed.id,
                                      );
                                    })
                                  : void run(async () => {
                                      const now = new Date().toISOString();
                                      await put("contributions", [
                                        {
                                          id: newWorkflowId(),
                                          pursuit_id: project.id,
                                          user_id: uid,
                                          amount: 1,
                                          occurred_at: now,
                                          created_at: now,
                                          note: "",
                                          item_id: i.id,
                                        },
                                      ]);
                                    })
                              }
                            />
                            <span
                              className={
                                completed
                                  ? "text-muted-foreground line-through"
                                  : ""
                              }
                            >
                              {i.title}
                            </span>
                            {completed && (
                              <span className="ml-auto text-caption">
                                {name(completed.user_id)}
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                )}
              </section>
              {w.legacy &&
                (privatePlan.nextSessionAt || privatePlan.timesPerWeek) && (
                  <NextSessionCard
                    project={privatePlan}
                    myMomentTimes={[
                      ...moments.map((p) => p.createdAt),
                      ...privateMoments.map((p) => p.createdAt),
                    ]}
                  />
                )}
              <section className={panel}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lead">Next session</h2>
                  <button className={action} onClick={() => openSession()}>
                    Plan a session
                  </button>
                </div>
                {!upcoming.length && (
                  <p className="mt-3 text-small text-muted-foreground">
                    No sessions planned.
                  </p>
                )}
                {upcoming.slice(0, 5).map((s) => (
                  <div key={s.id} className="mt-4 border-t border-border pt-4">
                    <h3 className="text-small font-semibold">{s.title}</h3>
                    <p className="mt-1 text-small">
                      {formatDateTime(s.starts_at)}
                    </p>
                    {s.place && (
                      <p className="text-caption text-muted-foreground">
                        {s.place}
                      </p>
                    )}
                    {s.note && <p className="mt-2 text-small">{s.note}</p>}
                    <p className="mt-2 text-caption">
                      {data.attendance
                        .filter((a) => a.session_id === s.id && a.going)
                        .map((a) => name(a.user_id))
                        .join(", ") || "No one has responded yet."}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {[true, false].map((going) => (
                        <Button
                          key={String(going)}
                          variant={
                            data.attendance.some(
                              (a) =>
                                a.session_id === s.id &&
                                a.user_id === uid &&
                                a.going === going,
                            )
                              ? "secondary"
                              : "outline"
                          }
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await put("attendance", [
                                {
                                  session_id: s.id,
                                  user_id: uid,
                                  going,
                                  pursuit_id: project.id,
                                } as (typeof data.attendance)[number],
                              ]);
                            })
                          }
                        >
                          {going ? "I’m in" : "Can’t make it"}
                        </Button>
                      ))}
                      <button
                        className={action}
                        onClick={() =>
                          comments(
                            s.legacy_id != null
                              ? `legacy-session:${s.legacy_id}`
                              : `session:${s.id}`,
                          )
                        }
                      >
                        Discuss
                      </button>
                      {(host || s.user_id === uid) &&
                        !data.contributions.some(
                          (e) => e.session_id === s.id,
                        ) && (
                          <button
                            className={action}
                            onClick={() => openSession(s)}
                          >
                            Edit
                          </button>
                        )}
                      {w.tracking === "sessions" && status === "active" && (
                        <button
                          className={action}
                          onClick={() => openProgress(undefined, s)}
                        >
                          Log my session
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-caption text-muted-foreground">
                      Attendance does not log progress automatically.
                    </p>
                  </div>
                ))}
              </section>
              {shared && (
                <section className={panel}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-lead">Friends</h2>
                    {host && (
                      <button
                        className={action}
                        onClick={() => setSheet("people")}
                      >
                        <Users className="size-4" />
                        Invite people
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {collective
                      ? "Everyone contributes to one goal."
                      : "Each person chooses their own target."}
                  </p>
                  <ul className="mt-3 divide-y divide-border">
                    {people.map((p) => {
                      const g = data.goals.find((g) => g.user_id === p.userId);
                      const s = progressFor(
                        w,
                        data.contributions,
                        p.userId,
                        g ? g.target : w.target,
                      );
                      return (
                        <li
                          key={p.userId}
                          className="flex items-center gap-3 py-3"
                        >
                          <PersonAvatar
                            name={p.displayName}
                            src={p.avatarUrl}
                          />
                          <span className="flex-1 text-small">
                            {p.userId === uid ? "You" : p.displayName}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {p.status !== "joined"
                              ? "Invited"
                              : g?.status === "finished"
                                ? "Finished"
                                : w.tracking === "updates"
                                  ? ""
                                  : progressText(
                                      s.current,
                                      collective ? undefined : s.target,
                                    )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              <section>
                <h2 className="mb-3 text-lead">Recent activity</h2>
                {!data.contributions.length &&
                  !moments.length &&
                  !privateMoments.length && (
                    <p className="text-small text-muted-foreground">
                      No progress yet. Add your first update.
                    </p>
                  )}
                {[...data.contributions]
                  .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
                  .map((e) => (
                    <article key={e.id} className={`${panel} mb-3`}>
                      <div className="flex justify-between text-caption">
                        <span>{name(e.user_id)}</span>
                        <span>{formatDate(e.occurred_at)}</span>
                      </div>
                      <p className="mt-2 text-small font-semibold">
                        {e.item_id
                          ? w.items.find((i) => i.id === e.item_id)?.title
                          : w.tracking === "sessions"
                            ? "One session completed"
                            : `${formatAmount(e.amount)} ${w.unit}`}
                      </p>
                      {e.image_url && (
                        <ImageWithFallback
                          src={e.image_url}
                          alt="Moment"
                          className="mt-3 max-h-80 w-full rounded-control object-cover"
                        />
                      )}
                      {e.note && (
                        <p className="mt-2 whitespace-pre-wrap text-small">
                          {e.note}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-4">
                        {e.post_id ? (
                          <Link className={action} to={`/moment/${e.post_id}`}>
                            Add a thought
                          </Link>
                        ) : (
                          <button
                            className={action}
                            onClick={() =>
                              comments(
                                e.legacy_id
                                  ? `legacy-entry:${e.legacy_id}`
                                  : `entry:${e.id}`,
                              )
                            }
                          >
                            <MessageCircle className="size-4" />
                            {plural(
                              data.messages.filter(
                                (m) =>
                                  m.thread ===
                                  (e.legacy_id
                                    ? `legacy-entry:${e.legacy_id}`
                                    : `entry:${e.id}`),
                              ).length,
                              "comment",
                            )}
                          </button>
                        )}
                        {e.user_id === uid && !e.id.startsWith("moment:") && (
                          <>
                            <button
                              className={action}
                              onClick={() => openProgress(e)}
                            >
                              Edit
                            </button>
                            <button
                              className={action}
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await put("contributions", [], e.id);
                                })
                              }
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                {moments
                  .filter(
                    (p) => !data.contributions.some((e) => e.post_id === p.id),
                  )
                  .map((p) => (
                    <Link
                      key={p.id}
                      to={`/moment/${p.id}`}
                      className={`${panel} mb-3 block`}
                    >
                      {p.media && (
                        <ImageWithFallback
                          src={p.media}
                          alt=""
                          className="mb-3 max-h-56 w-full rounded-control object-cover"
                        />
                      )}
                      <p className="text-small">{p.caption || "Moment"}</p>
                      <span className={action}>Add a thought</span>
                    </Link>
                  ))}
                {privateMoments.map((log) => (
                  <article
                    key={`private:${log.id}`}
                    className={`${panel} mb-3`}
                  >
                    <p className="mb-2 text-caption text-muted-foreground">
                      Only you · {formatWhen(log.createdAt, { ago: true })}
                    </p>
                    {log.media && (
                      <ImageWithFallback
                        src={log.media}
                        alt=""
                        className="mb-3 max-h-56 w-full rounded-control object-cover"
                      />
                    )}
                    <p className="whitespace-pre-wrap text-small">{log.note}</p>
                  </article>
                ))}
                <Link to={`/create?pursuit=${project.id}`} className={action}>
                  Log a Moment
                </Link>
              </section>
            </div>
          ) : (
            <section
              id="pursuit-chat"
              aria-labelledby="pursuit-tab-chat"
              role="tabpanel"
              className="space-y-4"
            >
              <p className="text-small text-muted-foreground">
                Make plans, ask questions, or mention a friend.
              </p>
              {renderMessages()}
            </section>
          )}
        </>
      )}
      <BottomSheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
        title={
          sheet === "progress"
            ? "Add progress"
            : sheet === "edit"
              ? "Edit Pursuit"
              : sheet === "personal"
                ? "Your goal"
                : sheet === "session"
                  ? "Plan a session"
                  : sheet === "people"
                    ? "Invite people"
                    : "Finish this Pursuit?"
        }
      >
        <div className="space-y-6 pb-6">
          {sheet === "progress" && (
            <>
              <p className="text-small text-muted-foreground">
                {project.title}
              </p>
              {w.tracking === "total" && (
                <Field label={w.unit || "Amount"}>
                  <input
                    className={fieldClass}
                    inputMode="decimal"
                    type="number"
                    min="0.01"
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              )}
              {w.tracking === "checklist" && (
                <Field label="Checklist item">
                  <select
                    className={fieldClass}
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                  >
                    <option value="">Choose</option>
                    {w.items
                      .filter((i) => !i.archived)
                      .map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.title}
                        </option>
                      ))}
                  </select>
                </Field>
              )}
              <Field label="Date">
                <input
                  className={fieldClass}
                  type="date"
                  disabled={!!entry?.legacy_id}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Add a note · Optional">
                <textarea
                  className={fieldClass}
                  maxLength={1000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <Field label="Attach a Moment · Optional">
                <select
                  className={fieldClass}
                  value={postId}
                  disabled={!!entry?.legacy_id}
                  onChange={(e) => setPostId(e.target.value)}
                >
                  <option value="">None</option>
                  {moments
                    .filter((p) => p.userId === uid || !user)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.caption || "Moment"}
                      </option>
                    ))}
                </select>
              </Field>
              <p className="text-caption text-muted-foreground">
                Add a photo through Log a Moment.
              </p>
              <Button
                variant="coral"
                className="min-h-11 w-full"
                busy={busy}
                onClick={() => void run(saveProgress)}
              >
                {entry ? "Save changes" : "Add progress"}
              </Button>
            </>
          )}
          {sheet === "personal" && (
            <>
              <Field label="Target · Optional">
                <input
                  className={fieldClass}
                  type="number"
                  step={w.tracking === "sessions" ? "1" : "any"}
                  value={personalTarget}
                  onChange={(e) => setPersonalTarget(e.target.value)}
                  disabled={
                    w.tracking === "updates" || w.tracking === "checklist"
                  }
                />
              </Field>
              <Field label="Finish by · Optional">
                <input
                  className={fieldClass}
                  type="date"
                  value={personalDate}
                  onChange={(e) => setPersonalDate(e.target.value)}
                />
              </Field>
              <Button
                variant="coral"
                busy={busy}
                onClick={() =>
                  void run(async () => {
                    const target = personalTarget
                      ? Number(personalTarget)
                      : undefined;
                    const invalid = validateWorkflow({
                      ...w,
                      target,
                      finishBy: personalDate || undefined,
                    });
                    if (invalid) throw new Error(invalid);
                    await put("goals", [
                      goalRow({
                        target: target ?? null,
                        finish_by: personalDate || null,
                      }),
                    ]);
                    setSheet(null);
                  })
                }
              >
                Save changes
              </Button>
            </>
          )}
          {sheet === "edit" && (
            <>
              {w.legacy && (
                <Link to={`/pursuit/${project.id}?legacy=1`} className={action}>
                  More options
                </Link>
              )}
              {host && (
                <>
                  <Field label="Name">
                    <input
                      className={fieldClass}
                      maxLength={80}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </Field>
                  <GoalFields
                    value={draft}
                    onChange={setDraft}
                    locked={!!w.legacy || data.contributions.length > 0}
                  />
                  <Button
                    variant="coral"
                    busy={busy}
                    onClick={() =>
                      void run(async () => {
                        const invalid = validateWorkflow(draft);
                        if (invalid || !title.trim())
                          throw new Error(invalid || "Name your Pursuit.");
                        if (!canChangeTracking(w, draft, data.contributions))
                          throw new Error(
                            "Tracking stays the same once progress is recorded.",
                          );
                        const updated = {
                          ...project,
                          title: title.trim(),
                          measure: measureFor(draft),
                        };
                        await saveWorkflowProject(updated, !!user);
                        setProject(updated);
                        setSheet(null);
                      })
                    }
                  >
                    Save changes
                  </Button>
                </>
              )}
              {host && user && !shared && (
                <Button variant="outline" onClick={() => setSheet("people")}>
                  Invite people
                </Button>
              )}
              {user && (
                <>
                  <Field label="Personal reminder">
                    <select
                      className={fieldClass}
                      value={personal?.reminder_minutes ?? ""}
                      disabled={busy}
                      onChange={(e) =>
                        void run(async () => {
                          await put("goals", [
                            goalRow({
                              reminder_minutes:
                                e.target.value === ""
                                  ? null
                                  : Number(e.target.value),
                            }),
                          ]);
                        })
                      }
                    >
                      <option value="">None</option>
                      <option value="30">30 minutes before</option>
                      <option value="1440">1 day before</option>
                    </select>
                  </Field>
                  <p className="text-caption text-muted-foreground">
                    Reminders appear in Inbox for sessions you’re going to.
                  </p>
                </>
              )}
              {shared && (
                <label className="flex min-h-11 items-center gap-3 text-small">
                  <input
                    type="checkbox"
                    checked={personal?.muted ?? false}
                    disabled={busy}
                    onChange={(e) =>
                      void run(async () => {
                        await put("goals", [
                          goalRow({ muted: e.target.checked }),
                        ]);
                      })
                    }
                  />
                  Mute this Pursuit
                </label>
              )}
              {(!collective || host) && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(() =>
                        changeStatus(status === "paused" ? "active" : "paused"),
                      )
                    }
                  >
                    {status === "paused" ? "Resume" : "Pause"}
                  </Button>
                  <Button variant="outline" onClick={() => setSheet("finish")}>
                    Finish
                  </Button>
                </div>
              )}
              {!host && shared && (
                <>
                  <p className="text-caption text-muted-foreground">
                    The host manages shared settings.
                  </p>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const { error } = await supabase!.rpc(
                          "leave_pursuit_workflow",
                          { p_id: project.id, p_user: uid },
                        );
                        if (error)
                          throw new Error("Couldn’t leave. Try again.");
                        dropProject(project.id);
                        navigate("/my-space");
                      })
                    }
                  >
                    Leave Pursuit
                  </Button>
                </>
              )}
            </>
          )}
          {sheet === "session" && (
            <>
              <Field label="Name">
                <input
                  className={fieldClass}
                  maxLength={80}
                  value={sessionTitle}
                  disabled={meeting?.legacy_id != null}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </Field>
              <Field label="When">
                <input
                  className={fieldClass}
                  type="datetime-local"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                />
              </Field>
              <Field label="Place · Optional">
                <input
                  className={fieldClass}
                  maxLength={meeting?.legacy_id != null ? 120 : 140}
                  value={place}
                  onChange={(e) => setPlace(e.target.value)}
                />
              </Field>
              <Field label="What’s the plan? · Optional">
                <textarea
                  className={fieldClass}
                  maxLength={meeting?.legacy_id != null ? 140 : 1000}
                  value={sessionNote}
                  onChange={(e) => setSessionNote(e.target.value)}
                />
              </Field>
              {!meeting ? (
                <>
                  <label className="flex min-h-11 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={repeat}
                      onChange={(e) => setRepeat(e.target.checked)}
                    />
                    Repeat weekly
                  </label>
                  {repeat && (
                    <Field label="Repeat until">
                      <input
                        className={fieldClass}
                        type="date"
                        value={repeatEnd}
                        onChange={(e) => setRepeatEnd(e.target.value)}
                      />
                    </Field>
                  )}
                </>
              ) : (
                <Field label="Apply changes to">
                  <select
                    className={fieldClass}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                  >
                    <option value="one">This session</option>
                    {meeting?.legacy_id == null && (
                      <option value="future">This and future sessions</option>
                    )}
                  </select>
                </Field>
              )}
              <Button
                variant="coral"
                busy={busy}
                onClick={() => void run(saveSession)}
              >
                Save changes
              </Button>
              {meeting && meeting.legacy_id == null && (
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const rows = data.sessions
                        .filter(
                          (s) =>
                            s.id === meeting.id ||
                            (scope === "future" &&
                              s.series_id === meeting.series_id &&
                              s.starts_at >= meeting.starts_at),
                        )
                        .map((s) => ({ ...s, cancelled: true }));
                      await put("sessions", rows);
                      setSheet(null);
                    })
                  }
                >
                  Cancel session
                </Button>
              )}
            </>
          )}
          {sheet === "finish" && (
            <>
              <p className="text-lead">
                {w.tracking === "updates"
                  ? project.title
                  : progressText(summary.current, summary.target)}
              </p>
              <p className="text-small text-muted-foreground">
                Finishing keeps your actual progress.
              </p>
              <p className="text-small">
                {collective
                  ? "This finishes the shared Pursuit for everyone."
                  : "This finishes your participation. Your friends can keep going."}
              </p>
              <Button
                variant="coral"
                className="min-h-11 w-full"
                busy={busy}
                onClick={() => void run(() => changeStatus("finished"))}
              >
                Finish Pursuit
              </Button>
              <Button variant="outline" onClick={() => setSheet(null)}>
                Keep going
              </Button>
            </>
          )}
          {sheet === "people" && (
            <>
              {people
                .filter((p) => p.userId !== uid)
                .map((p) => (
                  <div
                    key={p.userId}
                    className="flex items-center justify-between text-small"
                  >
                    {p.displayName}
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const { error } = await supabase!.rpc(
                            "leave_pursuit_workflow",
                            { p_id: project.id, p_user: p.userId },
                          );
                          if (error)
                            throw new Error(
                              "Couldn’t remove this person. Try again.",
                            );
                          setMembersVersion((v) => v + 1);
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              <Field label="Search people by name">
                <input
                  className={fieldClass}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </Field>
              {searchResults
                .filter(
                  (p) => p.id !== uid && !people.some((m) => m.userId === p.id),
                )
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-small"
                  >
                    {p.displayName}
                    <Button
                      disabled={busy}
                      variant="outline"
                      onClick={() =>
                        void run(async () => {
                          const { error } = await supabase!.rpc(
                            "invite_pursuit_workflow",
                            { p_id: project.id, p_user: p.id },
                          );
                          if (error)
                            throw new Error("Invites didn’t send. Try again.");
                          const updated = await fetchPursuitAsProject(
                            project.id,
                          );
                          if (updated) {
                            setProject(updated);
                            addJoinedProject(updated);
                          }
                          setQuery("");
                          setMembersVersion((v) => v + 1);
                          setSheet(null);
                        })
                      }
                    >
                      Invite
                    </Button>
                  </div>
                ))}
            </>
          )}
          {error && (
            <p role="alert" className="text-small text-destructive">
              {error}
            </p>
          )}
        </div>
      </BottomSheet>
      {reportUser && (
        <ReportDialog
          open
          onOpenChange={(open) => !open && setReportUser("")}
          targetUserId={reportUser}
          targetKind="profile"
          personName={name(reportUser)}
        />
      )}
      {blockUser && (
        <BlockConfirmDialog
          open
          onOpenChange={(open) => !open && setBlockUser("")}
          personId={blockUser}
          personName={name(blockUser)}
          onBlocked={() => navigate("/my-space")}
        />
      )}
      <BottomSheet
        open={thread !== null}
        onOpenChange={(open) => !open && (setThread(null), setReply(null))}
        title="Comments"
      >
        <div className="space-y-4 pb-6">{renderMessages()}</div>
      </BottomSheet>
    </main>
  );
  function renderMessages() {
    return (
      <>
        {!conversation.length && (
          <p className="py-4 text-small text-muted-foreground">
            No messages yet.
          </p>
        )}
        {conversation.map((m) => (
          <article
            key={m.id}
            className={`${panel} ${m.parent_id ? "ml-4" : ""}`}
          >
            <div className="flex justify-between gap-3 text-caption">
              <span className="font-semibold">{name(m.user_id)}</span>
              <span className="text-muted-foreground">
                {formatWhen(m.created_at, { ago: true })}
              </span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-small">
              {m.body}
            </p>
            <div className="mt-2 flex gap-4">
              <button
                className={action}
                onClick={() =>
                  setReply(
                    m.parent_id
                      ? (data.messages.find((p) => p.id === m.parent_id) ?? m)
                      : m,
                  )
                }
              >
                Reply
              </button>
              <button
                className={action}
                disabled={
                  busy ||
                  data.applause.some(
                    (a) => a.message_id === m.id && a.user_id === uid,
                  )
                }
                onClick={() =>
                  void run(async () => {
                    await put("applause", [
                      {
                        message_id: m.id,
                        user_id: uid,
                        pursuit_id: project.id,
                      } as (typeof data.applause)[number],
                    ]);
                  })
                }
              >
                <Heart className="size-4" />
                {data.applause.filter((a) => a.message_id === m.id).length}
              </button>
              {m.user_id !== uid && (
                <>
                  <button
                    className={action}
                    onClick={() => setReportUser(m.user_id)}
                  >
                    Report
                  </button>
                  <button
                    className={action}
                    onClick={() => setBlockUser(m.user_id)}
                  >
                    Block
                  </button>
                </>
              )}
              {m.user_id === uid && (
                <button
                  className={action}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await put("messages", [], m.id);
                    })
                  }
                >
                  Remove
                </button>
              )}
            </div>
          </article>
        ))}
        {reply && (
          <div className="flex items-center justify-between text-caption">
            Reply to {name(reply.user_id)}
            <button className={action} onClick={() => setReply(null)}>
              Cancel
            </button>
          </div>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(sendMessage);
          }}
        >
          <Field label={thread ? "Add a thought" : "Message your friends"}>
            <textarea
              className={fieldClass}
              maxLength={2000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          {shared && (
            <div className="flex flex-wrap gap-2">
              {people
                .filter((p) => p.userId !== uid && p.status === "joined")
                .map((p) => (
                  <button
                    type="button"
                    key={p.userId}
                    className="min-h-11 text-caption underline"
                    onClick={() =>
                      setText(
                        (t) =>
                          `${t}${t ? " " : ""}@${p.username || p.displayName} `,
                      )
                    }
                  >
                    @{p.username || p.displayName}
                  </button>
                ))}
            </div>
          )}
          <Button
            type="submit"
            variant="coral"
            disabled={busy || !text.trim()}
            busy={busy}
          >
            Share
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
      </>
    );
  }
}
