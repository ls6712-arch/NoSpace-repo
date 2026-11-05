import { Link } from "react-router";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { PillButton } from "../ui/PillButton";
import type { CornerCardModel } from "../../lib/discoverCorners";
import { useShownOnce } from "../../lib/useShownOnce";
import { cornerStyle } from "../../lib/categoryStyle";
import { ArrowUpRight } from "lucide-react";

/**
 * A Corner card with its existing thumbnail, full name and two-line description.
 * Follow and the three activity tabs retain their original actions. Each tab
 * links to the Corner page on that section. A tab with nothing
 * there is left out, so the row never shows an empty invitation.
 */
export function CornerTearCard({
  model,
  position,
  onFollow,
  onShown,
  onOpen,
  className = "",
}: {
  model: CornerCardModel;
  position: number;
  onFollow: (model: CornerCardModel, position: number) => void;
  onShown: (model: CornerCardModel, position: number) => void;
  onOpen: (model: CornerCardModel, position: number) => void;
  className?: string;
}) {
  const ref = useShownOnce<HTMLLIElement>(() => onShown(model, position));
  return (
    <li ref={ref} style={cornerStyle(model.spaceSlug, model.slug)} className={`flex flex-col overflow-hidden rounded-card border border-border bg-card shadow-card transition-colors duration-fast hover:border-foreground/25 focus-within:border-foreground/25 ${className}`}>
      <div className="bg-[color-mix(in_srgb,var(--cat)_8%,var(--card))] p-5">
        <div className="flex items-start justify-between gap-4">
          <Link to={`/corners/${model.slug}`} onClick={() => onOpen(model, position)} aria-label={model.name} className="shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <SuggestionPhoto corner={model} className="size-20 rounded-control" width={80} />
          </Link>
          <PillButton variant="outline" className="shrink-0" onClick={() => onFollow(model, position)}>
            Follow
          </PillButton>
        </div>
        <Link to={`/corners/${model.slug}`} onClick={() => onOpen(model, position)} className="mt-4 flex min-h-11 items-center justify-between gap-3 break-words font-[family-name:var(--font-display)] text-lead leading-tight font-extrabold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0">{model.name}</span><ArrowUpRight className="size-5 shrink-0" aria-hidden="true" />
        </Link>
        {model.hook && <p className="mt-1 min-h-10 line-clamp-2 text-small text-muted-foreground">{model.hook}</p>}
      </div>
      {model.tabs.length > 0 && (
        <ul className={`grid flex-1 divide-x divide-border border-t border-border ${model.tabs.length === 1 ? "grid-cols-1" : model.tabs.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {model.tabs.map(tab => (
            <li key={tab.id}>
              <Link
                to={tab.to}
                onClick={() => onOpen(model, position)}
                className="flex h-full min-h-24 flex-col gap-2 p-3 outline-none transition-colors duration-fast hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="text-caption text-muted-foreground">{tab.label}</span>
                <span className="line-clamp-3 text-small font-semibold leading-snug">{tab.line}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
