import { Ticket } from "lucide-react";
import { Moment } from "../moment/Moment";
import { formatDate } from "../../lib/dates";
import { postFromCard, startedBecauseLine, startedBecauseOfLine, type WallCard as Card, type WallKind } from "../../lib/cornerWalls";
import { DEFAULT_WALL_LABELS } from "../../lib/cornerWallLabels";

export const WALL_COPY = {
  // The wall names of a Corner without a room. A Corner with one may name its walls itself: lib/cornerWallLabels.ts.
  stillMaking: DEFAULT_WALL_LABELS.making,
  madeIt: DEFAULT_WALL_LABELS.made,
  stillMakingLine: "Half-done, messy, in progress.",
  madeItLine: "Finished things, with the Moments that got them here.",
  passedAlong: "Passed along",
  passedAlongLine: "Who got whom into it here.",
  you: "You?",
  visitors: "Members see who’s making what.",
  walls: "Walls",
  shareWhatYoureMaking: "Share what you’re making.",
  logAMoment: "Log a Moment",
} as const;

/**
 * One Moment on a Corner wall. It is the same Moment as in the feed
 * (components/moment): header, photo, the icon row, the caption. A wall adds
 * only its own lines under the caption: when the Pursuit was finished, and who
 * it started (both ways). No panel, no inner card, no strip, no button.
 */
export function WallCard({
  card,
  kind,
  corner,
  onOpen,
  className = "",
}: {
  card: Card;
  kind: WallKind;
  corner: { spaceSlug: string; slug: string };
  onOpen: () => void;
  /** Extra classes on the card, e.g. a fixed width in a sideways row (Home). */
  className?: string;
}) {
  const because = startedBecauseOfLine(card);
  const others = startedBecauseLine(card.startedBecause);
  const finished = kind === "made" && card.finishedAt != null;
  const note =
    finished || because || others ? (
      <>
        {finished && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold text-foreground">
            <span>{`Finished ${formatDate(card.finishedAt!)}`}</span>
            {card.finisherStub && (
              <span className="inline-flex items-center gap-1 text-[var(--accent-text)]">
                <Ticket className="size-3.5" aria-hidden="true" />
                Finisher
              </span>
            )}
          </p>
        )}
        {because && <p className="text-small text-[var(--accent-text)]">{because}</p>}
        {others && <p className="text-small text-[var(--accent-text)]">{others}</p>}
      </>
    ) : undefined;
  return (
    <li data-wall-card={card.postId} className={`min-w-0 ${className}`}>
      <Moment post={postFromCard(card, corner)} avatarUrl={card.authorAvatarUrl} onOpen={onOpen} note={note} />
    </li>
  );
}

/** A blurred stand-in for a Moment: shapes only, no names, photos or captions. Used for visitors. */
export function WallCardShape() {
  return (
    <li aria-hidden="true" className="flex flex-col gap-3 pb-5 blur-[6px]">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-surface-muted" />
        <div className="h-3 w-1/2 rounded-full bg-surface-muted" />
      </div>
      <div className="aspect-[4/3] w-full rounded-card bg-surface-muted" />
      <div className="h-3 w-3/4 rounded-full bg-surface-muted" />
    </li>
  );
}
