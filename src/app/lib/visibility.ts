import { Globe2, Lock, Users, type LucideIcon } from "lucide-react";

/**
 * "Only you" — the closest existing thing to a private Moment. There is no
 * literal `private` value in `Visibility` yet (`public | circle | friends`);
 * `friends` depended on the now-retired Connections feature and is the
 * closest analog until Task C adds a real one. Structurally typed (not
 * `Post["visibility"]`) so this keeps working the moment that value exists,
 * with no signature change needed here or at any call site.
 */
export function isOnlyYou(post: { visibility: string }): boolean {
  return post.visibility === "friends" || post.visibility === "private";
}

type VisibilityPost = { visibility: string; circleId?: number };

/**
 * The three audiences a Moment can be switched to *after* it's posted —
 * deliberately narrower than Log.tsx's own four-way creation-time picker
 * (which still offers the legacy "friends"/Connections value for whatever
 * keeps using it). Matches the three-way vocabulary Settings > Privacy's
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
  return "PUBLIC";
}
