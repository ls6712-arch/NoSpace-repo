import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Camera, Check, ChevronRight, Globe2, Lock, Target, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useRewards } from "../context/RewardsContext";
import { useSettings } from "../context/SettingsContext";
import { defaultSpaceSlug } from "../data/hobbies";
import { guessSpace } from "../lib/pursuitProgress";
import { addProgress, markActivity, pursuitStatus, useJournalSlice } from "../lib/journal";
import { attachPostToPursuit, mirrorProgress, mirrorPursuit } from "../lib/pursuitsRemote";
import { preparePickedPhoto } from "../lib/heicConversion";
import { uploadMomentFile } from "../lib/momentMedia";
import { isInFlightSkipped } from "../lib/inFlightGuard";
import { formatAmount, hasMeasure, stepFor, summarize, targetText, unitFor } from "../lib/pursuitProgress";
import { usePursuitProgress } from "../lib/usePursuitProgress";
import { collectPursuitMoments } from "../lib/pursuitTrail";
import { Button } from "../components/ui/button";
import { AmountStepper, ProgressBar, SoftPanel, Toggle } from "../components/pursuit/ui";
import { APP_NAME } from "../config";
import { formatDate } from "../lib/dates";
import { ERROR_LINE } from "../lib/stateCopy";
import { ImageWithFallback } from "../components/ImageWithFallback";

type Audience = "private" | "followers" | "public";

const AUDIENCES: { value: Audience; label: string; icon: typeof Lock }[] = [
  { value: "private", label: "Only you", icon: Lock },
  { value: "followers", label: "Followers", icon: UserRound },
  { value: "public", label: "Everyone", icon: Globe2 },
];

/**
 * Log a Moment for a Pursuit — the mockup screen. One form: photo, what
 * changed, and "How much did this move it forward?", which logs the amount
 * toward the Pursuit's measure in the same action. Then "Moment added" with
 * the updated progress and the latest pieces.
 */
export function AddMoment() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { addPost, posts, mediaError, clearMediaError } = useContent();
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
        <p className="text-small text-muted-foreground">That Pursuit isn’t in your list.</p>
        <Link to="/my-space">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    );
  }

  const canSave = !saving && (note.trim().length > 0 || !!file || (!!measure && counts && amount > 0));

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
        // Step 1: a private Moment's photo now uploads to the same
        // moment-media bucket any other Moment's does — no more "can't be
        // kept to just you" gate.
        let media: { path: string; type: "image"; hobbySlug?: string } | undefined;
        if (file && user) {
          const { path, error: uploadError } = await uploadMomentFile(user.id, file);
          if (uploadError || !path) {
            setError("Your photo didn’t upload. Try again.");
            return;
          }
          media = { path, type: "image", hobbySlug: project.hobbySlug };
        }
        const result = await addPrivateLog({
          note: text || `Moved it forward: ${unitWords}`,
          projectId: project.id,
          media,
        });
        if (result.skipped) return;
        if (!result.data) {
          setError(result.error || ERROR_LINE);
          return;
        }
        logId = result.data.id;
        markActivity(project.id);
        rewards.recordPostCreated(project.subHobby || (project.hobbySlug ? `space:${project.hobbySlug}` : undefined));
      } else {
        const entry = await addPost({
          hobbySlug: project.hobbySlug ?? guessSpace(project.title) ?? defaultSpaceSlug(),
          subHobby: project.subHobby,
          interest: project.interest,
          type: file ? "photo" : "written",
          files: file ? [file] : undefined,
          creator: profile?.display_name?.trim() || "You",
          caption: text || (logged ? `+${unitWords} on ${project.title}` : ""),
          visibility: audience,
          pursuitId: project.id,
        });
        if (isInFlightSkipped(entry)) return;
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
      setError(ERROR_LINE);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    clearMediaError();
    setAdded(null);
    setNote("");
    setFile(null);
    setAmount(measure?.defaultAmount ?? 1);
  };

  const recent = moments.filter((m) => m.image).slice(-4);

  return (
    <div className="min-h-viewport bg-surface pb-44 lg:pb-28">
      <div className="container mx-auto max-w-md px-5 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={() => navigate(-1)} aria-label="Back" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-5" />
          </button>
          <span className="text-body" style={{ fontFamily: "var(--font-serif)" }}>
            {APP_NAME}
          </span>
          <span className="size-5" />
        </div>

        <h1 className="text-center text-display leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          Log a Moment
        </h1>

        <Link
          to={`/pursuit/${project.id}`}
          className="mt-6 flex items-center gap-3 rounded-card border border-border bg-card p-3.5 hover:border-[var(--coral-deep)]"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--pastel-stone)_30%,var(--card))]">
            <Target className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-caption text-muted-foreground">Pursuit</span>
            <span className="block truncate text-small" title={project.title}>{project.title}</span>
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
            mediaError={mediaError}
          />
        ) : (
          <>
            <div className="mt-4 flex gap-3 rounded-card border border-border bg-card p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-control border border-dashed border-border bg-surface-muted text-muted-foreground hover:text-foreground"
                aria-label={file ? "Change photo" : "Add a photo"}
              >
                {preview ? <ImageWithFallback src={preview} alt="" className="size-full" /> : <Camera className="size-5" />}
                {file && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-control bg-scrim-solid/60 text-on-media"
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
                  if (!f) return;
                  const prepared = await preparePickedPhoto(f);
                  if (prepared.error) return setError(prepared.error);
                  setError(null);
                  setFile(prepared.file);
                }}
              />
              <div className="min-w-0 flex-1">
                <label htmlFor="moment-note" className="text-caption text-muted-foreground">
                  What changed?
                </label>
                <textarea
                  id="moment-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Finished the sky layer — wetter paper worked."
                  className="w-full resize-none bg-transparent text-body text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {measure && (
              <SoftPanel className="mt-4">
                <p className="text-small">How much did this move it forward?</p>
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
                  <span className="text-caption text-muted-foreground">Count toward Pursuit progress</span>
                  <Toggle checked={counts} onChange={setCounts} label="Count toward Pursuit progress" />
                </div>
                {summary && (
                  <p className="mt-2 text-caption text-muted-foreground tabular-nums">
                    {formatAmount(summary.current)} of {targetText(measure)} so far
                  </p>
                )}
              </SoftPanel>
            )}

            <p className="mb-2 mt-5 text-small">Who sees this</p>
            <div className="grid grid-cols-3 gap-2">
              {AUDIENCES.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => setAudience(a.value)}
                  aria-pressed={audience === a.value}
                  className={`flex h-10 items-center justify-center gap-1.5 rounded-control border text-caption ${
                    audience === a.value
                      ? "border-[var(--coral)] bg-[color-mix(in_srgb,var(--coral)_12%,var(--card))] text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <a.icon className="size-3.5" /> {a.label}
                </button>
              ))}
            </div>
            {error && <p className="mt-2 text-caption text-destructive">{error}</p>}
            <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1 text-center text-caption text-muted-foreground">
              Something bigger?{" "}
              <Link to={`/create?pursuit=${project.id}`} className="inline-flex min-h-11 items-center text-accent hover:underline">
                Open the full form
              </Link>
            </p>
          </>
        )}
      </div>

      {!added && (
        <div className="fixed inset-x-0 bottom-[calc(72px+var(--safe-bottom))] z-40 border-t border-border bg-surface/95 px-5 pb-3 pt-3 backdrop-blur lg:bottom-0 lg:pb-[calc(var(--safe-bottom)+1rem)]">
          <div className="mx-auto max-w-md">
            <Button busy={saving} variant="coral" className="h-11 w-full rounded-control" disabled={!canSave} onClick={save}>
              Save Moment
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
  mediaError,
}: {
  added: number;
  unit: string;
  summary?: ReturnType<typeof summarize>;
  targetLine?: string;
  recent: { key: string; image: string; date: number }[];
  pursuitId: string;
  onAnother: () => void;
  /** Set when the photo attached to this save didn't actually upload — the
   * Moment itself still saved (same "degrade gracefully" rule addPost
   * follows everywhere), so this is a warning on an otherwise-success
   * screen, not a blocking error. Without this, that failure was
   * completely silent here — nothing on this page ever read it. */
  mediaError?: string | null;
}) {
  return (
    <div className="mt-4" role="status">
      <SoftPanel className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--coral-deep)] text-on-brand">
          <Check className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-small">Moment added</p>
          <p className="text-caption text-muted-foreground">
            {added > 0 ? `+${formatAmount(added)} ${unit}` : "Saved to your Pursuit"}
            {summary && targetLine ? ` · ${formatAmount(summary.current)} of ${targetLine}` : ""}
          </p>
        </div>
      </SoftPanel>

      {mediaError && (
        <p className="mt-2.5 rounded-card border border-[var(--coral-deep)]/40 bg-[color-mix(in_srgb,var(--coral)_9%,var(--surface-elevated))] px-3.5 py-2.5 text-small leading-relaxed text-foreground">
          {mediaError}
        </p>
      )}

      {summary && (
        <div className="mt-4">
          <ProgressBar fraction={summary.fraction} />
          <div className="mt-1.5 flex justify-between text-caption text-muted-foreground">
            <span>{summary.percent}%</span>
            <span>{summary.done ? "Goal reached" : `${formatAmount(summary.remaining)} to go`}</span>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-caption text-muted-foreground">Your latest pieces</p>
          <div className="grid grid-cols-4 gap-2">
            {recent.map((m) => (
              <figure key={m.key}>
                <ImageWithFallback src={m.image} alt="" className="aspect-square w-full rounded-card" />
                <figcaption className="mt-1 text-center text-caption text-muted-foreground">
                  {formatDate(m.date)}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11 rounded-control" onClick={onAnother}>
          Add another
        </Button>
        <Link to={`/pursuit/${pursuitId}`}>
          <Button variant="coral" className="h-11 w-full rounded-control">
            View Pursuit
          </Button>
        </Link>
      </div>
    </div>
  );
}
