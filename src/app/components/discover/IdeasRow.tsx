import { Link } from "react-router";
import { HorizontalRow } from "../HorizontalRow";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { cornerPath } from "../../lib/cornerPath";
import { useShownOnce } from "../../lib/useShownOnce";
import type { MatchedIdea } from "../../lib/ideaMatch";

/** Approved Oct 31, 2026 (docs/glossary.md, Discover v2). */
export const IDEAS_EMPTY_LINE = "Nothing fits that mix yet";
export const IDEAS_LOOSEN_LINK = "Show more ideas";

function IdeaCard({
  match,
  position,
  passTag,
  onShown,
  onOpen,
}: {
  match: MatchedIdea;
  position: number;
  passTag: string | null;
  onShown: (key: string, position: number) => void;
  onOpen: (key: string, position: number) => void;
}) {
  const [spaceSlug, slug] = match.key.split("/");
  const ref = useShownOnce<HTMLLIElement>(() => onShown(match.key, position));
  return (
    <li ref={ref} className="w-[260px] shrink-0 snap-start">
      <Link
        to={cornerPath(spaceSlug, slug)}
        onClick={() => onOpen(match.key, position)}
        className="block overflow-hidden rounded-card bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <SuggestionPhoto corner={{ spaceSlug, slug }} className="aspect-[4/3] w-full" width={260}>
          {passTag && (
            <span className="absolute left-3 top-3 rounded-full bg-background px-3 py-1 text-caption font-semibold text-foreground">{passTag}</span>
          )}
        </SuggestionPhoto>
        <div className="p-4">
          <p className="text-body font-semibold leading-snug">{match.idea.ideaTitle}</p>
          <p className="mt-1 text-small text-muted-foreground">{match.idea.how}</p>
        </div>
      </Link>
    </li>
  );
}

/** Up to six idea cards in a row, or one dashed card with a link that loosens Spend. */
export function IdeasRow({
  ideas,
  passTagFor,
  onShown,
  onOpen,
  onLoosen,
}: {
  ideas: readonly MatchedIdea[];
  passTagFor: (key: string) => string | null;
  onShown: (key: string, position: number) => void;
  onOpen: (key: string, position: number) => void;
  onLoosen: () => void;
}) {
  if (ideas.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-card border-2 border-dashed border-border p-5">
        <p className="text-body font-semibold">{IDEAS_EMPTY_LINE}</p>
        <button type="button" onClick={onLoosen} className="min-h-11 text-body font-semibold text-accent-text underline-offset-2 hover:underline">
          {IDEAS_LOOSEN_LINK}
        </button>
      </div>
    );
  }
  return (
    <HorizontalRow name="discover.ideas" label="What could you do?" contentKey={ideas.map((i) => i.key).join("|")}>
      {ideas.map((m, i) => (
        <IdeaCard key={m.key} match={m} position={i} passTag={passTagFor(m.key)} onShown={onShown} onOpen={onOpen} />
      ))}
    </HorizontalRow>
  );
}
