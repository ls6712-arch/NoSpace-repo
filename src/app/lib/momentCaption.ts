import { hobbies } from "../data/hobbies";
import { postCorner, type Post } from "../data/posts";

type CaptionPost = Pick<Post, "caption" | "hobbySlug" | "subHobby" | "corner">;

const norm = (s: string) => s.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Some Moments were saved with a caption the app wrote for them, in the shape
 * "A {space or Corner} moment" ("A food photography moment"). That is not
 * something a person said, so it is never shown as a title. Only that exact
 * shape, built from the Moment's own Space or Corner, counts: a person who
 * writes "A good moment" keeps their words.
 */
export function isGeneratedCaption(post: CaptionPost): boolean {
  const m = /^an?\s+(.+?)\s+moment\.?$/i.exec((post.caption ?? "").trim());
  if (!m) return false;
  const middle = norm(m[1]);
  const hobby = hobbies.find((h) => h.slug === post.hobbySlug);
  const corner = postCorner(post);
  const known = [
    hobby?.name,
    hobby?.shortName,
    corner,
    post.subHobby,
    corner ? hobby?.subItems.find((s) => s.slug === corner)?.label : undefined,
    post.subHobby ? hobby?.subItems.find((s) => s.slug === post.subHobby)?.label : undefined,
  ];
  return known.some((k) => !!k && norm(k) === middle);
}

/** The person's own caption, or "" when there is none or the app wrote it. */
export function momentCaption(post: CaptionPost): string {
  const c = (post.caption ?? "").trim();
  return !c || isGeneratedCaption(post) ? "" : c;
}

/** Alt text for a Moment's photo: their caption, else "{Corner} Moment by {name}". */
export function momentAlt(post: CaptionPost & { creator: string }, cornerLabel: string): string {
  return momentCaption(post) || `${cornerLabel || "A"} Moment by ${post.creator}`.trim();
}
