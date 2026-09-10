import {
  Figure,
  Sparkles,
  PaintPalette,
  PottedPlant,
  WateringCan,
  Easel,
  LaptopCode,
  hashSeed,
  mulberry32,
  skinFor,
  hairFor,
  INK,
  PAPER,
  PAPER_DARK,
  TERRACOTTA,
  RUST,
  MUSTARD,
  MUSTARD_LIGHT,
  OLIVE,
  SAGE,
  DENIM,
  BLUSH,
  CREAM,
} from "./GeneratedArt";
import type { WorldSpace } from "../data/worldSpaces";

/**
 * Nine bespoke little worlds for the landing page's "Whatever pulls you in"
 * section — same flat, warm, rounded illustration language as GeneratedArt
 * (same Figure, same palette, same shape primitives), just never fed through
 * its hobby/product-driven variant picker, since every card here is a fixed,
 * named thing rather than an arbitrary post. New props defined below (Guitar,
 * Camera, Cake, BookStack, SculptureForm, PotteryWheel) follow the same
 * "small self-contained SVG group, positioned by x/y, scaled by s" shape
 * GeneratedArt's own props already use, so they read as one family.
 */

function Guitar({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 0 30 Q -24 34 -22 58 Q -20 78 0 78 Q 20 78 22 58 Q 24 34 0 30 Z" fill={TERRACOTTA} />
      <ellipse cx={0} cy={54} rx={9} ry={7} fill={INK} opacity={0.6} />
      <rect x={-5} y={-46} width={10} height={80} rx={3} fill={RUST} />
      <rect x={-7} y={-52} width={14} height={10} rx={3} fill={INK} opacity={0.75} />
      <line x1={-3} y1={30} x2={-3} y2={70} stroke={CREAM} strokeWidth={1} opacity={0.5} />
      <line x1={2} y1={30} x2={2} y2={70} stroke={CREAM} strokeWidth={1} opacity={0.5} />
    </g>
  );
}

function Camera({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-32} y={-18} width={64} height={42} rx={8} fill={INK} />
      <rect x={-14} y={-30} width={28} height={14} rx={4} fill={INK} />
      <circle cx={0} cy={4} r={16} fill={DENIM} />
      <circle cx={0} cy={4} r={10} fill="#1b2733" />
      <circle cx={-5} cy={-1} r={3} fill={CREAM} opacity={0.6} />
      <circle cx={24} cy={-10} r={3.5} fill={MUSTARD} />
    </g>
  );
}

function Cake({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={44} rx={40} ry={9} fill={PAPER_DARK} />
      <path d="M -34 44 L -30 12 Q -30 6 -24 6 L 24 6 Q 30 6 30 12 L 34 44 Z" fill={BLUSH} />
      <rect x={-30} y={2} width={60} height={10} rx={3} fill={CREAM} />
      <path d="M -22 2 Q -22 -12 -14 -12 Q -6 -12 -6 2 Z" fill={CREAM} />
      <path d="M -2 2 Q -2 -14 6 -14 Q 14 -14 14 2 Z" fill={CREAM} />
      <circle cx={-14} cy={-16} r={3.5} fill={RUST} />
      <circle cx={6} cy={-18} r={3.5} fill={RUST} />
      <path d="M -30 24 L 30 24" stroke={RUST} strokeWidth={2} opacity={0.4} />
    </g>
  );
}

function BookStack({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-30} y={16} width={60} height={12} rx={2} fill={DENIM} />
      <rect x={-26} y={4} width={52} height={12} rx={2} fill={TERRACOTTA} />
      <rect x={-22} y={-8} width={44} height={12} rx={2} fill={OLIVE} />
      <path d="M -14 -8 L 26 -30 L 34 -22 L -4 2 Z" fill={MUSTARD} />
      <path d="M -14 -8 L 26 -30" stroke={INK} strokeWidth={1} opacity={0.3} />
    </g>
  );
}

function SculptureForm({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  const bronze = "#8A6A49";
  const bronzeDark = "#6B4E35";
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-30} y={30} width={60} height={14} rx={2} fill={PAPER_DARK} />
      <rect x={-20} y={10} width={40} height={22} rx={3} fill={bronzeDark} />
      <path
        d="M -8 10 Q -20 -10 -6 -30 Q 2 -42 12 -30 Q 22 -16 10 -2 Q 18 6 8 10 Z"
        fill={bronze}
      />
      <ellipse cx={2} cy={-28} rx={6} ry={7} fill={bronze} />
    </g>
  );
}

/** A quiet pottery-wheel moment, the same combination proven in
 * GeneratedArt's own crafting scenes — kept here rather than imported since
 * it was written inline there, not as a standalone prop. */
function PotteryWheel({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={28} rx={30} ry={8} fill="#8B5A3C" />
      <path d="M -16 -2 Q 0 -14 16 -2 Q 20 14 0 20 Q -20 14 -16 -2 Z" fill={RUST} />
      <ellipse cx={0} cy={0} rx={17} ry={5} fill={TERRACOTTA} opacity={0.7} />
    </g>
  );
}

/** Exported so HeroWorldsArt.tsx can composite the same scenes at a larger
 * scale onto one big illustration, rather than re-describing each one. */
export const WORLD_SCENES: Record<WorldSpace["illustration"], (rand: () => number, skin: string, hair: string) => JSX.Element> = {
  music: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={168} rx={56} ry={9} fill={PAPER_DARK} />
      <Figure x={78} y={112} skin={skin} hair={hair} outfit={DENIM} pose="sit" />
      <Guitar x={124} y={128} s={0.72} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} color={MUSTARD} />
    </>
  ),
  painting: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={172} rx={56} ry={9} fill={PAPER_DARK} />
      <Easel x={126} y={118} s={0.85} />
      <Figure x={62} y={128} skin={skin} hair={hair} outfit={BLUSH} pose="reach" />
      <PaintPalette x={54} y={162} s={0.5} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 120, r: 55 }} />
    </>
  ),
  sculpture: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={170} rx={56} ry={9} fill={PAPER_DARK} />
      <SculptureForm x={126} y={122} s={0.72} />
      <Figure x={62} y={128} skin={skin} hair={hair} outfit={OLIVE} pose="lean" />
      <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 130, r: 55 }} color={MUSTARD_LIGHT} />
    </>
  ),
  gardening: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={172} rx={58} ry={9} fill={PAPER_DARK} />
      <Figure x={64} y={124} skin={skin} hair={hair} outfit={TERRACOTTA} pose="kneel" />
      <PottedPlant x={128} y={132} s={0.85} />
      <WateringCan x={158} y={156} s={0.55} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} color={SAGE} />
    </>
  ),
  reading: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={168} rx={54} ry={9} fill={PAPER_DARK} />
      <Figure x={72} y={110} skin={skin} hair={hair} outfit={OLIVE} pose="sit" />
      <BookStack x={128} y={132} s={0.72} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} color={MUSTARD} />
    </>
  ),
  baking: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={172} rx={56} ry={9} fill={PAPER_DARK} />
      <Figure x={62} y={112} skin={skin} hair={hair} outfit={BLUSH} pose="stand" />
      <Cake x={130} y={136} s={0.85} />
      <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 130, r: 55 }} color={RUST} />
    </>
  ),
  coding: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={166} rx={58} ry={9} fill={PAPER_DARK} />
      <Figure x={70} y={112} skin={skin} hair={hair} outfit={OLIVE} pose="sit" />
      <LaptopCode x={128} y={132} s={0.85} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} color={DENIM} />
    </>
  ),
  photography: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={170} rx={56} ry={9} fill={PAPER_DARK} />
      <Figure x={68} y={116} skin={skin} hair={hair} outfit={DENIM} pose="reach" />
      <Camera x={128} y={128} s={0.78} />
      <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 120, r: 55 }} color={MUSTARD} />
    </>
  ),
  pottery: (rand, skin, hair) => (
    <>
      <ellipse cx={100} cy={166} rx={54} ry={9} fill={PAPER_DARK} />
      <Figure x={70} y={112} skin={skin} hair={hair} outfit={TERRACOTTA} pose="kneel" scale={1.02} />
      <PotteryWheel x={126} y={140} s={0.82} />
      <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} />
    </>
  ),
};

/**
 * One World's illustration. Deterministic per slug — same figure, same
 * accents every time it renders, which is right for a small fixed set of
 * named cards (unlike GeneratedArt's per-post hashing, nothing here needs to
 * vary render to render).
 */
export function WorldIllustration({
  illustration,
  seed,
  className,
  idleClassName = "ns-breathe",
  idleDelay = 0,
}: {
  illustration: WorldSpace["illustration"];
  seed: string;
  className?: string;
  /** One of GeneratedArt's ns-breathe/ns-sway/ns-drift classes, applied to
   * the inner SVG group in place of GeneratedArt's own generated-art-float
   * (they're built for transform-box: fill-box, an SVG-only value, and two
   * animation classes on one element would just have the later one in the
   * stylesheet silently win rather than combining). Defaults to ns-breathe. */
  idleClassName?: string;
  /** Seconds of negative animation-delay, so a row of cards sharing the same
   * idle class don't all breathe/sway in lockstep. */
  idleDelay?: number;
}) {
  const rand = mulberry32(hashSeed(`world:${seed}`));
  const skin = skinFor(rand);
  const hair = hairFor(rand);
  const scene = WORLD_SCENES[illustration];
  const rotate = Math.round(rand() * 4 - 2);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ backgroundColor: PAPER }}>
      <div
        className="ns-world-card-life animate-float-slow absolute rounded-full blur-2xl"
        style={{
          left: `${20 + rand() * 45}%`,
          top: `${10 + rand() * 35}%`,
          width: "62%",
          height: "62%",
          background: `radial-gradient(circle, ${MUSTARD_LIGHT}55, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 200 200" style={{ width: "86%", height: "86%", transform: `rotate(${rotate}deg)` }}>
          <g className={idleClassName} style={idleDelay ? { animationDelay: `-${idleDelay}s` } : undefined}>
            {scene(rand, skin, hair)}
          </g>
        </svg>
      </div>
    </div>
  );
}
