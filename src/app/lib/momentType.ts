export type MomentType = "photo" | "video" | "written";

/**
 * Which Post.type a Moment gets — one place, so the composer (at publish
 * time) and the DB backfill's own classification of existing rows agree on
 * the same rule.
 *
 * data/posts.ts documents mediaUrls as one Moment carrying either several
 * photos or exactly one video, never both — so a genuinely mixed
 * photo+video submission isn't expected to reach this function today. It's
 * handled anyway, deliberately, rather than left as an unstated assumption:
 * video wins whenever any video is present, on the theory that a video is
 * the more specific, harder-to-produce attachment, and silently dropping it
 * to "photo" (or splitting the Moment) would lose more than filing it as a
 * video does. No attachment at all is "written".
 */
export function classifyMomentType(files: { type: string }[]): MomentType {
  if (files.length === 0) return "written";
  return files.some((f) => f.type.startsWith("video")) ? "video" : "photo";
}
