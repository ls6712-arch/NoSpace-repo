import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Camera, Loader2, Undo2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { useRewards } from "../context/RewardsContext";
import { useSettings } from "../context/SettingsContext";
import { useCorners } from "../context/CornersContext";
import { Project, markActivity, useJournal } from "../lib/journal";
import { defaultSpaceSlug, subHobbyLabel } from "../data/hobbies";
import { guessSpace } from "../lib/pursuitProgress";
import { attachPostToPursuit, mirrorPursuit } from "../lib/pursuitsRemote";
import { convertHeicIfNeeded } from "../lib/heicConversion";
import { uploadMomentFile } from "../lib/momentMedia";
import { isInFlightSkipped } from "../lib/inFlightGuard";
import { Post } from "../data/posts";
import { CornerRef, loadMomentDefaults, saveMomentDefaults } from "../lib/momentDefaults";
import { EveryoneShareConfirm } from "./EveryoneShareConfirm";
import { IsThisPartOfSomething, hasOfferedIsThisPartOfSomethingThisSession } from "./IsThisPartOfSomething";
import { AddDetailsSheet } from "./AddDetailsSheet";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

type Audience = "private" | "followers" | "public";

const AUDIENCE_LABEL: Record<Audience, string> = {
  private: "Only you",
  followers: "Followers",
  public: "Everyone",
};

const NO_PURSUIT = "__none__";

export type SavedMoment = { post: Post | null; privateLogId: number | null };

/**
 * The "Logged · Undo" confirmation shown after a Moment saves. Split out of
 * QuickLog so the global "+" sheet can close itself the instant a Moment is
 * logged and show this as a small floating card instead — keeping the sheet
 * (and its dimmed, blurred overlay) open for the whole undo window made the
 * app look frozen behind a nearly-empty modal.
 */
export function LoggedNotice({
  saved,
  offerPursuitName: initialOffer,
  onDone,
}: {
  saved: SavedMoment;
  offerPursuitName: boolean;
  onDone: () => void;
}) {
  const { deletePost } = useContent();
  const { remove: removePrivateLog } = usePrivateLogs();
  const [offerPursuitName, setOfferPursuitName] = useState(initialOffer);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Auto-dismiss after the undo window — but never while the person is
  // mid-way through the follow-up (naming a Pursuit, adding details), since
  // dismissing would unmount what they're typing into.
  const busy = detailsOpen || offerPursuitName;
  useEffect(() => {
    if (busy) return;
    const t = setTimeout(() => onDoneRef.current(), 6000);
    return () => clearTimeout(t);
  }, [busy]);

  const undo = async () => {
    if (undoing) return;
    setUndoing(true);
    try {
      if (saved.post) await deletePost(saved.post.id);
      else if (saved.privateLogId) await removePrivateLog(saved.privateLogId);
    } finally {
      onDoneRef.current();
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="flex h-11 items-center justify-between rounded-xl border border-border bg-card px-3.5 text-sm">
        <span>Logged</span>
        <button
          type="button"
          onClick={undo}
          disabled={undoing}
          className="inline-flex items-center gap-1 text-[var(--coral-text,var(--accent))] transition-colors hover:opacity-80 disabled:opacity-50"
        >
          <Undo2 className="size-3.5" /> Undo
        </button>
      </div>
      {saved.post && offerPursuitName && (
        <IsThisPartOfSomething post={saved.post} onDone={() => setOfferPursuitName(false)} />
      )}
      {saved.post && !offerPursuitName && (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="text-xs text-accent hover:underline"
        >
          Add details (Corner, location, reflection)
        </button>
      )}
      {saved.post && (
        <AddDetailsSheet post={saved.post} open={detailsOpen} onOpenChange={setDetailsOpen} />
      )}
    </div>
  );
}

/**
 * Step 3's two-tap Moment: photo or line, Log — everything else (Pursuit,
 * Corner, audience) is a visible default chip, one tap to change, never a
 * question that has to be answered first.
 *
 * `pursuit` locks the Pursuit chip the same way this component has always
 * worked embedded on a Pursuit's own page (PursuitTrack, Pursuit.tsx,
 * CheckInCard) — that context already answers "which Pursuit," so there's
 * nothing to pick. Leaving it out (the new global "+" entry point, opened
 * with no page context at all) turns the Pursuit chip into a real picker,
 * defaulting to whichever Pursuit — or none — was used last time.
 */
export function QuickLog({
  pursuit,
  onDone,
  onSaved,
  autoFocus = true,
  placeholder = "What changed?",
  compact = false,
}: {
  pursuit?: Project;
  onDone?: () => void;
  /** When given, the saved Moment is handed off here (so the caller can close
   *  and show LoggedNotice itself) instead of being confirmed in place. */
  onSaved?: (saved: SavedMoment, offerPursuitName: boolean) => void;
  autoFocus?: boolean;
  placeholder?: string;
  compact?: boolean;
}) {
  const { user, profile } = useAuth();
  const { addPost } = useContent();
  const { add: addPrivateLog } = usePrivateLogs();
  const { resolveInterest } = useCorners();
  const rewards = useRewards();
  const { defaultVisibility } = useSettings();
  const journal = useJournal();

  const defaults = user ? loadMomentDefaults(user.id) : {};

  const [line, setLine] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedPursuitId, setSelectedPursuitId] = useState(
    pursuit ? pursuit.id : defaults.pursuitId ?? "",
  );
  const [cornerName, setCornerName] = useState(() => {
    if (pursuit?.subHobby) return subHobbyLabel(pursuit.subHobby) ?? pursuit.subHobby;
    return defaults.corner?.name ?? "";
  });
  const [editingCorner, setEditingCorner] = useState(false);
  const [cornerBlocked, setCornerBlocked] = useState(false);
  const [audience, setAudience] = useState<Audience>(
    (defaults.audience as Audience) ?? (defaultVisibility === "public" ? "followers" : "private"),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingEveryone, setConfirmingEveryone] = useState(false);
  const [saved, setSaved] = useState<SavedMoment | null>(null);
  const [offerPursuitName, setOfferPursuitName] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = !!pursuit;
  const effectivePursuit = pursuit ?? journal.projects.find((p) => p.id === selectedPursuitId);
  const openProjects = journal.projects.filter((p) => !p.finishedAt);

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

  const canPost = !saving && (line.trim().length > 0 || !!file);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      setFile(await convertHeicIfNeeded(f));
    } catch {
      setFile(f);
    }
  };

  const finishSave = (result: SavedMoment) => {
    setLine("");
    setFile(null);
    // A Moment not already in a Pursuit gets the one-per-session naming
    // offer; a private log was never eligible for a Pursuit hand-off to
    // begin with here (see IsThisPartOfSomething's own Post-only shape).
    const offer =
      !!result.post && !effectivePursuit && !hasOfferedIsThisPartOfSomethingThisSession();
    if (onSaved) {
      onSaved(result, offer);
      return;
    }
    setOfferPursuitName(offer);
    setSaved(result);
  };

  // A second Enter or tap that lands before the button re-renders disabled
  // must not start a second save.
  const savingRef = useRef(false);
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      await saveNow();
    } finally {
      savingRef.current = false;
    }
  };
  const saveNow = async () => {
    if (!canPost) return;
    setSaving(true);
    setError(null);
    setCornerBlocked(false);
    const text = line.trim();
    try {
      let cornerRef: CornerRef | undefined;
      const trimmedCorner = cornerName.trim();
      if (trimmedCorner) {
        const match = await resolveInterest(trimmedCorner);
        if (match && "blocked" in match) {
          setCornerBlocked(true);
          return;
        }
        if (match) cornerRef = match;
      }

      const hobbySlug =
        effectivePursuit?.hobbySlug ??
        cornerRef?.spaceSlug ??
        (effectivePursuit ? guessSpace(effectivePursuit.title) : undefined) ??
        defaultSpaceSlug();

      let result: { post: Post | null; privateLogId: number | null };

      if (audience === "private") {
        let media: { path: string; type: "image"; hobbySlug?: string } | undefined;
        if (file && user) {
          const { path, error: uploadError } = await uploadMomentFile(user.id, file);
          if (uploadError || !path) {
            setError("Your photo didn’t upload. Try again.");
            return;
          }
          media = { path, type: "image", hobbySlug };
        }
        const outcome = await addPrivateLog({ note: text, projectId: effectivePursuit?.id, media });
        if (outcome.skipped) return;
        if (!outcome.data) {
          setError(outcome.error || "That didn’t save. Try again?");
          return;
        }
        rewards.recordPostCreated(cornerRef?.slug ?? (hobbySlug ? `space:${hobbySlug}` : undefined));
        if (effectivePursuit) markActivity(effectivePursuit.id);
        result = { post: null, privateLogId: outcome.data.id };
      } else {
        const entry = await addPost({
          hobbySlug,
          subHobby: cornerRef?.slug,
          corner: cornerRef?.slug,
          type: file ? "photo" : "written",
          files: file ? [file] : undefined,
          creator: profile?.display_name?.trim() || "You",
          caption: text || (effectivePursuit ? `A ${effectivePursuit.title} Moment` : "A moment"),
          visibility: audience,
          pursuitId: effectivePursuit?.id,
        });
        if (isInFlightSkipped(entry)) return;
        if (effectivePursuit) await attachPostToPursuit(entry.id, effectivePursuit.id);
        result = { post: entry, privateLogId: null };
      }

      if (user && effectivePursuit && (effectivePursuit.pausedAt || effectivePursuit.finishedAt)) {
        void mirrorPursuit(user.id, { ...effectivePursuit, pausedAt: undefined, finishedAt: undefined });
      }

      if (user) {
        saveMomentDefaults(user.id, {
          pursuitId: effectivePursuit?.id,
          corner: cornerRef,
          audience,
        });
      }

      finishSave(result);
    } catch {
      setError("That didn’t save. Try again?");
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    if (audience === "public" && !confirmingEveryone) {
      setConfirmingEveryone(true);
      return;
    }
    setConfirmingEveryone(false);
    void save();
  };

  if (saved) {
    return (
      <LoggedNotice
        saved={saved}
        offerPursuitName={offerPursuitName}
        onDone={() => {
          setSaved(null);
          onDone?.();
        }}
      />
    );
  }

  if (confirmingEveryone) {
    return (
      <div className={`rounded-xl border border-border bg-card ${compact ? "p-2.5" : "p-3"}`}>
        <EveryoneShareConfirm
          name={profile?.display_name?.trim() || "You"}
          cornerLabel={cornerName.trim() || "Uncategorized"}
          caption={line.trim()}
          photoPreviewUrl={preview}
          disabled={saving}
          onConfirm={() => void save()}
        />
        <button
          type="button"
          onClick={() => setConfirmingEveryone(false)}
          disabled={saving}
          className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border bg-card ${compact ? "p-2.5" : "p-3"}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-[var(--coral-deep,var(--accent))] hover:text-foreground"
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
              if (e.key === "Enter") requestSave();
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            className="w-full bg-transparent py-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {!locked && (
              <Select
                value={selectedPursuitId || NO_PURSUIT}
                onValueChange={(v) => setSelectedPursuitId(v === NO_PURSUIT ? "" : v)}
              >
                <SelectTrigger
                  size="sm"
                  className="h-6 w-auto gap-1 rounded-full border-border px-2 py-0.5 text-[11px]"
                  aria-label="Pursuit"
                >
                  <SelectValue placeholder="No pursuit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PURSUIT}>No Pursuit</SelectItem>
                  {openProjects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {editingCorner ? (
              <input
                autoFocus
                value={cornerName}
                onChange={(e) => {
                  setCornerName(e.target.value);
                  setCornerBlocked(false);
                }}
                onBlur={() => setEditingCorner(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingCorner(false);
                }}
                placeholder="Corner"
                maxLength={60}
                className="h-6 w-28 rounded-full border border-[var(--coral-deep,var(--accent))] bg-transparent px-2 text-[11px] text-foreground outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingCorner(true)}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {cornerName.trim() || "Add a Corner"}
              </button>
            )}

            {(["private", "followers", "public"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAudience(a)}
                aria-pressed={audience === a}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                  audience === a
                    ? "border-[var(--coral-deep,var(--accent))] text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {AUDIENCE_LABEL[a]}
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
          {cornerBlocked && (
            <p className="mt-1 text-[11px] text-destructive">Try a more general Corner name.</p>
          )}
        </div>
        <Button variant="coral" size="sm" onClick={requestSave} disabled={!canPost} className="shrink-0">
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Log"}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      {!compact && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Something bigger?{" "}
          <Link
            to={effectivePursuit ? `/create?pursuit=${effectivePursuit.id}` : "/create"}
            className="text-accent hover:underline"
          >
            Open the full form
          </Link>
        </p>
      )}
    </div>
  );
}
