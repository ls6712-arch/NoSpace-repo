import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Camera, Check, ChevronRight, Globe2, Lock, Target, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useRewards } from "../context/RewardsContext";
import { useSettings } from "../context/SettingsContext";
import { defaultSpaceSlug } from "../data/hobbies";
import { addProgress, markActivity, pursuitStatus, useJournalSlice } from "../lib/journal";
import { attachPostToPursuit, mirrorProgress, mirrorPursuit } from "../lib/pursuitsRemote";
import { convertHeicIfNeeded } from "../lib/heicConversion";
import { formatAmount, hasMeasure, stepFor, summarize, targetText, unitFor } from "../lib/pursuitProgress";
import { usePursuitProgress } from "../lib/usePursuitProgress";
import { collectPursuitMoments } from "../lib/pursuitTrail";
import { Button } from "../components/ui/button";
import { AmountStepper, ProgressBar, SoftPanel, Toggle } from "../components/pursuit/ui";

type Audience = "private" | "followers" | "public";

const AUDIENCES: { value: Audience; label: string; icon: typeof Lock }[] = [
  { value: "private", label: "Only you", icon: Lock },
  { value: "followers", label: "Followers", icon: UserRound },
  { value: "public", label: "Everyone", icon: Globe2 },
];

/**
 * Add a Moment to a Pursuit — the mockup screen. One form: photo, what
 * changed, and "How much did this move it forward?", which logs the amount
 * toward the Pursuit's measure in the same action. Then "Moment added" with
 * the updated progress and the latest pieces.
 */
export function AddMoment() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addPost, posts } = useContent();
  const { add: addPrivateLog, logs } = usePrivateLogs();
  const rewards = useRewards();
  const { defaultVisibility } = useSettings();
  const projects = useJournalSlice((s) => s.projects);
  const entryProject = useJournalSlice((s) => s.entryProject);
  const project = projects.find((p) => p.id === id);
  const [refresh, setRefresh] = useState(0);
  const entries = usePursuitProgress(project?.id, refresh);

  const measure = project && hasMeasure(project) ? project.measure : undefined;
  const [amount, setAmount] = useState<number>(measure?.defaultAmount ?? 1);
  const [counts, setCounts] = useState(true);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>(defaultVisibility === "public" ? "public" : "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<{ amount: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (measure) setAmount(measure.defaultAmount);
  }, [measure?.defaultAmount]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Progress: yours for side-by-side, everyone's for a shared goal.
  const mine = useMemo(() => entries.filter((e) => !e.userId || e.userId === user?.id), [entries, user?.id]);
  const counted = project?.mode === "group" ? entries : mine;
  const summary = measure ? summarize(measure, counted) : undefined;

  const moments = useMemo(
    () => (project ? collectPursuitMoments(project.id, posts, entryProject, logs) : []),
    [project, posts, entryProject, logs],
  );

  if (!project) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-muted-foreground">That Pursuit isn't in your list.</p>
        <Link to="/my-space">
          <Button variant="outline">Back to My Space</Button>
        </Link>
      </div>
    );
  }

  const photoBlocked = !!file && audience === "private";
  const canSave = !saving && !photoBlocked && (note.trim().length > 0 || !!file || (!!measure && counts && amount > 0));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const text = note.trim();
    const logged = measure && counts ? amount : 0;
    const unitWords = measure ? `${formatAmount(logged)} ${unitFor(measure, logged)}` : "";
    let postId: number | undefined;
    let logId: number | undefined;
    let image: string | undefined;
    try {
      if (audience === "private") {
        const result = await addPrivateLog({ note: text || `Moved it forward: ${unitWords}`, projectId: project.id });
        if (!result.data) {
          setError(result.error || "That didn't save. Try again?");
          return;
        }
        logId = result.data.id;
        markActivity(project.id);
        rewards.recordPostCreated(project.subHobby || (project.hobbySlug ? `space:${project.hobbySlug}` : undefined));
      } else {
        const entry = await addPost({
          hobbySlug: project.hobbySlug ?? defaultSpaceSlug(),
          subHobby: project.subHobby,
          interest: project.interest,
          type: file ? "photo" : "written",
          files: file ? [file] : undefined,
          creator: profile?.display_name?.trim() || "You",
          caption: text || (logged ? `+${unitWords} on ${project.title}` : `A ${project.title} Moment`),
          visibility: audience,
          pursuitId: project.id,
        });
        postId = entry.id;
        image = entry.type === "photo" ? entry.media : undefined;
        await attachPostToPursuit(entry.id, project.id);
      }
      if (logged > 0) {
        const e = addProgress({ projectId: project.id, amount: logged, userId: user?.id, postId, logId, note: text || undefined, image });
        if (user) void mirrorProgress(user.id, e);
      }
      if (user && project.role !== "member" && pursuitStatus(project) !== "active") {
        void mirrorPursuit(user.id, { ...project, pausedAt: undefined, finishedAt: undefined });
      }
      setAdded({ amount: logged });
      setRefresh((r) => r + 1);
    } catch {
      setError("That didn't save. Try again?");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setAdded(null);
    setNote("");
    setFile(null);
    setAmount(measure?.defaultAmount ?? 1);
  };

  const recent = moments.filter((m) => m.image).slice(-4);

  return (
    <div className="min-h-screen bg-surface pb-44 lg:pb-28">
      <div className="container mx-auto max-w-md px-5 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-base" style={{ fontFamily: "var(--font-serif)" }}>
            Sushii
          </span>
          <span className="size-5" />
        </div>

        <h1 className="text-center text-[1.9rem] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Add a Moment
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">A little progress, kept for good.</p>

        <Link
          to={`/pursuit/${project.id}`}
          className="mt-6 flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 hover:border-[var(--coral-deep)]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--pastel-stone)_30%,var(--card))]">
            <Target className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted-foreground">Pursuit</span>
            <span className="block truncate text-sm">{project.title}</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        {added ? (
          <MomentAdded
            added={added.amount}
            unit={measure ? unitFor(measure, added.amount) : ""}
            summary={summary}
            targetLine={measure ? targetText(measure) : undefined}
            recent={recent.map((m) => ({ key: m.key, image: m.image!, date: m.createdAt }))}
            pursuitId={project.id}
            onAnother={reset}
          />
        ) : (
          <>
            <div className="mt-4 flex gap-3 rounded-xl border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                aria-label={file ? "Change photo" : "Add a photo"}
              >
                {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <Camera className="size-5" />}
                {file && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
                    aria-label="Remove photo"
                  >
                    <X className="size-3" />
                  </span>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setFile(await convertHeicIfNeeded(f).catch(() => f));
                }}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="moment-note" className="text-[11px] text-muted-foreground">
                  What changed?
                </label>
                <textarea
                  id="moment-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Finished the sky layer — wetter paper worked."
                  className="w-full resize-none bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {measure && (
              <SoftPanel className="mt-4">
                <p className="text-sm">How much did this move it forward?</p>
                <div className="mt-3">
                  <AmountStepper
                    value={amount}
                    onChange={setAmount}
                    step={stepFor(measure)}
                    unit={unitFor(measure, amount)}
                    allowDecimals={measure.allowDecimals || measure.allowPartial}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Count toward Pursuit progress</span>
                  <Toggle checked={counts} onChange={setCounts} label="Count toward Pursuit progress" />
                </div>
                {summary && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {formatAmount(summary.current)} of {targetText(measure)} so far
                  </p>
                )}
              </SoftPanel>
            )}

            <p className="mb-2 mt-5 text-sm">Who sees this</p>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  aria-pressed={audience === a.value}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border text-xs ${
                    audience === a.value
                      ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--coral)_12%,var(--card))] text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <a.icon className="size-3.5" /> {a.label}
                </button>
              ))}
            </div>
            {photoBlocked && (
              <p className="mt-2 text-xs text-muted-foreground">
                Photos can't be kept to just you yet. Choose Followers or Everyone, or remove the photo.
              </p>
            )}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <p className="mt-4 text-center text-[11px] text-muted-foreground">
              Something bigger?{" "}
              <Link to={`/create?pursuit=${project.id}`} className="text-accent hover:underline">
                Open the full form
              </Link>
            </p>
          </>
        )}
      </div>

      {!added && (
        <div className="fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom,0px))] z-40 border-t border-border bg-surface/95 px-5 pb-3 pt-3 backdrop-blur lg:bottom-0 lg:pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
          <div className="mx-auto max-w-md">
            <Button variant="coral" className="h-11 w-full rounded-xl" disabled={!canSave} onClick={save}>
              {saving ? "Saving…" : "Save Moment"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function MomentAdded({
  added,
  unit,
  summary,
  targetLine,
  recent,
  pursuitId,
  onAnother,
}: {
  added: number;
  unit: string;
  summary?: ReturnType<typeof summarize>;
  targetLine?: string;
  recent: { key: string; image: string; date: number }[];
  pursuitId: string;
  onAnother: () => void;
}) {
  return (
    <div className="mt-4" role="status">
      <SoftPanel className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--coral)] text-white">
          <Check className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">Moment added</p>
          <p className="text-xs text-muted-foreground">
            {added > 0 ? `+${formatAmount(added)} ${unit}` : "Saved to your Pursuit"}
            {summary && targetLine ? ` · ${formatAmount(summary.current)} of ${targetLine}` : ""}
          </p>
        </div>
      </SoftPanel>

      {summary && (
        <div className="mt-4">
          <ProgressBar fraction={summary.fraction} />
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{summary.percent}%</span>
            <span>{summary.done ? "Goal reached" : `${formatAmount(summary.remaining)} to go`}</span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs text-muted-foreground">Your latest pieces</p>
          <div className="grid grid-cols-4 gap-2">
            {recent.map((m) => (
              <figure key={m.key}>
                <img src={m.image} alt="" className="aspect-square w-full rounded-lg object-cover" />
                <figcaption className="mt-1 text-center text-[10px] text-muted-foreground">
                  {new Date(m.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-xl" onClick={onAnother}>
          Add another
        </Button>
        <Link to={`/pursuit/${pursuitId}`}>
          <Button variant="coral" className="h-11 w-full rounded-xl">
            View Pursuit
          </Button>
        </Link>
      </div>
    </div>
  );
}
