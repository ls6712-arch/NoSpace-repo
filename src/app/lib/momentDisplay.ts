import { Post } from "../data/posts";
import { subHobbyLabel, findSpaceForInterest } from "../data/hobbies";
import { tagTint } from "../components/WorkGrid";

/**
 * The label a Moment's own tile shows for "what this is about" — the same
 * choice WorkGrid.tsx's cornerLabel already makes: a real Corner tag first,
 * else the Moment's own first open tag. Never hobby.name/shortName — see
 * Log.tsx's hobbySlug-default fix for why that used to be a silent, often-
 * wrong fallback. Shared here so the profile's cover strip and editorial
 * grid tiles agree with WorkGrid on what a Moment is "about" instead of
 * three separately maintained versions of the same choice.
 */
export function momentLabel(post: Post): string | undefined {
  return post.subHobby ? subHobbyLabel(post.subHobby) ?? post.subHobby : post.tags?.[0];
}

/**
 * This label's color — reuses WorkGrid's existing per-Space palette
 * (tagTint), resolved through the same known-Corner lookup TagsField
 * already uses for a tag with no subHobby of its own, so a tag that
 * matches a real Space gets that Space's actual color rather than a
 * second, separately hashed one. A color is never a claim the way text is,
 * so falling back to hobbySlug here (which can be nothing more than
 * Log.tsx's not-null-column filler) is harmless — same reasoning GeneratedArt
 * and tagTint's own existing hobbySlug-only callers already rely on.
 */
export function momentTint(post: Post): string {
  if (post.subHobby) return tagTint(post.hobbySlug);
  const match = post.tags?.[0] ? findSpaceForInterest(post.tags[0]) : undefined;
  return tagTint(match?.hobbySlug ?? post.hobbySlug);
}
