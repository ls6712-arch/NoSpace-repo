import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Camera, Loader2, Lock, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useRewards } from "../context/RewardsContext";
import { useSettings } from "../context/SettingsContext";
import { Project, markActivity } from "../lib/journal";
import { defaultSpaceSlug } from "../data/hobbies";
import { attachPostToPursuit, mirrorPursuit } from "../lib/pursuitsRemote";
import { convertHeicIfNeeded } from "../lib/heicConversion";
import { Button } from "./ui/button";

type Audience = "private" | "followers";

/**
 * The ten-second Moment: one photo, one line, Post. For the small updates
 * ("did 20 minutes today") that don't deserve the full composer — which
 * stays one tap away for the big ones.
 *
 * The line is always "What changed?", never a blank caption box. Speed
 * without reflection would just rebuild an Instagram caption; the prompt is
 * what keeps a quick Moment a record of progress.
 *
 * Audience is two choices, not four — Only you or Followers. Anything wider
 * (a Circle, Everyone) is a considered choice and lives in the full form.
 *
 * Photos can't be kept "Only you" yet — private entries have no private
 * storage bucket (docs/private-media-plan.md), so a private photo would
 * either be lost or sit in the public bucket. Rather than do either
 * silently, picking a photo while "Only you" is chosen says so and offers
 * Followers.
 */
export function QuickLog({
  pursuit,
  onDone,
  autoFocus = true,
  placeholder = "What changed?",
  compact = false,
}: {
  pursuit: Project;
  onDone?: () => void;
  autoFocus?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const { user, profile } = useAuth();
  const { addPost } = useContent();
  const { add: addPrivateLog } = usePrivateLogs();
  const rewards = useRewards();
  const { defaultVisibility } = useSettings();
  const [line, setLine] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>(defaultVisibility === "public" ? "followers" : "private");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const photoBlocked = !!file && audience === "private";
  const canPost = !saving && !photoBlocked && (line.trim().length > 0 || !!file);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      setFile(await convertHeicIfNeeded(f));
    } catch {
      setFile(f);
    }
  };

  const post = async () => {
    if (!canPost) return;
    setSaving(true);
    setError(null);
    const text = line.trim();
    const hobbySlug = pursuit.hobbySlug ?? defaultSpaceSlug();
    try {
      if (audience === "private") {
        const result = await addPrivateLog({ note: text, projectId: pursuit.id });
        if (!result.data) {
          setError(result.error || "That didn't save. Try again?");
          return;
        }
        rewards.recordPostCreated(pursuit.subHobby || (pursuit.hobbySlug ? `space:${pursuit.hobbySlug}` : undefined));
      } else {
        const entry = await addPost({
          hobbySlug,
          subHobby: pursuit.subHobby,
          interest: pursuit.interest,
          type: file ? "photo" : "written",
          files: file ? [file] : undefined,
          creator: profile?.display_name?.trim() || "You",
          caption: text || `A ${pursuit.title} Moment`,
          visibility: "followers",
          pursuitId: pursuit.id,
        });
        await attachPostToPursuit(entry.id, pursuit.id);
      }
      // A Moment on a resting or finished Pursuit reopens it (journal's
      // attachEntry) — mirror that so another device agrees.
      if (user && (pursuit.pausedAt || pursuit.finishedAt)) {
        void mirrorPursuit(user.id, { ...pursuit, pausedAt: undefined, finishedAt: undefined });
      }
      // Private logs don't go through attachEntry, so the reopen (and the
      // "this counts as answering a check-in") has to happen here for them.
      if (audience === "private") markActivity(pursuit.id);
      setLine("");
      setFile(null);
      setPosted(true);
      setTimeout(() => {
        setPosted(false);
        onDone?.();
      }, 1200);
    } catch {
      setError("That didn't save. Try again?");
    } finally {
      setSaving(false);
    }
  };

  if (posted) {
    return (
      <p className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm" role="status">
        Moment added to <span style={{ fontFamily: "var(--font-serif)" }}>{pursuit.title}</span>.
      </p>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? "p-2.5" : "p-3"}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-foreground"
          aria-label={file ? "Change photo" : "Add a photo"}
        >
          {preview ? <img src={preview} alt="" className="size-full object-cover" /> : <Camera className="size-4" />}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={line}
            onChange={(e) => setLine(e.target.value.slice(0, 200))}
            onKeyDown={(e) => {
              if (e.key === "Enter") void post();
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {(["private", "followers"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                aria-pressed={audience === a}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  audience === a
                    ? "border-[var(--coral-deep)] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {a === "private" ? <Lock className="size-3" /> : <UserRound className="size-3" />}
                {a === "private" ? "Only you" : "Followers"}
              </button>
            ))}
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" /> Remove photo
              </button>
            )}
          </div>
        </div>
        <Button variant="coral" size="sm" onClick={post} disabled={!canPost} className="shrink-0">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Post"}
        </Button>
      </div>
      {photoBlocked && (
        <p className="mt-2 text-xs text-muted-foreground">
          Photos can't be kept to just you yet.{" "}
          <button type="button" className="text-accent hover:underline" onClick={() => setAudience("followers")}>
            Share with followers
          </button>{" "}
          or remove the photo.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {!compact && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Something bigger?{" "}
          <Link to={`/create?pursuit=${pursuit.id}`} className="text-accent hover:underline">
            Open the full form
          </Link>
        </p>
      )}
    </div>
  );
}
