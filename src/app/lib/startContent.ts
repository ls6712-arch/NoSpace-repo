import { cornerGuide, type GuideKind } from "../data/cornerGuides";
import { CURATED_CORNERS } from "../data/curatedCorners";
import { allSubHobbies } from "../data/hobbies";
import { formatDuration } from "./dates";

/**
 * What the Start page shows for a Corner, from the data the app already has:
 * the guide's first step (cornerGuides.ts), and "What you'll need" and the
 * rest of the steps (curatedCorners.ts). A Corner with none of that still has
 * a page (a name, When, With); it just has fewer sections.
 */

export interface StartContent {
  spaceSlug: string;
  cornerSlug: string;
  /** "space-slug/corner-slug". */
  key: string;
  name: string;
  emoji: string;
  /** "At home · about 90 min", "about 15 min", or "" when neither is known. */
  meta: string;
  /** A hint for the "What are you making?" field. */
  example: string;
  /** The guide's kind. "making" shows the "What are you making?" field. */
  kind: GuideKind | null;
  /** Plain facts the person starts their own list from. */
  needs: string[];
  /** The guide step first, then the curated steps. */
  steps: string[];
}

const DEFAULT_EMOJI = "✨";

/** Placeholders for the dish field. Anything else shows the Corner's own name. */
const EXAMPLES: Record<string, string> = {
  cooking: "cacio e pepe",
  baking: "chocolate chip cookies",
  sourdough: "a first loaf",
  fermentation: "quick pickles",
};

/** The Corner, or null when the app does not know it (the page then sends the person to the Corner page). */
export function startContent(spaceSlug: string, cornerSlug: string): StartContent | null {
  const curated = CURATED_CORNERS.find((c) => c.slug === cornerSlug && c.spaceSlug === spaceSlug);
  const known = allSubHobbies.find((s) => s.hobbySlug === spaceSlug && s.slug === cornerSlug);
  if (!curated && !known) return null;
  const guide = cornerGuide(spaceSlug, cornerSlug);
  // "At home" only for something you can do on your own at home: a curated Corner set to home, or a
  // guide that is not outdoors and does not need other people. Martial arts (indoors, together) is not.
  const atHome = curated ? curated.setting === "home" : !!guide && guide.where !== "outdoors" && guide.together !== "together";
  const minutes = curated?.durationMinutes ? formatDuration(curated.durationMinutes) : guide?.quick ? formatDuration(15) : "";
  const meta = [atHome ? "At home" : "", minutes ? `about ${minutes}` : ""].filter(Boolean).join(" · ");
  const steps = [guide?.step, ...(curated?.steps ?? [])].map((s) => s?.trim() ?? "").filter(Boolean);
  return {
    spaceSlug,
    cornerSlug,
    key: `${spaceSlug}/${cornerSlug}`,
    name: curated?.name ?? known?.label ?? cornerSlug,
    emoji: curated?.emoji ?? DEFAULT_EMOJI,
    meta,
    example: EXAMPLES[cornerSlug] ?? (curated?.name ?? known?.label ?? cornerSlug).toLowerCase(),
    kind: guide?.kind ?? null,
    needs: [...(curated?.needs ?? [])],
    steps: [...new Set(steps)],
  };
}

/** The Start page for a Corner. */
export function startPath(spaceSlug: string, cornerSlug: string, extra: { ref?: "home"; plan?: string; inspired?: number | string } = {}): string {
  const q = new URLSearchParams();
  if (extra.ref) q.set("ref", extra.ref);
  if (extra.plan) q.set("plan", extra.plan);
  if (extra.inspired !== undefined) q.set("inspired", String(extra.inspired));
  const qs = q.toString();
  return `/start/${encodeURIComponent(spaceSlug)}/${encodeURIComponent(cornerSlug)}${qs ? `?${qs}` : ""}`;
}

/** Corners Start can open from a Moment or a plan: ones with a guide, so there is a first step to show. */
export const hasStartGuide = (spaceSlug: string, cornerSlug: string): boolean => !!cornerGuide(spaceSlug, cornerSlug)?.step.trim();

/** True for a Corner Home offers as an at-home suggestion (not outdoors, not with other people). */
export function isAtHomeCorner(spaceSlug: string, cornerSlug: string): boolean {
  const g = cornerGuide(spaceSlug, cornerSlug);
  return !!g && !g.adultsOnly && g.where !== "outdoors" && g.together !== "together";
}
