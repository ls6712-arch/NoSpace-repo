import { useState } from "react";
import { ChevronRight, Lock, MessageCircleQuestion, Trash2 } from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

/**
 * Thoughts, not comments.
 *
 * A blank comment box invites reaction; a prompt invites reflection. Every
 * thought starts from one of these, which is also why they read as short cards
 * rather than a thread — nobody is replying to anybody, they're each answering
 * the same question about the same piece of work.
 *
 * No relationship is needed to leave one. The poster can switch a moment to
 * private thoughts, after which only they and the writer can see each one.
 */
const PROMPTS = [
  "What did this make you curious about?",
  "What would you try differently?",
  "Ask about their process",
  "What did you learn?",
  "Share your experience",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ago(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function Thoughts({
  postId,
  postOwnerId,
  postOwnerName,
  /** Only the owner sees the privacy control. */
  isOwner = false,
  privateThoughts = false,
  onTogglePrivate,
  compact = false,
  className = "",
}: {
  postId: number;
  postOwnerId?: string;
  postOwnerName?: string;
  isOwner?: boolean;
  privateThoughts?: boolean;
  onTogglePrivate?: (next: boolean) => void;
  /** A smaller collapsed trigger. Everything it opens into — prompts, the
   * composer, existing thoughts — is unchanged. */
  compact?: boolean;
  className?: string;
}) {
  const social = useSocial();
  const { user, profile } = useAuth();
  const myName = profile?.display_name || "You";
  const [prompt, setPrompt] = useState<string | null>(null);
  const [openComposer, setOpenComposer] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const thoughts = social.thoughtsFor(postId);

  const [failed, setFailed] = useState(false);

  const submit = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      await social.addThought(postId, body, prompt ?? undefined, postOwnerId, postOwnerName);
      setBody("");
      setPrompt(null);
      setOpenComposer(false);
    } catch {
      // Keep what they wrote on screen — losing a thought to a dropped
      // connection is worse than showing an error.
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={className}>
      {isOwner && onTogglePrivate && (
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => onTogglePrivate(!privateThoughts)}
            aria-pressed={privateThoughts}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="size-3" />
            {privateThoughts ? "Private thoughts only" : "Thoughts are public"}
          </button>
        </div>
      )}

      {!openComposer ? (
        <button
          type="button"
          onClick={() => setOpenComposer(true)}
          className={`mb-3 flex w-full items-center gap-2.5 rounded-full border border-[var(--border)] bg-surface text-left transition-colors hover:border-[var(--foreground)]/30 ${
            compact ? "px-2.5 py-1.5" : "px-3 py-2.5"
          }`}
        >
          <Avatar className={compact ? "size-5 shrink-0" : "size-6 shrink-0"}>
            <AvatarFallback className="text-[9px]">{initials(myName)}</AvatarFallback>
          </Avatar>
          <span className={`flex-1 truncate text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
            {compact ? "Add a thought" : "Add a thought…"}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <div className="mb-3">
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  aria-pressed={prompt === p}
                  onClick={() => setPrompt(prompt === p ? null : p)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    prompt === p
                      ? "border-transparent text-white [background-color:var(--coral-deep)]"
                      : "border-[var(--border)] bg-surface text-foreground hover:border-[var(--foreground)]/35"
                  }`}
                >
                  {p}
                </button>
              </li>
            ))}
          </ul>

          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            placeholder={prompt ?? "What did this make you think?"}
            className="min-h-20"
          />
          {failed && (
            <p className="mt-2 text-[11px] text-[var(--coral-text)]">
              That didn't send. Your words are still here, try again.
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {privateThoughts
                ? "Only you and the maker will see this."
                : "Visible to anyone who can see this moment."}
            </span>
            <span className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpenComposer(false)}>
                Cancel
              </Button>
              <Button variant="coral" size="sm" disabled={!body.trim() || saving} onClick={submit}>
                {saving ? "Adding…" : "Add thought"}
              </Button>
            </span>
          </div>
        </div>
      )}

      {thoughts.length > 0 && (
        <ul className="space-y-2">
          {thoughts.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border border-[var(--hairline)] bg-surface px-3.5 py-3"
            >
              {t.prompt && (
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[var(--coral-text)]">
                  <MessageCircleQuestion className="size-3" />
                  {t.prompt}
                </div>
              )}
              <p className="text-sm leading-relaxed">{t.body}</p>
              <div className="mt-2 flex items-center gap-2">
                <Avatar className="size-5">
                  {t.authorAvatar && <AvatarImage src={t.authorAvatar} alt="" />}
                  <AvatarFallback className="text-[9px]">{initials(t.authorName)}</AvatarFallback>
                </Avatar>
                <span className="text-[11px] text-muted-foreground">
                  {t.authorName} · {ago(t.createdAt)}
                </span>
                {user?.id === t.userId && (
                  <button
                    type="button"
                    onClick={() => social.removeThought(t.id)}
                    className="ml-auto text-muted-foreground transition-colors hover:text-[var(--coral-text)]"
                    aria-label="Delete this thought"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!social.isShared && thoughts.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Saved in this browser only. Sign in for thoughts other people can see.
        </p>
      )}
    </div>
  );
}
