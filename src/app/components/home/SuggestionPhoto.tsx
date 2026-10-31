import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { cornerPhoto, cornerPhotoAlt } from "../../lib/cornerPhoto";
import { CATEGORY_ICON, cornerStyle } from "../../lib/categoryStyle";
import { categoryOfCorner } from "../../data/cornerCategories";
import type { HomeItem } from "../../lib/homeItems";

/**
 * A suggestion's photo: the Corner's own, else its Space's, else the category
 * colour with the category's icon. Never a flat box. `priority` is for the one
 * above the fold; everything else loads lazily.
 */
export function SuggestionPhoto({
  item,
  corner,
  className,
  width,
  priority = false,
  children,
}: {
  /** A Home suggestion, or `corner` for anything else that has a Corner (Discover's ideas and Corner cards). */
  item?: HomeItem;
  corner?: { spaceSlug: string; slug: string };
  className: string;
  width: number;
  priority?: boolean;
  children?: ReactNode;
}) {
  const { spaceSlug, slug } = (item?.corner ?? corner)!;
  const Icon = (categoryOfCorner(spaceSlug, slug) && CATEGORY_ICON[categoryOfCorner(spaceSlug, slug)!.slug]) || Sparkles;
  return (
    <div className={`relative overflow-hidden ${className}`} style={cornerStyle(spaceSlug, slug)}>
      <ImageWithFallback
        src={cornerPhoto(spaceSlug, slug, width * 2)}
        alt={cornerPhotoAlt(slug)}
        className="size-full"
        tint
        priority={priority}
        width={width}
        fallback={
          <span className="flex size-full items-center justify-center bg-[var(--cat)] text-[var(--ink)]">
            <Icon className="size-1/3 opacity-30" aria-hidden="true" />
          </span>
        }
      />
      {children}
    </div>
  );
}
