import { Globe2, Lock, Users, type LucideIcon } from "lucide-react";

/**
 * "Only you" — a Moment truly nobody else can see. `private` is a real,
 * independent value here, not a stand-in for anything else. Structurally
 * typed (not `Post["visibility"]`, which doesn't carry a literal `"private"`
 * member) so this keeps working regardless of whether the type it's checking
 * against has caught up to include it.
 */
export function isOnlyYou(post: { visibility: string }): boolean {
  return post.visibility === "private";
}

type VisibilityPost = { visibility: string; circleId?: number };

/**
 * The three audiences a Moment can be switched to *after* it's posted —
 * deliberately narrower than Log.tsx's own four-way creation-time picker
 * (which also offers "followers", a real, independent tier this switcher
 * doesn't expose). Matches the three-way vocabulary Settings > Privacy's
 * "Default visibility for new Moments" already uses (`private|circle|public`),
 * so a Moment's own visibility control and the account-wide default speak
 * the same three words.
 */
export const MOMENT_VISIBILITY_OPTIONS: {
  value: "private" | "circle" | "public";
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "private", label: "Only you", icon: Lock },
  { value: "circle", label: "A Circle", icon: Users },
  { value: "public", label: "Everyone", icon: Globe2 },
];

/**
 * "Your Moments" meta-row word (MomentCard §2.1.2): `PUBLIC`, `ONLY YOU`, or
 * the Circle's own name — small-caps ready, uppercase already applied where
 * that's not a proper name. `circleName` is resolved by the caller (real
 * Circles are Supabase-backed and live in CirclesContext's own `useCircles()`
 * now — data/circles.ts's static `circles` array they used to live in is
 * empty since the seed Circles were retired, so a lookup against it here
 * would silently always miss).
 */
export function visibilityWord(post: VisibilityPost, circleName?: string): string {
  if (isOnlyYou(post)) return "ONLY YOU";
  if (post.visibility === "circle") return circleName ?? "A Circle";
  if (post.visibility === "followers") return "FOLLOWERS";
  return "PUBLIC";
}
