import { Scissors, Ticket } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { PillButton } from "../ui/PillButton";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { useReactionState } from "../../lib/reactionState";
import { formatDate } from "../../lib/dates";
import { startedBecauseLine, startedBecauseOfLine, type WallCard as Card, type WallKind } from "../../lib/cornerWalls";

export const WALL_COPY = {
  stillMaking: "Still making",
  madeIt: "Made it",
  stillMakingLine: "Half-done, messy, in progress.",
  madeItLine: "Finished things, with the Moments that got them here.",
  makeYourVersion: "Make your version",
  youStarted: "You started yours.",
  passedAlong: "Passed along",
  passedAlongLine: "Who got whom into it here.",
  you: "You?",
  visitors: "Members see who’s making what.",
  walls: "Walls",
  shareWhatYoureMaking: "Share what you’re making.",
  logAMoment: "Log a Moment",
} as const;

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

/** Love this and Count me in. No counts anywhere on a wall card. */
function Reactions({ postId, name }: { postId: number; name: string }) {
  const { mine, toggle } = useReactionState(postId);
  const loved = mine.includes("love");
  const going = mine.includes("in");
  return (
    <div className="flex flex-wrap gap-2">
      <PillButton variant="outline" aria-pressed={loved} aria-label={loved ? `Loved ${name}’s Moment. Tap to undo` : `Love this, ${name}’s Moment`} className="min-h-11 px-4 text-small" onClick={() => toggle("love")}>
        {loved ? "Loved" : "Love this"}
      </PillButton>
      <PillButton variant="outline" aria-pressed={going} aria-label={going ? "You’re in. Tap to undo" : `Count me in, ${name}’s Moment`} className="min-h-11 px-4 text-small" onClick={() => toggle("in")}>
        {going ? "You’re in" : "Count me in"}
      </PillButton>
    </div>
  );
}

/**
 * One card on a Corner wall: the maker, the photo or words, the lines that link
 * it to the people it started (both ways), Love this and Count me in, and the
 * tear-off strip. The strip is a dashed top edge with two half-circle notches
 * cut in the panel's colour (`--wall-tint`), then Make your version. It is not
 * on your own Moment. Once you have started your own because of it, the strip
 * is one muted line. No counts, no progress.
 */
export function WallCard({
  card,
  kind,
  yoursStarted,
  onOpen,
  onMake,
  className = "",
}: {
  card: Card;
  kind: WallKind;
  yoursStarted: boolean;
  onOpen: () => void;
  onMake: () => void;
  /** Extra classes on the card, e.g. a fixed width in a sideways row (Home). */
  className?: string;
}) {
  const because = startedBecauseOfLine(card);
  const others = startedBecauseLine(card.startedBecause);
  const title = card.pursuitTitle ?? "";
  return (
    <li className={`relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-card ${className}`} data-wall-card={card.postId}>
      <button type="button" onClick={onOpen} className="flex flex-col text-left" aria-label={`Open ${card.authorName}’s Moment${title ? `: ${title}` : ""}`}>
        {card.photo ? (
          <ImageWithFallback src={card.photo} alt="" width={480} className="aspect-[16/10] w-full overflow-hidden bg-surface-muted" />
        ) : null}
        <span className="flex flex-col gap-1 p-3.5">
          {title && <span className="line-clamp-2 break-words text-small font-semibold">{title}</span>}
          {card.caption && <span className="line-clamp-3 break-words text-small text-muted-foreground">{card.caption}</span>}
          {kind === "made" && card.finishedAt != null && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption font-semibold text-foreground">
              <span>{`Finished ${formatDate(card.finishedAt)}`}</span>
              {card.finisherStub && (
                <span className="inline-flex items-center gap-1 text-[var(--accent-text)]">
                  <Ticket className="size-3.5" aria-hidden="true" />
                  Finisher
                </span>
              )}
            </span>
          )}
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 px-3.5 pb-3.5">
        <span className="flex items-center gap-2 text-caption text-muted-foreground">
          <Avatar className="size-6">
            {card.authorAvatarUrl && <AvatarImage src={card.authorAvatarUrl} alt="" />}
            <AvatarFallback className="text-caption">{initials(card.authorName)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{card.authorName}</span>
        </span>
        {because && <p className="text-small text-[var(--accent-text)]">{because}</p>}
        {others && <p className="text-small text-[var(--accent-text)]">{others}</p>}
        {!card.mine && (
          <div className="mt-auto pt-1">
            <Reactions postId={card.postId} name={card.authorName} />
          </div>
        )}
      </div>
      {!card.mine &&
        (yoursStarted ? (
          <p className="border-t border-dashed border-border px-3.5 py-3 text-caption text-muted-foreground">{WALL_COPY.youStarted}</p>
        ) : (
          <div className="relative border-t border-dashed border-border" data-tear-off>
            <span aria-hidden="true" className="absolute -left-2 -top-2 size-4 rounded-full bg-[var(--wall-tint)]" />
            <span aria-hidden="true" className="absolute -right-2 -top-2 size-4 rounded-full bg-[var(--wall-tint)]" />
            <button type="button" onClick={onMake} className="flex min-h-12 w-full items-center justify-center gap-2 px-3.5 text-small font-semibold text-[var(--accent-text)] hover:underline">
              <Scissors className="size-4" aria-hidden="true" />
              {WALL_COPY.makeYourVersion}
            </button>
          </div>
        ))}
    </li>
  );
}

/** A blurred stand-in for a card: shapes only, no names, photos or captions. Used for visitors. */
export function WallCardShape() {
  return (
    <li aria-hidden="true" className="flex flex-col gap-3 overflow-hidden rounded-card border border-border bg-card p-3.5 blur-[6px]">
      <div className="aspect-[4/3] w-full rounded-control bg-surface-muted" />
      <div className="h-3 w-3/4 rounded-full bg-surface-muted" />
      <div className="h-3 w-1/2 rounded-full bg-surface-muted" />
      <div className="mt-2 h-10 w-full rounded-full bg-surface-muted" />
    </li>
  );
}
