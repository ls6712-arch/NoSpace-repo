/**
 * The fifteen things people are here to do.
 *
 * These are discovery categories — a way into the app, not a form to fill in.
 * Nothing about creating a post depends on them: you type whatever your hobby
 * is, and this file works out where it belongs afterwards. If it belongs
 * nowhere yet, that is a gap in this list rather than a mistake by the person,
 * which is what "Suggest a category" is for.
 *
 * Spaces Rework: this used to be a second, independent 15-item list —
 * `Category`, with its own `examples`/`keywords`/`tint` — that happened to
 * share slugs and near-identical names with hobbies.ts's `Hobby`, but was
 * never attached to a post directly (only keyword-matched against free
 * text). The two had already drifted (different descriptions, occasionally
 * different keyword coverage). They're now one list: hobbies.ts's `hobbies`
 * array carries `examples`/`keywords`/`tint` too, and `posts.hobbySlug`
 * references it directly. This file is now a thin adapter — same exported
 * names (`Category`, `getCategory`, `categoriesFor`, `primaryCategory`,
 * `postInCategory`) so every existing consumer (Discover.tsx, CategoryFeed.tsx,
 * AdminCategories.tsx, categoryIcons.ts) keeps working unchanged, but backed
 * by the single unified array instead of a second one.
 */
import { hobbies, visibleSpaces, type Hobby } from "./hobbies";

export interface Category {
  slug: string;
  name: string;
  /** One line, shown under the name. */
  description: string;
  /** The examples in the person's own vocabulary, not ours. */
  examples: string[];
  /**
   * What lands here. Matched case-insensitively against a post's free-text
   * interest and against the app's own sub-hobby labels, so existing content
   * files itself without anyone re-tagging anything.
   */
  keywords: string[];
  tint: string;
}

function toCategory(h: Hobby): Category {
  return {
    slug: h.slug,
    name: h.name,
    description: h.description,
    examples: h.examples ?? [],
    keywords: h.keywords ?? [],
    tint: h.tint ?? "var(--pastel-stone)",
  };
}

/** All fifteen, in the same order as hobbies.ts (hidden ones excluded, same
 * as visibleSpaces() — a hidden/retired Space shouldn't show as a browsable
 * category either). */
export const CATEGORIES: Category[] = visibleSpaces().map(toCategory);

export function getCategory(slug: string): Category | undefined {
  const h = hobbies.find((x) => x.slug === slug);
  return h ? toCategory(h) : undefined;
}

const normalise = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ");

/**
 * Whole-word matching, in one direction only.
 *
 * Substring matching looked fine and was quietly wrong: "ai" sits inside
 * "cocktail", "rowing" inside "growing", so cocktail-making filed itself
 * under Tech and houseplants under Sports. And matching the other way —
 * keyword contains label — put plain "Photography" under Food, because one
 * of Food's keywords is "food photography". A label matches a keyword when
 * it IS that keyword, or contains it as whole words.
 */
function mentions(label: string, keyword: string) {
  if (label === keyword) return true;
  if (keyword.length < 4) return false;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^| )${escaped}( |$)`).test(label);
}

/**
 * Which categories a hobby belongs to.
 *
 * A hobby can sit in more than one — food photography is genuinely both food
 * and photography — so this returns every match rather than forcing a winner.
 * Returns an empty array for something nobody has categorised yet, which is
 * not a failure: the post still exists, still appears under its own interest,
 * and still turns up in search.
 */
export function categoriesFor(label?: string): Category[] {
  if (!label) return [];
  const q = normalise(label);
  if (!q) return [];
  return CATEGORIES.filter((c) => c.keywords.some((k) => mentions(q, normalise(k))));
}

/** The first category a hobby belongs to, for places that can only show one. */
export function primaryCategory(label?: string): Category | undefined {
  return categoriesFor(label)[0];
}

/**
 * Does this post belong in this category? Checks what the maker typed first,
 * then the sub-hobby, then the Space it went into — widest net last, so a
 * post with a specific interest is filed by that rather than by its Space.
 */
export function postInCategory(
  post: { interest?: string; subHobby?: string; hobbySlug: string },
  category: Category,
  subHobbyLabel: (slug: string) => string | undefined,
): boolean {
  // Matched against the category's own keywords rather than looked up in the
  // built-in fifteen — otherwise a category approved from a suggestion could
  // never collect a single post, and approving one would produce an empty
  // page for ever.
  const hit = (label?: string) =>
    !!label && category.keywords.some((k) => mentions(normalise(label), normalise(k)));

  if (hit(post.interest)) return true;
  return hit(post.subHobby ? subHobbyLabel(post.subHobby) : undefined);
}
