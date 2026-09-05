import { useState } from "react";
import { Lock, MessageCircleQuestion, Trash2 } from "lucide-react";
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
  className = "",
}: {
  postId: number;
  postOwnerId?: string;
  postOwnerName?: string;
  isOwner?: boolean;
  privateThoughts?: boolean;
  onTogglePrivate?: (next: boolean) => void;
  className?: string;
}) {
  const social = useSocial();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const thoughts = social.thoughtsFor(postId);

  const submit = async () => {
    if (!body.trim() || saving) return;
    setSaving(true);
    await social.addThought(postId, body, prompt ?? undefined, postOwnerId, postOwnerName);
    setBody("");
    setPrompt(null);
    setSaving(false);
  };

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="text-xs text-muted-foreground">Add a thought</h4>
        {isOwner && onTogglePrivate && (
          <button
            type="button"
            onClick={() => onTogglePrivate(!privateThoughts)}
            aria-pressed={privateThoughts}
            className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Lock className="size-3" />
            {privateThoughts ? "Private thoughts only" : "Thoughts are public"}
          </button>
        )}
      </div>

      {/* A prompt, not an empty box */}
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

      {prompt && (
        <div className="mb-3">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={400}
            placeholder={prompt}
            className="min-h-20"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted-foreground">
              {privateThoughts
                ? "Only you and the maker will see this."
                : "Visible to anyone who can see this moment."}
            </span>
            <Button
              variant="coral"
              size="sm"
              disabled={!body.trim() || saving}
              onClick={submit}
            >
              {saving ? "Adding…" : "Add thought"}
            </Button>
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
          Saved in this browser only — sign in for thoughts other people can see.
        </p>
      )}
    </div>
  );
}
