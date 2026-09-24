import { Globe2, Lock, UserRound, type LucideIcon } from "lucide-react";

/**
 * "Only you" — a Moment truly nobody else can see. Spaces Rework: real
 * (Supabase-backed) posts are migrated to `just_me`, the new name for what
 * used to be `private`. `private` stays checked here too — private-log
 * stand-ins (You.tsx's `privateLogsAsPosts`) hardcode `visibility: "private"`
 * client-side and never touch the database, so the migration can't reach
 * them. Structurally typed (not `Post["visibility"]`) so this keeps working
 * regardless of whether the type it's checking against has caught up.
 */
export function isOnlyYou(post: { visibility: string }): boolean {
  return post.visibility === "just_me" || post.visibility === "private";
}

type VisibilityPost = { visibility: string };

/**
 * The audiences a Moment can be switched to after it's posted. `space` isn't
 * offered here yet — real Space membership (and picking *which* Space)
 * lands in a later phase; until then there's nothing coherent to switch a
 * Moment's audience to that a Space membership check could enforce.
 */
export const MOMENT_VISIBILITY_OPTIONS: {
  value: "just_me" | "followers" | "public";
  label: string;
  icon: LucideIcon;
}[] = [
  { value: "just_me", label: "Only you", icon: Lock },
  { value: "followers", label: "Followers", icon: UserRound },
  { value: "public", label: "Everyone", icon: Globe2 },
];

/**
 * "Your Moments" meta-row word (MomentCard §2.1.2): `PUBLIC`, `ONLY YOU`,
 * `FOLLOWERS` — small-caps ready, uppercase already applied. `spaceName` is
 * accepted for call-site compatibility with the old `circleName` parameter
 * (kept until MomentCard.tsx/MomentDetail.tsx are updated to stop passing a
 * Circle's name, in a later phase) but unused until a post can actually
 * carry `visibility: "space"`.
 */
export function visibilityWord(post: VisibilityPost, spaceName?: string): string {
  if (isOnlyYou(post)) return "ONLY YOU";
  if (post.visibility === "space") return spaceName ?? "A Space";
  if (post.visibility === "followers") return "FOLLOWERS";
  return "PUBLIC";
}
