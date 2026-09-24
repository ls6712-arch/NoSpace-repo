import { INK, PAPER, PAPER_DARK, MUSTARD, type SubArtDrawing } from "./subart/palette";
import { LEGACY_SPACES } from "../data/hobbies";
import { workbenchArt } from "./subart/workbench";
import { makerlabArt } from "./subart/makerlab";
import { buildstackArt } from "./subart/buildstack";
import { inmotionArt } from "./subart/inmotion";
import { kitchentableArt } from "./subart/kitchentable";
import { rootedArt } from "./subart/rooted";
import { thestudioArt } from "./subart/thestudio";
import { rabbitholeArt } from "./subart/rabbithole";

/**
 * One small flat-vector illustration per individual hobby — the thing that
 * makes a space browsable by picture instead of by word list. Same palette and
 * same drawing language as GeneratedArt.tsx (which draws the big per-category
 * hero scenes); these are the little ones, keyed by hobby slug.
 *
 * Each drawing lives in subart/<category>.tsx and emits only SVG children —
 * the <svg>, viewBox, parchment ground and shadow all come from here, so every
 * tile is framed identically and a drawing can never break the layout.
 */
const SUB_ART: Record<string, Record<string, SubArtDrawing>> = {
  workbench: workbenchArt,
  makerlab: makerlabArt,
  buildstack: buildstackArt,
  inmotion: inmotionArt,
  kitchentable: kitchentableArt,
  rooted: rootedArt,
  thestudio: thestudioArt,
  rabbithole: rabbitholeArt,
};

/** Every drawing, flattened, for the rare lookup that only knows the sub-slug. */
const FLAT_ART: Record<string, SubArtDrawing> = Object.assign(
  {},
  ...Object.values(SUB_ART),
);

/**
 * Shown only if a hobby somehow has no drawing — a plain mark rather than an
 * empty tile, so a missing entry degrades quietly instead of leaving a hole.
 */
const Fallback: SubArtDrawing = () => (
  <>
    <ellipse cx={100} cy={150} rx={34} ry={7} fill={INK} opacity={0.13} />
    <circle cx={100} cy={108} r={30} fill={PAPER_DARK} />
    <path
      d="M 100 88 L 106 102 L 120 108 L 106 114 L 100 128 L 94 114 L 80 108 L 94 102 Z"
      fill={MUSTARD}
    />
  </>
);

export function hasSubHobbyArt(hobbySlug: string, subSlug: string) {
  return Boolean(SUB_ART[hobbySlug]?.[subSlug]);
}

export function SubHobbyArt({
  hobbySlug,
  subSlug,
  className,
}: {
  hobbySlug: string;
  subSlug: string;
  className?: string;
}) {
  const resolvedHobbySlug = SUB_ART[hobbySlug] ? hobbySlug : LEGACY_SPACES[hobbySlug] ?? hobbySlug;
  const Drawing = SUB_ART[resolvedHobbySlug]?.[subSlug] ?? FLAT_ART[subSlug] ?? Fallback;

  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={200} height={200} fill={PAPER} />
      <ellipse cx={100} cy={168} rx={120} ry={40} fill={PAPER_DARK} opacity={0.55} />
      <Drawing />
    </svg>
  );
}
