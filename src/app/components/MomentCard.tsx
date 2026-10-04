import { useMemo, useState } from "react";
import { Link } from "react-router";
import { pursuitTogetherHref } from "../lib/pursuitsRemote";
import {
  Heart,
  Hand,
  MessageCircle,
  Bookmark,
  Eye,
  PenLine,
  Lock,
  CalendarDays,
  MapPin,
} from "lucide-react";
import { Post } from "../data/posts";
import { useAuth } from "../context/AuthContext";
import { useContent } from "../context/ContentContext";
import { useSocial } from "../context/SocialContext";
import { subHobbyLabel } from "../data/hobbies";
import { displayLocation } from "../data/participation";
import { usePursuitTitle } from "../lib/pursuitTitle";
import { isOnlyYou, visibilityWord, MOMENT_VISIBILITY_OPTIONS } from "../lib/visibility";
import { useReactionState } from "../lib/reactionState";
import { PostMediaCarousel } from "./PostMediaCarousel";
import { Thoughts } from "./Thoughts";
import { BePart } from "./BePart";
import { toggleSaved, useJournalSlice } from "../lib/journal";
import { formatCount } from "../lib/formatCount";
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

export const hasRealMedia = (post: Post) => !!post.media && /^https?:\/\//.test(post.media);

/** The scrim behind the corner icons (Save, who-sees-this) that sit
 * directly on top of a Moment's own photo — stronger than a plain
 * drop-shadow so a white icon still reads on a truly light/white photo, via
 * a soft dark halo rather than one thin outline. Layered, not solid, so it
 * stays a shadow rather than a filled badge behind the icon; on a dark
 * photo the black tones simply have nothing to contrast against, so it
 * never reads as heavy there. */
const CORNER_ICON_SCRIM = "icon-halo";

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

export function tileTokenFor(postId: number | string) {
  const n = typeof postId === "number" ? postId : [...postId].reduce((a, c) => a + c.charCodeAt(0), 0);
  return TILE_TOKENS[Math.abs(n) % TILE_TOKENS.length];
}

/**
 * One shape for every Moment, everywhere (Sept 24, 2026). The old
 * per-size pixel heights (220/320/480px) made the same card wide on one
 * page and tall and skinny on the next, depending on column width. A fixed
 * aspect ratio keeps every card identical in shape on every page, screen
 * and device; `size` is kept on the props only so existing call sites
 * don't need to change.
 */
export const MOMENT_MEDIA = "aspect-square w-full rounded-card";

/** The grid every Moment list uses: 2 columns on phones, 3 from large
 * screens up. Import this instead of writing a grid class at a call site,
 * so no page drifts out of step again. */
export const MOMENT_GRID = "grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 lg:grid-cols-3";

/** Caption set into a text-only Moment's colored tile. Clamps so a long
 * note never changes the tile's shape. It was fluid (15-26px by tile width);
 * on the type scale it is text-lead, not text-title: at 22px a typical
 * 86-character note shows only 50-56% of its text on the smallest tiles
 * (138-166px, measured at 320-375px wide) versus 56-71% at 18px. */
export const TILE_CAPTION =
  "line-clamp-5 text-center italic text-lead leading-[1.2]";

/** Caption under every card — same size and always two lines tall, so
 * cards in a row line up whether the caption is one word or a paragraph. */
export const CARD_CAPTION = "line-clamp-2 min-h-[2.6em] italic text-lead leading-[1.3]";

export type MomentCardSurface =
  | "mySpace"
  | "you"
  | "discover"
  | "profile"
  | "pursuit"
  | "archive"
  | "feed";

export interface MomentCardProps {
  post: Post;
  surface: MomentCardSurface;
  /** "01".."06" — sheet numbering, My Space only. */
  number?: string;
  /** Ignored since Sept 24, 2026 — every Moment is one even square now
   * (MOMENT_MEDIA), regardless of size. Kept on the type so existing call
   * sites don't need to change; a new one doesn't need to pass it. */
  size?: "lead" | "wide" | "standard" | "compact";
  /** Opens MomentDetail at the call site. */
  onOpen?: () => void;
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
  const [value, setValue] = useState<"just_me" | "followers" | "public">(
    isOnlyYou(post) ? "just_me" : post.visibility === "followers" ? "followers" : "public",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const ok = await updatePost(post.id, {
      visibility: value,
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
              className="flex min-h-11 items-center gap-3 rounded-control border border-border px-3 py-2.5 text-small has-[[data-state=checked]]:border-[var(--coral-deep)]"
            >
              <RadioGroupItem value={opt.value} id={`vis-${opt.value}`} />
              <opt.icon className="size-4 shrink-0 text-muted-foreground" />
              {opt.label}
            </label>
          ))}
        </RadioGroup>
        {error && <p className="text-caption text-destructive">{error}</p>}
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

/**
 * Save (Try This), overlaid on the top-right corner of the media as a
 * bare icon — no chip behind it. A soft drop shadow keeps it readable on
 * both light and dark photos. `tone` lets a text-only tile draw it in the
 * tile's own foreground color instead of white.
 */
export function BookmarkOverlay({
  postId,
  tone = "var(--on-media)",
}: {
  postId: string | number;
  tone?: string;
}) {
  const saved = useJournalSlice((s) => s.saved.includes(Number(postId)));
  const [justAdded, setJustAdded] = useState(false);

  const onClick = () => {
    const wasSaved = saved;
    toggleSaved(Number(postId));
    if (!wasSaved) {
      setJustAdded(true);
      window.setTimeout(() => setJustAdded(false), 2200);
    }
  };

  return (
    <div className="absolute right-1.5 top-1.5 z-[1]">
      <button
        type="button"
        aria-pressed={saved}
        aria-label={saved ? "Saved. Tap again to remove it" : "Save"}
        title={saved ? "Saved" : "Save"}
        onClick={onClick}
        className="flex size-11 items-center justify-center rounded-control transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--coral-deep)] motion-reduce:transition-none"
      >
        <Bookmark
          className={`size-[22px] ${CORNER_ICON_SCRIM}`}
          strokeWidth={2}
          style={{ color: tone, fill: saved ? tone : "none" }}
          aria-hidden="true"
        />
      </button>
      {justAdded && (
        <span
          role="status"
          className="pointer-events-none absolute right-0 top-full mt-1 whitespace-nowrap rounded-control bg-[var(--void)] px-2.5 py-1 text-caption text-[var(--offwhite)] shadow-overlay animate-in duration-base fade-in"
        >
          Saved
        </span>
      )}
    </div>
  );
}


const ICON_BTN =
  "flex h-11 shrink-0 min-w-11 items-center justify-center gap-1 rounded-control px-2 text-small transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coral-deep)]";

/**
 * The one reaction row — used by every MomentCard and by MomentDetail, so
 * reactions look and behave the same on every surface. Icons only, no
 * bordered pills, so the row always fits a two-column phone grid.
 *
 * Love this and Count me in totals are public (Sept 24, 2026 — see
 * supabase/migrations/20260924200000_post_reaction_counts.sql). The
 * Thoughts total stays maker-only, since thoughts can be private.
 */
export function MomentActions({
  post,
  mine,
  onThoughts,
}: {
  post: Post;
  mine: boolean;
  onThoughts?: () => void;
}) {
  const { posts, ownCounts } = useContent();
  const { mine: myReactions, toggle } = useReactionState(post.id);
  // Read the live row, so a tap updates the number even when the caller
  // is holding an older copy of the post (MomentDetail does).
  const live = posts.find((p) => p.id === post.id) ?? post;
  const love = live.loveCount ?? 0;
  const inCount = live.inCount ?? 0;
  const thoughts = mine ? (ownCounts[post.id]?.thoughts ?? 0) : 0;
  const loved = myReactions.includes("love");
  const inPressed = myReactions.includes("in");

  // Zero shows as the bare icon, not "0".
  const Count = ({ n }: { n: number }) =>
    n > 0 ? <span className="tabular-nums">{formatCount(n)}</span> : null;

  return (
    <div className="-ml-2 flex items-center">
      {mine ? (
        <>
          <span className={`${ICON_BTN} text-muted-foreground`} aria-label={`Love this, ${love}`} title="Love this" role="img">
            <Heart className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <Count n={love} />
          </span>
          <span className={`${ICON_BTN} text-muted-foreground`} aria-label={`Count me in, ${inCount}`} title="Count me in" role="img">
            <Hand className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <Count n={inCount} />
          </span>
          <span className={`${ICON_BTN} text-muted-foreground`} aria-label={`Thoughts, ${thoughts}`} title="Thoughts" role="img">
            <MessageCircle className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <Count n={thoughts} />
          </span>
        </>
      ) : (
        <>
          <button
            type="button"
            aria-pressed={loved}
            aria-label={`Love this, ${love}${loved ? ", pressed" : ""}`}
            title="Love this"
            onClick={() => toggle("love")}
            className={`${ICON_BTN} hover:bg-surface-muted ${loved ? "text-[var(--coral-deep)]" : "text-foreground"}`}
          >
            <Heart className="size-[18px] shrink-0" strokeWidth={1.9} fill={loved ? "currentColor" : "none"} aria-hidden="true" />
            <Count n={love} />
          </button>
          <button
            type="button"
            aria-pressed={inPressed}
            aria-label={`Count me in, ${inCount}${inPressed ? ", pressed" : ""}`}
            title="Count me in"
            onClick={() => toggle("in")}
            className={`${ICON_BTN} hover:bg-surface-muted ${inPressed ? "[color:var(--moment-tile-moss)]" : "text-foreground"}`}
          >
            <Hand className="size-[18px] shrink-0" strokeWidth={1.9} fill={inPressed ? "currentColor" : "none"} aria-hidden="true" />
            <Count n={inCount} />
          </button>
          {onThoughts && (
            <button
              type="button"
              aria-label="Add a thought"
              title="Add a thought"
              onClick={onThoughts}
              className={`${ICON_BTN} text-foreground hover:bg-surface-muted`}
            >
              <MessageCircle className="size-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** The media square itself — a photo/video carousel, or a colored tile
 * with the caption set into it. Shared with MomentDetail. */
/** `full`: the Moment view, where the photo is the point: original size, loaded now. Cards ask for a thumbnail-sized copy. */
export function MomentMedia({ post, className = "", full = false }: { post: Post; className?: string; full?: boolean }) {
  const tile = useMemo(() => tileTokenFor(post.id), [post.id]);
  return hasRealMedia(post) ? (
    <PostMediaCarousel
      media={post.mediaUrls?.length ? post.mediaUrls : [post.media]}
      type={post.type}
      hobbySlug={post.hobbySlug}
      seed={post.id}
      width={full ? undefined : 640}
      priority={full}
      className={`${MOMENT_MEDIA} object-cover ${className}`}
    />
  ) : (
    <div
      className={`${MOMENT_MEDIA} flex items-center justify-center overflow-hidden p-[9%] [container-type:inline-size] ${className}`}
      style={{ background: tile.bg, color: tile.fg }}
    >
      <p className={TILE_CAPTION} style={{ fontFamily: "var(--font-serif)" }}>
        {post.caption}
      </p>
    </div>
  );
}

export function MomentCard({
  post,
  surface: _surface,
  number,
  onOpen,
}: MomentCardProps) {
  const { user } = useAuth();
  const social = useSocial();
  const mine = !!user && post.userId === user.id;
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [thoughtsOpen, setThoughtsOpen] = useState(false);
  const [askTogetherOpen, setAskTogetherOpen] = useState(false);
  const { mine: myReactions } = useReactionState(post.id);

  const isActivity = !!post.startsAt;
  const activityPlace = displayLocation(post.locationName, post.locationPrivacy);
  const goingCount = isActivity ? social.goingCount(post.id) : 0;

  // No Category-name fallback here (Spaces Rework follow-up): a Moment
  // with no Corner shows no label at all, never its Category's name (e.g.
  // "Art & Creative") — Category is internal-only now, nothing user-facing
  // ever names one directly.
  const corner = post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : undefined;
  const pursuitTitle = usePursuitTitle(post.pursuitId);
  const cornerLine = [corner, pursuitTitle].filter(Boolean).join(" · ");
  const tile = useMemo(() => tileTokenFor(post.id), [post.id]);
  const onlyYou = isOnlyYou(post);
  const timeLabel = new Date(post.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <article className="flex min-w-0 flex-col">
      {/* The open button and the Save icon are siblings, never nested —
          a button inside a button isn't valid, and Save must not also
          open the Moment. */}
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open: ${post.caption.slice(0, 60)}`}
          className={`relative block w-full overflow-hidden rounded-card text-left ${
            onlyYou ? "outline outline-2 outline-offset-[5px] outline-dashed outline-[var(--input-border)]" : ""
          }`}
        >
          <MomentMedia post={post} />
          {number && (
            <span className="ns-section-kicker absolute left-3 top-3 rounded-control bg-card px-2.5 py-1 text-foreground">
              {number}
            </span>
          )}
        </button>
        {/* The top-right corner is "your action on this Moment": Save for
            someone else's, who-sees-this for your own. */}
        {mine ? (
          <button
            type="button"
            onClick={() => setVisibilityOpen(true)}
            aria-label={`Who sees this: ${visibilityWord(post)}. Change it`}
            title="Who sees this"
            className="absolute right-1 top-1 z-[1] flex size-11 items-center justify-center rounded-control transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coral-deep)] motion-reduce:transition-none"
          >
            {onlyYou ? (
              <Lock
                className={`size-[20px] ${CORNER_ICON_SCRIM}`}
                strokeWidth={2}
                style={{ color: hasRealMedia(post) ? "var(--on-media)" : tile.fg }}
                aria-hidden="true"
              />
            ) : (
              <Eye
                className={`size-[20px] ${CORNER_ICON_SCRIM}`}
                strokeWidth={2}
                style={{ color: hasRealMedia(post) ? "var(--on-media)" : tile.fg }}
                aria-hidden="true"
              />
            )}
          </button>
        ) : (
          <BookmarkOverlay postId={post.id} tone={hasRealMedia(post) ? undefined : tile.fg} />
        )}
      </div>

      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        {mine ? (
          <div className="flex min-h-9 min-w-0 items-center justify-between gap-2">
            {/* No Category-name fallback (Spaces Rework follow-up, PR #83):
                a Moment with no Corner shows no label at all here either. */}
            <span className="ns-section-kicker min-w-0 truncate text-muted-foreground" title={corner}>{corner}</span>
            <span className="ns-section-kicker flex shrink-0 items-center gap-1.5 text-muted-foreground">
              {onlyYou && <Lock className="size-3" aria-hidden="true" />}
              {post.reflection && <PenLine className="size-3" aria-label="Has a Reflection" />}
              <span className="hidden sm:inline">{visibilityWord(post)} · </span>
              {timeLabel}
            </span>
          </div>
        ) : (
          <div className="flex min-h-9 min-w-0 items-center gap-2">
            <Link to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"} className="-my-1.5 -mr-3 shrink-0 py-1.5 pr-3">
              <Avatar className="size-8">
                <AvatarFallback className="text-caption">{initials(post.creator)}</AvatarFallback>
              </Avatar>
            </Link>
            <span className="min-w-0">
              <Link
                to={post.userId ? `/u/${encodeURIComponent(post.userId)}` : "#"}
                className="-my-3 block truncate py-3 text-body leading-tight transition-colors hover:text-[var(--coral-text)]"
                style={{ fontFamily: "var(--font-serif)" }}
               title={post.creator}>
                {post.creator}
              </Link>
              {cornerLine && (
                <span className="ns-section-kicker block truncate text-muted-foreground" title={cornerLine}>{cornerLine}</span>
              )}
            </span>
          </div>
        )}

        <p className={`mt-2 ${CARD_CAPTION}`} style={{ fontFamily: "var(--font-serif)" }} title={post.caption}>
          {post.caption}
        </p>

        {isActivity && (
          <div className="mt-3 rounded-card border border-border bg-surface px-3 py-2.5">
            <div className="flex items-center gap-1.5 text-caption">
              <CalendarDays className="size-3.5 shrink-0 text-foreground" />
              {new Date(post.startsAt!).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
            {activityPlace && (
              <div className="mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate" title={activityPlace}>{activityPlace}</span>
              </div>
            )}
            <div className="mt-1.5 text-caption text-muted-foreground">
              {goingCount} {goingCount === 1 ? "person" : "people"} going
            </div>
          </div>
        )}

        {/* mt-auto pins the row to the bottom, so reaction rows line up
            across a grid row even when one card carries an event block. */}
        <div className="mt-auto pt-1.5">
          <MomentActions
            post={post}
            mine={mine}
            onThoughts={() => setThoughtsOpen(true)}
          />
        </div>

        {!mine && myReactions.includes("in") && post.userId && (
          <div className="mt-1 flex flex-col items-start gap-0.5">
            {/* Step 4c: Count me in → do it together, as a shared Pursuit. */}
            <Link
              to={pursuitTogetherHref(post)}
              className="text-left text-caption font-medium text-foreground transition-colors hover:underline"
            >
              Start a Pursuit with {post.creator}?
            </Link>
            <button
              type="button"
              onClick={() => setAskTogetherOpen(true)}
              className="text-left text-caption text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              Ask {post.creator} to make it together?
            </button>
          </div>
        )}
      </div>

      {mine && <VisibilityDialog post={post} open={visibilityOpen} onOpenChange={setVisibilityOpen} />}

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
