import { useState } from "react";
import { Check } from "lucide-react";
import { Circle, CircleTabId } from "../data/circles";
import { useContent } from "../context/ContentContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { MediaAttachPicker } from "./MediaAttachPicker";

const TAB_COPY: Record<CircleTabId, { placeholder: string; submitLabel: string }> = {
  updates: { placeholder: "What are you working on?", submitLabel: "Post update" },
  pursuits: { placeholder: "What are you bringing to life this week?", submitLabel: "Post" },
  questions: { placeholder: "What do you want a second pair of eyes on?", submitLabel: "Ask" },
  events: { placeholder: "What's happening, and when?", submitLabel: "Post event" },
};

/**
 * Posts one thread into a Circle's board — a caption, an optional photo or
 * video, filed under the tab currently open. This is the actual fix for
 * Circle contributions leaking into the poster's own public Moments shelf:
 * "Also save to Moments" defaults OFF (hiddenFromMoments: true) unless
 * explicitly checked, rather than every Circle post silently doubling as a
 * personal Moment the way it used to.
 */
export function CircleComposer({ circle, tab }: { circle: Circle; tab: CircleTabId }) {
  const { addPost, saveError, clearSaveError } = useContent();
  const { profile } = useAuth();
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<File | null>(null);
  const [saveToMoments, setSaveToMoments] = useState(false);
  const [posting, setPosting] = useState(false);
  const [posted, setPosted] = useState(false);

  const copy = TAB_COPY[tab];

  const submit = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    clearSaveError();
    setPosted(false);
    try {
      await addPost({
        hobbySlug: circle.hobbySlug,
        interest: circle.name,
        type: media?.type.startsWith("video/") ? "video" : "photo",
        file: media ?? undefined,
        creator: profile?.display_name?.trim() || "You",
        caption: body.trim(),
        visibility: "circle",
        circleId: circle.id,
        circleTab: tab,
        hiddenFromMoments: !saveToMoments,
      });
      setBody("");
      setMedia(null);
      setSaveToMoments(false);
      setPosted(true);
      setTimeout(() => setPosted(false), 2000);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={copy.placeholder}
        className="min-h-20"
        maxLength={2000}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <MediaAttachPicker file={media} onChange={setMedia} />
        <button
          type="button"
          onClick={() => setSaveToMoments((v) => !v)}
          aria-pressed={saveToMoments}
          className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
              saveToMoments ? "border-[var(--coral-deep)] bg-[var(--coral-deep)] text-white" : "border-border"
            }`}
          >
            {saveToMoments && <Check className="size-3" />}
          </span>
          Also save to Moments
        </button>
      </div>
      {saveError && <p className="mt-2 text-xs text-[var(--coral-text)]">{saveError}</p>}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] text-muted-foreground">
          {saveToMoments
            ? "Shows here and on your own Moments shelf."
            : "Shows here only — not on your public Moments shelf."}
        </span>
        <Button variant="coral" size="sm" disabled={!body.trim() || posting} onClick={submit}>
          {posting ? "Posting…" : posted ? "Posted" : copy.submitLabel}
        </Button>
      </div>
    </div>
  );
}
