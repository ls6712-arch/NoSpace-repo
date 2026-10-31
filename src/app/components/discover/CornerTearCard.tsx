import { Link } from "react-router";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { PillButton } from "../ui/PillButton";
import type { CornerCardModel } from "../../lib/discoverCorners";
import { useShownOnce } from "../../lib/useShownOnce";

/**
 * A tear-off card for a Corner new to you: the tile, its name and a hook line, a
 * Follow button, a dotted perforation, then three tabs (At home, With people, At a
 * place), each a link to the Corner page on that section. A tab with nothing
 * there is left out, so the row never shows an empty invitation.
 */
export function CornerTearCard({
  model,
  position,
  onFollow,
  onShown,
  onOpen,
}: {
  model: CornerCardModel;
  position: number;
  onFollow: (model: CornerCardModel, position: number) => void;
  onShown: (model: CornerCardModel, position: number) => void;
  onOpen: (model: CornerCardModel, position: number) => void;
}) {
  const ref = useShownOnce<HTMLLIElement>(() => onShown(model, position));
  return (
    <li ref={ref} className="overflow-hidden rounded-card bg-card">
      <div className="flex items-center gap-3 p-4">
        <Link to={`/corners/${model.slug}`} onClick={() => onOpen(model, position)} aria-label={model.name} className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <SuggestionPhoto corner={model} className="size-14 rounded-control" width={56} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/corners/${model.slug}`} onClick={() => onOpen(model, position)} className="block truncate font-[family-name:var(--font-display)] text-lead leading-tight font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {model.name}
          </Link>
          {model.hook && <p className="truncate text-small text-muted-foreground">{model.hook}</p>}
        </div>
        <PillButton variant="outline" className="shrink-0" onClick={() => onFollow(model, position)}>
          Follow
        </PillButton>
      </div>
      {model.tabs.length > 0 && (
        <>
          <div className="mx-4 border-t-2 border-dotted border-border" aria-hidden="true" />
          <ul className={`grid ${model.tabs.length === 1 ? "grid-cols-1" : model.tabs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
            {model.tabs.map((tab, i) => (
              <li key={tab.id} className={i > 0 ? "border-l-2 border-dotted border-border" : ""}>
                <Link
                  to={tab.to}
                  onClick={() => onOpen(model, position)}
                  className="flex min-h-16 flex-col gap-0.5 p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="text-caption text-muted-foreground">{tab.label}</span>
                  <span className="line-clamp-3 text-small font-semibold leading-snug">{tab.line}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </li>
  );
}
