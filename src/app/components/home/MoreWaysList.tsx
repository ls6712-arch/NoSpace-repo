import { Link } from "react-router";
import { LIST_GRID } from "../layout/PageShell";
import { PillButton } from "../ui/PillButton";
import { SuggestionPhoto } from "./SuggestionPhoto";
import { PRIMARY_LABEL, type CardState } from "./BestFitCard";
import { useShownOnce } from "../../lib/useShownOnce";
import { openPathFor } from "../../lib/homeActions";
import type { HomeItem } from "../../lib/homeItems";

function Row({ item, state, onShown, onOpen, onPrimary }: { item: HomeItem; state: CardState; onShown: () => void; onOpen: () => void; onPrimary: () => void }) {
  const ref = useShownOnce<HTMLLIElement>(onShown);
  const done = state === "done" || state === "requested";
  return (
    <li ref={ref} className="flex items-center gap-3 rounded-card border border-border bg-card p-2.5">
      <Link to={openPathFor(item)} onClick={onOpen} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <SuggestionPhoto item={item} width={72} className="size-[72px] rounded-control" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link to={openPathFor(item)} onClick={onOpen} className="min-h-11 content-center truncate text-body font-semibold text-foreground">
          {item.title}
        </Link>
        <span className="truncate text-caption text-muted-foreground">{item.detail}</span>
        {item.why && <span className="truncate text-caption font-semibold text-accent-text">{item.why}</span>}
      </div>
      <PillButton
        variant="outline"
        onClick={onPrimary}
        disabled={state === "busy" || done}
        done={done}
        doneLabel={state === "requested" ? "Requested" : PRIMARY_LABEL[item.kind]}
        className="px-3.5 text-small"
      >
        {PRIMARY_LABEL[item.kind]}
      </PillButton>
    </li>
  );
}

/** Suggestions 2 to 4 as compact rows: photo, title, when, the why line and one action. */
export function MoreWaysList({
  items,
  firstPosition,
  states,
  onShown,
  onOpen,
  onPrimary,
}: {
  items: readonly HomeItem[];
  /** The position of the first row in the whole list, for logging. */
  firstPosition: number;
  states: Record<string, CardState>;
  onShown: (item: HomeItem, position: number) => void;
  onOpen: (item: HomeItem, position: number) => void;
  onPrimary: (item: HomeItem, position: number) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="home-more-ways" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 id="home-more-ways" className="text-lead font-bold" style={{ fontFamily: "var(--font-display)" }}>
          More ways this week
        </h2>
        <Link to="/discover" className="inline-flex min-h-11 items-center text-small font-semibold text-accent-text">
          See all
        </Link>
      </div>
      <ul className={LIST_GRID}>
        {items.map((item, i) => (
          <Row
            key={item.id}
            item={item}
            state={states[item.id] ?? "idle"}
            onShown={() => onShown(item, firstPosition + i)}
            onOpen={() => onOpen(item, firstPosition + i)}
            onPrimary={() => onPrimary(item, firstPosition + i)}
          />
        ))}
      </ul>
    </section>
  );
}
