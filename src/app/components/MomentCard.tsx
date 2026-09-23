import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Heart,
  Hand,
  MessageCircle,
  Bookmark,
  Pencil,
  Eye,
  PenLine,
  Lock,
  Check,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { Post } from "../data/posts";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useCircles } from "../context/CirclesContext";
import { useSocial } from "../context/SocialContext";
import { getHobby, subHobbyLabel } from "../data/hobbies";
import { displayLocation } from "../data/participation";
import { usePursuitTitle } from "../lib/pursuitTitle";
import { isOnlyYou, visibilityWord, MOMENT_VISIBILITY_OPTIONS } from "../lib/visibility";
import { useReactionState } from "./PostReactions";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { Thoughts } from "./Thoughts";
import { BePart } from "./BePart";
import { toggleSaved, useJournalSlice } from "../lib/journal";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export const hasRealMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/** Deterministic, so the same Moment always gets the same tile color across
 * every surface and every render — not a per-mount random pick. */
const TILE_TOKENS = [
  { bg: "var(--accent)", fg: "var(--accent-foreground)" },
  { bg: "var(--moment-tile-moss)", fg: "var(--moment-tile-moss-foreground)" },
  { bg: "var(--moment-tile-ink)", fg: "var(--moment-tile-ink-foreground)" },
] as const;

export function tileTokenFor(postId: number) {
  return TILE_TOKENS[Math.abs(postId) % TILE_TOKENS.length];
}

export const MEDIA_HEIGHT: Record<NonNullable<MomentCardProps["size"]>, string> = {
  lead: "h-[320px] sm:h-[480px]",
  wide: "h-[260px] sm:h-[360px]",
  standard: "h-[220px] sm:h-[320px]",
  compact: "h-[160px] sm:h-[200px]",
};

export const CAPTION_SIZE: Record<NonNullable<MomentCardProps["size"]>, string> = {
  lead: "text-[32px] sm:text-[44px] leading-[1.05]",
  wide: "text-[26px] leading-[1.2]",
  standard: "text-[22px] leading-[1.25]",
  compact: "text-[18px] leading-[1.25]",
};

export type MomentCardSurface =
  | "mySpace"
  | "you"
  | "discover"
  | "profile"
  | "circle"
  | "pursuit"
  | "archive"
  | "feed";

export interface MomentCardProps {
  post: Post;
  surface: MomentCardSurface;
  /** "01".."06" — sheet numbering, My Space only. */
  number?: string;
  size?: "lead" | "wide" | "standard" | "compact";
  /** Opens MomentDetail at the call site. */
  onOpen?: () => void;
  /** Circle thread extras (CircleBoard.tsx) — a plain Moment never sets
   * these. The Answered/Open badge itself is derived straight from
   * `post.circleTab === "questions"` and `post.answered`, not a prop, since
   * both already live on the post; only the *permission* to toggle it
   * (the thread's own author, or the Circle's owner) can't be derived from
   * the post alone, so the caller passes it explicitly. */
  canMarkAnswered?: boolean;
}

/** "Change who sees this" — the eye-icon control on your own Moment. Only
 * three choices, matching Settings > Privacy's own "Default visibility for
 * new Moments" vocabulary, not Log.tsx's wider four-way creation-time picker
 * (which also offers "followers", a real, independent tier this switcher
 * doesn't expose). */
function VisibilityDialog({
  post,
  open,
  onOpenChange,
}: {
  post: Post;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { updatePost } = useContent();
  const { circles } = useCircles();
  const [value, setValue] = useState<"private" | "circle" | "public">(
    isOnlyYou(post) ? "private" : post.visibility === "circle" ? "circle" : "public",
  );
  const [circleId, setCircleId] = useState<number | undefined>(post.circleId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hobbyCircles = circles.filter((c) => c.hobbySlug === post.hobbySlug);

  const save = async () => {
    if (saving) return;
    if (value === "circle" && !circleId) {
      setError("Choose a Circle first.");
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await updatePost(post.id, {
      visibility: value,
      circleId: value === "circle" ? circleId : undefined,
    });
    setSaving(false);
    if (!ok) {
      setError("Couldn't save that. Try again in a moment.");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Who sees this</DialogTitle>
          <DialogDescription>Changes who can find this Moment from now on.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={value} onValueChange={(v) => setValue(v as typeof value)} className="space-y-2">
          {MOMENT_VISIBILITY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex min-h-11 items-center gap-3 rounded-btn border border-border px-3 py-2.5 text-sm has-[[data-state=checked]]:border-[var(--coral-deep)]"
            >
              <RadioGroupItem value={opt.value} id={`vis-${opt.value}`} />
              <opt.icon className="size-4 shrink-0 text-muted-foreground" />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
        {value === "circle" && (
          <Select value={circleId ? String(circleId) : undefined} onValueChange={(v) => setCircleId(Number(v))}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a Circle" />
            </SelectTrigger>
            <SelectContent>
              {hobbyCircles.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="coral" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A maker-only, read-only count beside its icon — docs/moment-card-and-
 * reactions-spec.md §4.4: hidden at zero, capped at "999+", never a
 * toggle. This is never rendered for anyone but the Moment's own maker
 * (the caller only mounts it inside the `mine` branch below). */
export function OwnCountPill({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Heart;
  label: string;
  count: number;
}) {
  if (count <= 0) return null;
  const shown = count > 999 ? "999+" : String(count);
  return (
    <span
      aria-label={`${label}, ${count}`}
      title={`${label}, ${count}`}
      className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-muted-foreground"
    >
      <Icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
      <span className="tabular-nums">{shown}</span>
    </span>
  );
}

/** Bookmark, inline in the action row rather than overlaid on the media —
 * PostBookmark.tsx is built for the latter (hardcoded `absolute` position),
 * so this reuses its underlying toggleSaved/isSaved state directly instead
 * of fighting that component's own layout assumptions. */
export function InlineBookmark({ postId }: { postId: string | number }) {
  const saved = useJournalSlice((s) => s.saved.includes(Number(postId)));
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Added to your Space. Try This again to remove it" : "Try This: save it to come back to"}
      title={saved ? "Added to your Space" : "Try This"}
      onClick={() => toggleSaved(Number(postId))}
      className="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
    >
      <Bookmark className="size-4" strokeWidth={1.9} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}

export function MomentCard({
  post,
  surface,
  number,
  size = "standard",
  onOpen,
  canMarkAnswered = false,
}: MomentCardProps) {
  const { user } = useAuth();
  const { circles } = useCircles();
  const { ownCounts, setThreadAnswered } = useContent();
  const social = useSocial();
  const mine = !!user && post.userId === user.id;
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [askTogetherOpen, setAskTogetherOpen] = useState(false);
  const { mine: myReactions, toggle } = useReactionState(post.id);
  // Maker-only — never fetched or shown for a Moment that isn't yours (see
  // ContentContext's ownCounts). Missing entry (a page that hasn't loaded
  // counts yet) reads as all-zero, i.e. hidden, never a stray "0".
  const counts = ownCounts[post.id] ?? { love: 0, in: 0, thoughts: 0 };

  // A Circle "Questions" thread — post.circleTab and post.answered already
  // exist on every Post row (sql/circle-threads.sql), so this reads
  // straight off the post rather than a surface-specific prop.
  const isQuestion = post.circleTab === "questions";
  // An "activity" moment — a photo walk, a workshop, a Circle event — has a
  // time attached. Same fields ContentCard.tsx already reads; shown
  // wherever they're set; not exclusive to Circle threads.
  const isActivity = !!post.startsAt;
  const activityPlace = displayLocation(post.locationName, post.locationPrivacy);
  const goingCount = isActivity ? social.goingCount(post.id) : 0;

  const space = getHobby(post.hobbySlug);
  const corner = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : undefined;
  const pursuitTitle = usePursuitTitle(post.pursuitId);
  const cornerLine = [corner ?? space?.shortName, pursuitTitle].filter(Boolean).join(" · ");
  const tile = useMemo(() => tileTokenFor(post.id), [post.id]);
  const onlyYou = isOnlyYou(post);
  const circleName = post.circleId != null ? circles.find((c) => c.id === post.circleId)?.name : undefined;
  const timeLabel = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  const mediaBlock = hasRealMedia(post) ? (
    <PostMediaCarousel
      media={post.mediaUrls?.length ? post.mediaUrls : [post.media]}
      type={post.type}
      hobbySlug={post.hobbySlug}
      seed={post.id}
      className={`w-full ${MEDIA_HEIGHT[size]} rounded-[var(--radius-moment)] object-cover`}
    />
  ) : (
    <div
      className={`flex w-full items-center justify-center rounded-[var(--radius-moment)] p-6 sm:p-8 ${MEDIA_HEIGHT[size]}`}
      style={{ background: tile.bg, color: tile.fg }}
    >
      <p
        className={`text-center italic ${CAPTION_SIZE[size]}`}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {post.caption}
      </p>
    </div>
  );

  return (
    <article>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open: ${post.caption.slice(0, 60)}`}
        className={`relative block w-full overflow-hidden rounded-[var(--radius-moment)] text-left ${
          onlyYou ? "outline outline-2 outline-offset-[5px] outline-dashed outline-[var(--input-border)]" : ""
        }`}
      >
        {mediaBlock}
        {number && (
          <span className="ns-section-kicker absolute left-3.5 top-3.5 rounded-full bg-card px-3 py-1 text-foreground shadow-sm">
            {number}
          </span>
        )}
      </button>

      <div className="mt-4">
        {mine ? (
          <div className="flex items-center justify-between gap-3">
            <span className="ns-section-kicker text-muted-foreground">{corner ?? space?.shortName}</span>
            <span className="ns-section-kicker flex items-center gap-1.5 text-muted-foreground">
              {onlyYou && <Lock className="size-3" aria-hidden="true" />}
              {visibilityWord(post, circleName)} · {timeLabel}
            </span>
          </div>
        ) : (
          <div className="flex min-w-0 items-center gap-2.5">
            <Link to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"} className="shrink-0">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">{initials(post.creator)}</AvatarFallback>
              </Avatar>
            </Link>
            <span className="min-w-0">
              <Link
                to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"}
                className="block truncate text-base transition-colors hover:text-[var(--coral-text)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {post.creator}
              </Link>
              {cornerLine && (
                <span className="ns-section-kicker block truncate text-muted-foreground">{cornerLine}</span>
              )}
            </span>
          </div>
        )}

        <p
          className={`mt-3 italic ${CAPTION_SIZE[size]} ${size === "compact" ? "line-clamp-3" : ""}`}
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.caption}
        </p>
        {size === "compact" && post.caption.length > 140 && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 text-xs text-[var(--coral-text)] hover:underline"
          >
            Open
          </button>
        )}

        {isActivity && (
          <div className="mt-3 rounded-xl border border-border bg-surface px-3.5 py-3">
            <div className="flex items-center gap-1.5 text-xs">
              <CalendarDays className="size-3.5 shrink-0 text-foreground" />
              {new Date(post.startsAt!).toLocaleString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            {activityPlace && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                {activityPlace}
              </div>
            )}
            <div className="mt-2 text-xs text-muted-foreground">
              {goingCount} {goingCount === 1 ? "person" : "people"} going
            </div>
          </div>
        )}

        {isQuestion && (
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] ${
                post.answered
                  ? "bg-[var(--pastel-sage)]/40 text-foreground"
                  : "bg-surface-muted text-muted-foreground"
              }`}
            >
              {post.answered ? "Answered" : "Open"}
            </span>
            {canMarkAnswered && (
              <button
                type="button"
                onClick={() => setThreadAnswered(post.id, !post.answered)}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Check className="size-3" />
                {post.answered ? "Reopen" : "Mark answered"}
              </button>
            )}
          </div>
        )}

        <div className="mt-3.5 flex items-center gap-2">
          {mine ? (
            <>
              <OwnCountPill icon={Heart} label="Love this" count={counts.love} />
              <OwnCountPill icon={Hand} label="Count me in" count={counts.in} />
              <OwnCountPill icon={MessageCircle} label="Thoughts" count={counts.thoughts} />
              <Button variant="outline" size="sm" onClick={onOpen}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Change who sees this"
                title="Change who sees this"
                onClick={() => setVisibilityOpen(true)}
              >
                <Eye className="size-4" />
              </Button>
              {post.reflection && (
                <span className="ns-section-kicker inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--input-border)] px-3 py-1.5 text-muted-foreground">
                  <PenLine className="size-3" aria-hidden="true" />
                  Reflection
                </span>
              )}
              <VisibilityDialog post={post} open={visibilityOpen} onOpenChange={setVisibilityOpen} />
            </>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={myReactions.includes("love")}
                aria-label={`Love this${myReactions.includes("love") ? ", pressed" : ""}`}
                title="Love this"
                onClick={() => toggle("love")}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                  myReactions.includes("love")
                    ? "border-transparent bg-accent text-accent-foreground"
                    : "border-border text-foreground hover:border-[var(--foreground)]/35"
                }`}
              >
                <Heart className="size-4" strokeWidth={1.9} fill={myReactions.includes("love") ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                aria-pressed={myReactions.includes("in")}
                aria-label={`Count me in${myReactions.includes("in") ? ", pressed" : ""}`}
                title="Count me in"
                onClick={() => toggle("in")}
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${
                  myReactions.includes("in")
                    ? "border-transparent [background-color:var(--moment-tile-moss)] [color:var(--moment-tile-moss-foreground)]"
                    : "border-border text-foreground hover:border-[var(--foreground)]/35"
                }`}
              >
                <Hand className="size-4" strokeWidth={1.9} fill={myReactions.includes("in") ? "currentColor" : "none"} />
              </button>
              <button
                type="button"
                aria-label="Add a thought"
                title="Add a thought"
                onClick={() => setThoughtsOpen(true)}
                className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm text-foreground transition-colors hover:border-[var(--foreground)]/35"
              >
                <MessageCircle className="size-4" strokeWidth={1.9} />
              </button>
              <InlineBookmark postId={post.id} />
            </>
          )}
        </div>

        {/* Count me in keeps its existing behavior; after the first tap
            this quietly offers the existing make-together request instead
            of building a second flow — see BePart's initialPane/hideTrigger,
            docs/moment-card-and-reactions-spec.md §4.4. */}
        {!mine && myReactions.includes("in") && post.userId && (
          <button
            type="button"
            onClick={() => setAskTogetherOpen(true)}
            className="mt-2 text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
          >
            Ask {post.creator} to make it together?
          </button>
        )}
      </div>

      {!mine && (
        <>
          <Dialog open={thoughtsOpen} onOpenChange={setThoughtsOpen}>
            <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
              <DialogHeader>
                <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Thoughts</DialogTitle>
              </DialogHeader>
              <Thoughts
                postId={post.id}
                postOwnerId={post.userId}
                postOwnerName={post.creator}
                isOwner={false}
                privateThoughts={post.thoughtsPrivate}
                allowMedia={post.circleId != null}
              />
            </DialogContent>
          </Dialog>

          <BePart
            open={askTogetherOpen}
            onOpenChange={setAskTogetherOpen}
            hideTrigger
            initialPane="make_together"
            personName={post.creator}
            personId={post.userId}
            hobbySlug={post.hobbySlug}
            subSlug={post.subHobby}
            postId={post.id}
          />
        </>
      )}
    </article>
  );
}
