import { Link } from "react-router";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { PillButton } from "../ui/PillButton";
import type { CornerCardModel } from "../../lib/discoverCorners";
import { useShownOnce } from "../../lib/useShownOnce";

// Owner-supplied photographs already shipped for these exact activities. Other
// Corners retain their existing photo and honest category-icon fallback.
const LOCAL_PHOTOS: Record<string, { file: string; alt: string }> = {
  "music/guitar": { file: "guitar", alt: "Hands playing an electric guitar" },
  "food-cooking/cooking": { file: "cooking", alt: "People preparing vegetables together" },
  "books-writing/reading": { file: "reading", alt: "A person reading beside a window" },
  "photography-film/photography": { file: "photography", alt: "A person photographing flowers with a camera" },
  "art-creative/painting": { file: "painting", alt: "Hands painting fruit with watercolors" },
};

/**
 * A photo card for a Corner new to you: its name and a hook line, a
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
  priority = false,
}: {
  model: CornerCardModel;
  position: number;
  onFollow: (model: CornerCardModel, position: number) => void;
  onShown: (model: CornerCardModel, position: number) => void;
  onOpen: (model: CornerCardModel, position: number) => void;
  priority?: boolean;
}) {
  const ref = useShownOnce<HTMLElement>(() => onShown(model, position));
  const local = LOCAL_PHOTOS[model.key];
  const base = local && `${import.meta.env.BASE_URL}landing/photos/${local.file}`;
  const photo = local && { src: `${base}-800.webp`, srcSet: `${base}-400.webp 400w, ${base}-800.webp 800w, ${base}-1600.webp 1600w`, alt: local.alt };
  return (
    <article ref={ref} className="overflow-hidden rounded-card border border-border bg-card">
      <Link to={`/corners/${model.slug}`} onClick={() => onOpen(model, position)} aria-label={model.name} className="block outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        <SuggestionPhoto corner={model} photo={photo} className="aspect-video w-full" width={320} priority={priority} />
      </Link>
      <div className="flex items-center gap-3 p-4">
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
    </article>
  );
}
