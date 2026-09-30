import { useEffect, useRef, useState } from "react";
import { Camera, Images, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { usePrivateLogs } from "../context/PrivateLogsContext";
import { isInFlightSkipped } from "../lib/inFlightGuard";
import { convertHeicIfNeeded } from "../lib/heicConversion";
import { uploadMomentFile } from "../lib/momentMedia";
import { defaultSpaceSlug } from "../data/hobbies";
import { saveMomentDefaults } from "../lib/momentDefaults";
import { Post } from "../data/posts";
import { EveryoneShareConfirm } from "./EveryoneShareConfirm";
import { IsThisPartOfSomething } from "./IsThisPartOfSomething";
import { AddDetailsSheet } from "./AddDetailsSheet";
import { Button } from "./ui/button";

type Audience = "private" | "followers" | "public";

const AUDIENCE_LABEL: Record<Audience, string> = {
  private: "Only you",
  followers: "Followers",
  public: "Everyone",
};

/**
 * Step 3, §1: the very first screen a brand-new, now-active account sees —
 * before tags, before the cover, before anything that asks a question. One
 * job: get a first Moment saved. Default audience is Followers (for an
 * invitee, that's their inviter — see AuthContext.bootstrapProfile /
 * claim_invite, which already follows each other both ways on claim), shown
 * as a plain, changeable chip rather than assumed silently.
 *
 * No Pursuit or Corner chip here at all — this Moment doesn't need one yet.
 * "Is this part of something?" (right after Save) is the one and only
 * Pursuit-adjacent question this screen ever asks, and even that one never
 * says the word.
 */
export function FirstMomentStep({ onContinue }: { onContinue: () => void }) {
  const { user, profile } = useAuth();
  const { addPost, deletePost } = useContent();
  const { add: addPrivateLog, remove: removePrivateLog } = usePrivateLogs();

  const [line, setLine] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [audience, setAudience] = useState<Audience>("followers");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingEveryone, setConfirmingEveryone] = useState(false);
  const [saved, setSaved] = useState<{ post: Post | null; privateLogId: number | null } | null>(null);
  const [offerPursuitName, setOfferPursuitName] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canSave = !saving && (line.trim().length > 0 || !!file);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setError(null);
    try {
      setFile(await convertHeicIfNeeded(f));
    } catch {
      setFile(f);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const text = line.trim();
    const hobbySlug = defaultSpaceSlug();
    try {
      if (audience === "private") {
        let media: { path: string; type: "image"; hobbySlug?: string } | undefined;
        if (file && user) {
          const { path, error: uploadError } = await uploadMomentFile(user.id, file);
          if (uploadError || !path) {
            setError("Your photo didn't upload. Try again.");
            return;
          }
          media = { path, type: "image", hobbySlug };
        }
        const outcome = await addPrivateLog({ note: text || "My first moment" });
        if (outcome.skipped) return;
        if (!outcome.data) {
          setError(outcome.error || "That didn't save. Try again?");
          return;
        }
        if (user) saveMomentDefaults(user.id, { audience });
        setSaved({ post: null, privateLogId: outcome.data.id });
        return;
      }

      const entry = await addPost({
        hobbySlug,
        type: file ? "photo" : "written",
        files: file ? [file] : undefined,
        creator: profile?.display_name?.trim() || "You",
        caption: text || "My first moment",
        visibility: audience,
      });
      if (isInFlightSkipped(entry)) return;
      if (user) saveMomentDefaults(user.id, { audience });
      setLine("");
      setFile(null);
      setSaved({ post: entry, privateLogId: null });
      setOfferPursuitName(true);
    } catch {
      setError("That didn't save. Try again?");
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

  const undo = async () => {
    if (saved?.post) await deletePost(saved.post.id);
    else if (saved?.privateLogId) await removePrivateLog(saved.privateLogId);
    setSaved(null);
  };

  if (saved) {
    return (
      <div className="space-y-3">
        <div className="flex h-11 items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] px-3.5 text-sm">
          <span>Your first moment is in.</span>
          <button type="button" onClick={undo} className="text-[var(--coral-text,var(--coral-deep))] hover:opacity-80">
            Undo
          </button>
        </div>
        {saved.post && (
          <p className="text-xs text-[var(--ink-soft)]">
            {audience === "followers" ? "Your followers" : audience === "public" ? "Everyone" : "Only you"} will
            see it{audience === "followers" ? " first" : ""}.
          </p>
        )}
        {saved.post && offerPursuitName && (
          <IsThisPartOfSomething post={saved.post} onDone={() => {
            setOfferPursuitName(false);
            onContinue();
          }} />
        )}
        {saved.post && !offerPursuitName && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="text-xs text-[var(--coral-text,var(--coral-deep))] hover:underline"
            >
              Add details
            </button>
            <Button variant="coral" onClick={onContinue}>
              Continue
            </Button>
          </div>
        )}
        {saved.post && <AddDetailsSheet post={saved.post} open={detailsOpen} onOpenChange={setDetailsOpen} />}
        {!saved.post && (
          <div className="flex justify-end">
            <Button variant="coral" onClick={onContinue}>
              Continue
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (confirmingEveryone) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-4">
        <EveryoneShareConfirm
          name={profile?.display_name?.trim() || "You"}
          cornerLabel="Uncategorized"
          caption={line.trim()}
          photoPreviewUrl={preview}
          disabled={saving}
          onConfirm={() => void save()}
        />
        <button
          type="button"
          onClick={() => setConfirmingEveryone(false)}
          disabled={saving}
          className="mt-2 w-full text-center text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <>
      <h1 className="mb-1 text-2xl sm:text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
        Add your first moment.
      </h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Anything you're making, practising or learning. Half-done counts.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-[var(--coral-deep)] text-white transition-opacity hover:opacity-90"
        >
          <Camera className="size-6" />
          <span className="text-sm font-medium">Take a photo</span>
        </button>
        <button
          type="button"
          onClick={() => libraryInputRef.current?.click()}
          className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--line)] text-[var(--ink-soft)] transition-colors hover:border-[var(--coral-deep)] hover:text-[var(--ink)]"
        >
          <Images className="size-6" />
          <span className="text-sm font-medium">Choose a photo</span>
        </button>
      </div>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {preview && (
        <div className="relative mt-3 overflow-hidden rounded-2xl border border-[var(--line)]">
          <img src={preview} alt="" className="aspect-[4/3] w-full object-cover" />
          <button
            type="button"
            onClick={() => setFile(null)}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white"
          >
            Remove
          </button>
        </div>
      )}

      <p className="mt-4 mb-1.5 text-xs text-[var(--ink-soft)]">Or just write a line</p>
      <input
        value={line}
        onChange={(e) => setLine(e.target.value.slice(0, 200))}
        onKeyDown={(e) => e.key === "Enter" && requestSave()}
        placeholder="What are you making, practising or learning?"
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--paper-raised)] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
      />

      <div className="mt-4 flex items-center gap-1.5">
        <span className="text-xs text-[var(--ink-soft)]">Who sees it:</span>
        {(["private", "followers", "public"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAudience(a)}
            aria-pressed={audience === a}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              audience === a
                ? "border-[var(--coral-deep)] text-[var(--ink)]"
                : "border-[var(--line)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            }`}
          >
            {AUDIENCE_LABEL[a]}
          </button>
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-[var(--coral-text,var(--coral-deep))]">{error}</p>}

      <div className="mt-6 flex justify-end">
        <Button variant="coral" disabled={!canSave} onClick={requestSave}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
        </Button>
      </div>
    </>
  );
}
