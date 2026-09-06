import { hobbies } from "../data/hobbies";

/**
 * Flat-vector hobby illustrations — original artwork, drawn as SVG, in a warm
 * cohesive palette (parchment background, terracotta, mustard, olive, denim,
 * blush) with simple rounded flat-color figures, styled after the "people
 * doing hobbies" flat-illustration look. Nothing here is copied from any
 * external site or artist — it's built from scratch as reusable shape
 * primitives (figures, props) recombined into scenes — but it's drawn in the
 * same spirit: warm, flat, a little playful, one consistent palette across
 * every hobby instead of five clashing gradients.
 *
 * There's no real photography or network image fetching in this build — this
 * environment can't reach external image hosts, so every "photo" used to
 * render as a broken-image icon. This renders instead, and always works
 * offline.
 *
 * The important fix this file makes: every hobby now has FIVE distinct
 * scenes, each depicting a specific real thing from that hobby (a pottery
 * wheel, a tarot spread, a pickleball paddle, an espresso machine...), and
 * known products/posts are explicitly mapped to the scene that actually
 * matches them — so the "Pottery Starter Kit" shows a pottery wheel, not
 * knitting needles. Anything without an explicit mapping still gets a
 * deterministic, varied pick from its hobby's five scenes (hashed from its
 * id), so a feed never looks like five copies of the same card.
 */

function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Palette — one shared warm palette across every hobby (not color-coded per
// hobby), same idea as the reference style: a cohesive set of terracotta,
// mustard, olive and denim tones that reads as one illustration family.
// ---------------------------------------------------------------------------
const INK = "#3A2A1F";
const PAPER = "#F1E3C8";
const PAPER_DARK = "#E8D5AC";
const TERRACOTTA = "#C96F49";
const RUST = "#A8492F";
const MUSTARD = "#E3A83E";
const MUSTARD_LIGHT = "#F0C572";
const OLIVE = "#7C8A54";
const SAGE = "#A9B98C";
const DENIM = "#5C7C97";
const BLUSH = "#D98A82";
const CREAM = "#FBF3E2";
const SKIN_TONES = ["#E8B98C", "#C68A5E", "#8B5A3C", "#F0C9A0"];
const HAIR_TONES = ["#3A2A1F", "#6B4226", "#1E1512", "#8A5A32"];

function skinFor(rand: () => number) {
  return SKIN_TONES[Math.floor(rand() * SKIN_TONES.length) % SKIN_TONES.length];
}
function hairFor(rand: () => number) {
  return HAIR_TONES[Math.floor(rand() * HAIR_TONES.length) % HAIR_TONES.length];
}

/** A handful of small twinkling accents, scattered by the seed. */
function Sparkles({ rand, count, avoid, color = MUSTARD }: { rand: () => number; count: number; avoid?: { x: number; y: number; r: number }; color?: string }) {
  const dots = Array.from({ length: count }).map((_, i) => {
    let x = 16 + rand() * 168;
    let y = 16 + rand() * 168;
    if (avoid) {
      const dx = x - avoid.x;
      const dy = y - avoid.y;
      if (Math.hypot(dx, dy) < avoid.r) {
        x = avoid.x + (dx >= 0 ? avoid.r : -avoid.r);
        y = avoid.y + (dy >= 0 ? avoid.r : -avoid.r);
      }
    }
    const s = 2.5 + rand() * 3;
    const delay = rand() * 2.4;
    return { x, y, s, delay, key: i };
  });
  return (
    <>
      {dots.map((d) => (
        <path
          key={d.key}
          className="generated-art-sparkle"
          style={{ animationDelay: `${d.delay.toFixed(2)}s` }}
          d={`M ${d.x} ${d.y - d.s} L ${d.x + d.s * 0.3} ${d.y - d.s * 0.3} L ${d.x + d.s} ${d.y} L ${d.x + d.s * 0.3} ${d.y + d.s * 0.3} L ${d.x} ${d.y + d.s} L ${d.x - d.s * 0.3} ${d.y + d.s * 0.3} L ${d.x - d.s} ${d.y} L ${d.x - d.s * 0.3} ${d.y - d.s * 0.3} Z`}
          fill={color}
          opacity={0.75}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Figure — a small reusable flat-vector person: circle head, half-circle
// "hair" cap, rounded torso block, simple stroked limbs. Recombined with
// different poses/props across every scene below.
// ---------------------------------------------------------------------------
type Pose = "sit" | "kneel" | "stand" | "lean" | "reach";

function Figure({
  x,
  y,
  skin,
  hair,
  outfit,
  pose = "sit",
  flip = false,
  scale = 1,
}: {
  x: number;
  y: number;
  skin: string;
  hair: string;
  outfit: string;
  pose?: Pose;
  flip?: boolean;
  scale?: number;
}) {
  const headR = 15 * scale;
  const armW = 8 * scale;
  return (
    <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * scale} ${scale})`}>
      {/* torso */}
      {pose === "sit" && (
        <path d="M -22 10 Q -24 44 -14 58 L 14 58 Q 24 44 22 10 Q 22 -6 0 -6 Q -22 -6 -22 10 Z" fill={outfit} />
      )}
      {pose === "kneel" && (
        <path d="M -20 8 Q -22 40 -10 54 L 12 54 Q 22 38 20 8 Q 20 -8 0 -8 Q -20 -8 -20 8 Z" fill={outfit} />
      )}
      {(pose === "stand" || pose === "lean" || pose === "reach") && (
        <path d="M -18 8 Q -20 46 -16 62 L 16 62 Q 20 46 18 8 Q 18 -8 0 -8 Q -18 -8 -18 8 Z" fill={outfit} />
      )}
      {/* arms */}
      {pose === "sit" && (
        <>
          <path d="M -18 4 Q -34 20 -30 40" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
          <path d="M 18 4 Q 34 20 30 40" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
        </>
      )}
      {pose === "kneel" && (
        <>
          <path d="M -16 2 Q -30 14 -26 32" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
          <path d="M 16 2 Q 30 14 26 32" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
        </>
      )}
      {pose === "stand" && (
        <>
          <path d="M -14 4 Q -26 24 -20 46" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
          <path d="M 14 4 Q 26 24 20 46" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
        </>
      )}
      {pose === "lean" && (
        <>
          <path d="M -14 6 Q -30 10 -34 28" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
          <path d="M 14 6 Q 22 26 12 44" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
        </>
      )}
      {pose === "reach" && (
        <>
          <path d="M -14 2 Q -22 -16 -10 -34" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
          <path d="M 14 6 Q 26 22 18 42" fill="none" stroke={outfit} strokeWidth={armW} strokeLinecap="round" />
        </>
      )}
      {/* legs, only for kneel/sit where feet peek out */}
      {pose === "sit" && (
        <path d="M -14 56 Q -10 68 6 66 M 8 58 Q 16 68 26 62" fill="none" stroke={outfit} strokeWidth={armW * 0.9} strokeLinecap="round" opacity={0.9} />
      )}
      {/* neck + head */}
      <rect x={-6} y={-16} width={12} height={10} rx={4} fill={skin} />
      <circle cx={0} cy={-28} r={headR} fill={skin} />
      <path d={`M ${-headR} -28 A ${headR} ${headR} 0 0 1 ${headR} -28 Q ${headR} -${headR + 14} 0 -${headR + 15} Q -${headR} -${headR + 14} -${headR} -28 Z`} fill={hair} />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Small prop primitives, reused across scenes.
// ---------------------------------------------------------------------------
function Mug({ x, y, color = TERRACOTTA, s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -16 -20 L -14 20 Q -14 26 -8 26 L 8 26 Q 14 26 14 20 L 16 -20 Z" fill={color} />
      <path d="M 16 -8 Q 32 -8 32 6 Q 32 20 16 18" fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={0} cy={-20} rx={16} ry={4.5} fill={INK} opacity={0.18} />
    </g>
  );
}
function YarnAndNeedles({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={30} fill={TERRACOTTA} />
      <path d="M -22 -8 C -6 -18, 12 -18, 24 -4" fill="none" stroke={RUST} strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      <path d="M -24 8 C -6 18, 14 18, 24 4" fill="none" stroke={RUST} strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      <path d="M -16 22 C -2 10, 14 10, 22 22" fill="none" stroke={RUST} strokeWidth={2} opacity={0.6} strokeLinecap="round" />
      <path d="M -10 -36 L -32 -70" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 10 -36 L 32 -70" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <circle cx={-32} cy={-70} r={3.5} fill={MUSTARD_LIGHT} />
      <circle cx={32} cy={-70} r={3.5} fill={MUSTARD_LIGHT} />
    </g>
  );
}
function EmbroideryHoop({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle r={38} fill="none" stroke={RUST} strokeWidth={7} />
      <circle r={38} fill={CREAM} />
      <path d="M -20 -6 Q -8 -22 8 -8 Q 20 4 12 18" fill="none" stroke={TERRACOTTA} strokeWidth={4} strokeLinecap="round" />
      <circle cx={-16} cy={2} r={4} fill={OLIVE} />
      <circle cx={10} cy={-10} r={4} fill={MUSTARD} />
      <circle cx={6} cy={14} r={4} fill={BLUSH} />
    </g>
  );
}
function Candle({ x, y, color = OLIVE, s = 1 }: { x: number; y: number; color?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-14} y={-30} width={28} height={44} rx={4} fill={color} />
      <ellipse cx={0} cy={-30} rx={14} ry={4} fill={MUSTARD_LIGHT} />
      <path d="M 0 -42 Q 6 -50 0 -58 Q -6 -50 0 -42 Z" fill={RUST} />
      <line x1={0} y1={-30} x2={0} y2={-42} stroke={INK} strokeWidth={1.5} />
    </g>
  );
}
function PaintPalette({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -30 0 Q -32 -28 0 -30 Q 32 -28 30 4 Q 28 22 8 18 Q 4 16 8 12 Q 12 8 4 6 Q -30 6 -30 0 Z" fill={PAPER_DARK} />
      <circle cx={-14} cy={-14} r={5} fill={TERRACOTTA} />
      <circle cx={4} cy={-18} r={5} fill={OLIVE} />
      <circle cx={18} cy={-8} r={5} fill={MUSTARD} />
      <circle cx={-16} cy={2} r={5} fill={DENIM} />
      <circle cx={2} cy={2} r={5} fill={BLUSH} />
    </g>
  );
}
function TarotCards({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-38} y={-16} width={30} height={46} rx={4} fill={DENIM} transform="rotate(-12)" />
      <rect x={-15} y={-24} width={30} height={46} rx={4} fill={TERRACOTTA} />
      <rect x={8} y={-16} width={30} height={46} rx={4} fill={OLIVE} transform="rotate(12)" />
      <circle cx={0} cy={-4} r={7} fill={MUSTARD_LIGHT} opacity={0.9} />
    </g>
  );
}
function CrystalCluster({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -6 30 L -18 -6 L -2 -34 L 14 -10 Z" fill="#B9A4CE" />
      <path d="M 16 30 L 6 -2 L 22 -22 L 34 0 Z" fill={BLUSH} />
      <path d="M -20 30 L -28 6 L -16 -8 L -6 10 Z" fill={SAGE} />
      <line x1={-18} y1={-6} x2={14} y2={-10} stroke={INK} strokeWidth={1} opacity={0.25} />
    </g>
  );
}
function MoonAndJar({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M 4 -46 A 22 22 0 1 0 4 -2 A 16 16 0 1 1 4 -46 Z" fill={MUSTARD_LIGHT} />
      <path d="M -24 8 L -24 44 Q -24 52 -16 52 L 16 52 Q 24 52 24 44 L 24 8 Z" fill="none" stroke={DENIM} strokeWidth={4} />
      <path d="M -18 2 L 18 2" stroke={DENIM} strokeWidth={4} strokeLinecap="round" />
      <path d="M -20 20 L 20 20 L 18 42 Q 18 46 14 46 L -14 46 Q -18 46 -18 42 Z" fill={DENIM} opacity={0.35} />
    </g>
  );
}
function JournalBook({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -32 -22 L 0 -14 L 0 26 L -32 18 Z" fill={TERRACOTTA} />
      <path d="M 32 -22 L 0 -14 L 0 26 L 32 18 Z" fill={RUST} />
      <line x1={-24} y1={-10} x2={-4} y2={-6} stroke={CREAM} strokeWidth={1.5} opacity={0.8} />
      <line x1={-24} y1={-2} x2={-4} y2={2} stroke={CREAM} strokeWidth={1.5} opacity={0.8} />
      <line x1={-24} y1={6} x2={-4} y2={10} stroke={CREAM} strokeWidth={1.5} opacity={0.8} />
    </g>
  );
}
function PickleballPaddle({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <rect x={-20} y={-52} width={40} height={54} rx={18} fill={MUSTARD} />
      <rect x={-6} y={2} width={12} height={26} rx={4} fill={INK} opacity={0.75} />
      <circle cx={40} cy={-58} r={9} fill={CREAM} />
      <circle cx={40} cy={-58} r={9} fill="none" stroke={INK} strokeWidth={1} opacity={0.3} />
    </g>
  );
}
function PadelRacket({ x, y, s = 1, rot = 0 }: { x: number; y: number; s?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <ellipse cx={0} cy={-30} rx={26} ry={32} fill={DENIM} />
      {Array.from({ length: 5 }).map((_, i) => (
        <line key={i} x1={-18 + i * 9} y1={-58} x2={-18 + i * 9} y2={-2} stroke={CREAM} strokeWidth={1.2} opacity={0.35} />
      ))}
      <rect x={-6} y={2} width={12} height={26} rx={4} fill={INK} opacity={0.75} />
    </g>
  );
}
function SportNet({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <line x1={-40} y1={30} x2={-40} y2={-34} stroke={OLIVE} strokeWidth={6} strokeLinecap="round" />
      <line x1={40} y1={30} x2={40} y2={-34} stroke={OLIVE} strokeWidth={6} strokeLinecap="round" />
      <rect x={-40} y={-34} width={80} height={26} fill={CREAM} opacity={0.85} />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={`v${i}`} x1={-34 + i * 13.6} y1={-34} x2={-34 + i * 13.6} y2={-8} stroke={DENIM} strokeWidth={1} opacity={0.4} />
      ))}
      <line x1={-40} y1={-8} x2={40} y2={-8} stroke={DENIM} strokeWidth={1.2} opacity={0.5} />
    </g>
  );
}
function Sneaker({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -34 10 Q -34 -14 -14 -18 L 20 -10 Q 34 -6 34 6 L 34 14 Q 34 20 26 20 L -28 20 Q -34 20 -34 14 Z" fill={TERRACOTTA} />
      <path d="M -14 -18 L -6 -2 L 20 -10 Z" fill={RUST} />
      <path d="M -30 14 L 30 14" stroke={CREAM} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
    </g>
  );
}
function WaterBottle({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-14} y={-40} width={28} height={12} rx={4} fill={DENIM} />
      <path d="M -18 -28 Q -18 -30 -14 -30 L 14 -30 Q 18 -30 18 -28 L 18 34 Q 18 44 8 44 L -8 44 Q -18 44 -18 34 Z" fill={SAGE} />
      <rect x={-18} y={0} width={36} height={10} fill={CREAM} opacity={0.5} />
    </g>
  );
}
function EspressoMachine({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-32} y={-50} width={64} height={44} rx={6} fill={RUST} />
      <rect x={-24} y={-42} width={20} height={18} rx={2} fill={CREAM} opacity={0.35} />
      <rect x={-10} y={-6} width={20} height={10} fill={INK} opacity={0.5} />
      <Mug x={0} y={30} color={TERRACOTTA} s={0.6} />
    </g>
  );
}
function SyrupBottles({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-30} y={-10} width={16} height={40} rx={4} fill={OLIVE} />
      <rect x={-8} y={-26} width={16} height={56} rx={4} fill={TERRACOTTA} />
      <rect x={14} y={-16} width={16} height={46} rx={4} fill={MUSTARD} />
      <rect x={-26} y={-20} width={8} height={10} rx={2} fill={INK} opacity={0.6} />
      <rect x={-4} y={-36} width={8} height={10} rx={2} fill={INK} opacity={0.6} />
      <rect x={18} y={-26} width={8} height={10} rx={2} fill={INK} opacity={0.6} />
    </g>
  );
}
function CoffeeTray({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-40} y={4} width={80} height={16} rx={6} fill={RUST} />
      <Mug x={-18} y={-6} color={TERRACOTTA} s={0.55} />
      <Mug x={16} y={-6} color={OLIVE} s={0.55} />
    </g>
  );
}
function MilkFrother({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -14 -34 L -18 20 Q -18 28 -10 28 L 10 28 Q 18 28 18 20 L 14 -34 Z" fill={CREAM} />
      <path d="M 0 -34 L 0 -4" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <circle cx={0} cy={-38} r={6} fill={MUSTARD} />
      <circle cx={-6} cy={4} r={3} fill={DENIM} opacity={0.4} />
      <circle cx={4} cy={10} r={3} fill={DENIM} opacity={0.4} />
    </g>
  );
}
function Blanket({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -40 -8 Q -20 -22 4 -14 Q 30 -6 38 14 Q 20 26 -6 22 Q -34 18 -40 -8 Z" fill={SAGE} />
      <path d="M -26 -6 Q -10 -14 8 -8" fill="none" stroke={CREAM} strokeWidth={2} opacity={0.6} />
      <path d="M -30 4 Q -10 -2 14 6" fill="none" stroke={CREAM} strokeWidth={2} opacity={0.6} />
      <JournalBook x={4} y={-2} s={0.4} />
    </g>
  );
}
function Shelf({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-44} y={20} width={88} height={7} rx={2} fill={RUST} />
      <rect x={-44} y={-14} width={88} height={7} rx={2} fill={RUST} />
      <circle cx={-24} cy={-2} r={9} fill={TERRACOTTA} />
      <rect x={-6} y={-10} width={14} height={16} rx={3} fill={OLIVE} />
      <path d="M 18 6 L 12 -10 L 26 -10 Z" fill={MUSTARD} />
    </g>
  );
}
function CardBinder({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-30} y={-36} width={60} height={72} rx={6} fill={DENIM} />
      <rect x={-30} y={-36} width={10} height={72} fill={INK} opacity={0.25} />
      <rect x={-14} y={-24} width={16} height={22} rx={2} fill={CREAM} opacity={0.85} />
      <rect x={6} y={-24} width={16} height={22} rx={2} fill={CREAM} opacity={0.85} />
      <rect x={-14} y={2} width={16} height={22} rx={2} fill={CREAM} opacity={0.85} />
      <rect x={6} y={2} width={16} height={22} rx={2} fill={CREAM} opacity={0.85} />
    </g>
  );
}
function SashikoCloth({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-34} y={-24} width={68} height={48} rx={4} fill={DENIM} />
      {Array.from({ length: 4 }).map((_, i) => (
        <line key={i} x1={-28} y1={-16 + i * 10} x2={28} y2={-16 + i * 10} stroke={CREAM} strokeWidth={1.5} strokeDasharray="4 4" opacity={0.8} />
      ))}
      <circle cx={20} cy={16} r={5} fill={MUSTARD} />
      <line x1={20} y1={16} x2={30} y2={26} stroke={INK} strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}
function DisplayCase({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-34} y={-24} width={68} height={48} rx={4} fill={RUST} />
      {[0, 1].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}-${c}`} x={-28 + c * 20} y={-18 + r * 20} width={16} height={16} rx={2} fill={CREAM} opacity={0.85} />
        ))
      )}
      <circle cx={-20} cy={-10} r={3} fill={MUSTARD} />
      <circle cx={0} cy={10} r={3} fill={TERRACOTTA} />
      <circle cx={20} cy={-10} r={3} fill={SAGE} />
    </g>
  );
}
function ToteBag({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -6 -40 Q -6 -54 6 -54 Q 18 -54 18 -40" fill="none" stroke={INK} strokeWidth={3} opacity={0.5} transform="translate(-6 0)" />
      <path d="M -30 -18 L -34 30 Q -34 36 -28 36 L 30 36 Q 36 36 36 30 L 32 -18 Z" fill={MUSTARD} />
      <rect x={-24} y={-4} width={20} height={16} fill={TERRACOTTA} opacity={0.85} />
      <rect x={2} y={10} width={18} height={14} fill={SAGE} opacity={0.85} />
    </g>
  );
}

function Printer3D({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-36} y={-56} width={72} height={10} rx={3} fill={INK} opacity={0.55} />
      <line x1={-30} y1={-56} x2={-30} y2={14} stroke={INK} strokeWidth={5} opacity={0.55} />
      <line x1={30} y1={-56} x2={30} y2={14} stroke={INK} strokeWidth={5} opacity={0.55} />
      <rect x={-34} y={8} width={68} height={10} rx={3} fill={DENIM} />
      <rect x={-18} y={-40} width={36} height={8} rx={2} fill={MUSTARD} />
      <rect x={-14} y={-30} width={28} height={7} rx={1.5} fill={TERRACOTTA} opacity={0.9} />
      <rect x={-11} y={-21} width={22} height={7} rx={1.5} fill={TERRACOTTA} opacity={0.75} />
      <rect x={-8} y={-12} width={16} height={7} rx={1.5} fill={TERRACOTTA} opacity={0.6} />
      <circle cx={26} cy={-50} r={7} fill={CREAM} />
      <circle cx={26} cy={-50} r={7} fill="none" stroke={INK} strokeWidth={1} opacity={0.3} />
    </g>
  );
}
function LaptopCode({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -34 -30 L 34 -30 L 34 16 L -34 16 Z" fill={INK} />
      <rect x={-28} y={-24} width={56} height={34} rx={2} fill={DENIM} />
      <line x1={-20} y1={-16} x2={2} y2={-16} stroke={CREAM} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
      <line x1={-20} y1={-8} x2={14} y2={-8} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" opacity={0.9} />
      <line x1={-20} y1={0} x2={-2} y2={0} stroke={CREAM} strokeWidth={3} strokeLinecap="round" opacity={0.7} />
      <path d="M -40 16 L 40 16 L 46 28 Q 47 32 42 32 L -42 32 Q -47 32 -46 28 Z" fill={TERRACOTTA} />
    </g>
  );
}
function PottedPlant({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -22 20 L -16 60 Q -16 66 -10 66 L 10 66 Q 16 66 16 60 L 22 20 Z" fill={TERRACOTTA} />
      <ellipse cx={0} cy={20} rx={22} ry={6} fill={RUST} />
      <path d="M 0 18 Q -6 -14 -26 -30" fill="none" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <path d="M 0 18 Q 8 -18 30 -26" fill="none" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <path d="M 0 18 Q 0 -30 0 -46" fill="none" stroke={SAGE} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={-26} cy={-32} rx={13} ry={8} fill={SAGE} transform="rotate(-30 -26 -32)" />
      <ellipse cx={30} cy={-28} rx={13} ry={8} fill={OLIVE} transform="rotate(25 30 -28)" />
      <ellipse cx={0} cy={-48} rx={11} ry={8} fill={SAGE} />
    </g>
  );
}
function WateringCan({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -20 -6 L -18 24 Q -18 30 -12 30 L 16 30 Q 22 30 22 24 L 20 -6 Z" fill={DENIM} />
      <path d="M 18 -10 L 40 -22" stroke={DENIM} strokeWidth={6} strokeLinecap="round" />
      <circle cx={42} cy={-24} r={5} fill={DENIM} />
      <path d="M -10 -6 Q -10 -20 4 -20 Q 18 -20 16 -8" fill="none" stroke={DENIM} strokeWidth={4} />
    </g>
  );
}
function Easel({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M -30 60 L -6 -40 L 6 -40 L 30 60" fill="none" stroke={RUST} strokeWidth={6} strokeLinecap="round" />
      <line x1={-22} y1={26} x2={22} y2={26} stroke={RUST} strokeWidth={6} strokeLinecap="round" />
      <rect x={-30} y={-38} width={60} height={62} rx={2} fill={CREAM} />
      <path d="M -20 10 Q -6 -14 14 2" fill="none" stroke={TERRACOTTA} strokeWidth={4} strokeLinecap="round" />
      <circle cx={10} cy={-16} r={9} fill={MUSTARD} opacity={0.85} />
      <path d="M -14 20 Q 0 8 18 18" fill="none" stroke={OLIVE} strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}
function DiceAndBoard({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-38} y={-14} width={76} height={44} rx={4} fill={DENIM} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3, 4].map((c) => (
          <rect key={`${r}-${c}`} x={-34 + c * 14.4} y={-10 + r * 12.4} width={11} height={9} rx={1.5} fill={CREAM} opacity={0.35} />
        ))
      )}
      <g transform="translate(28 -30) rotate(18)">
        <rect x={-13} y={-13} width={26} height={26} rx={5} fill={TERRACOTTA} />
        <circle cx={-5} cy={-5} r={2.4} fill={CREAM} />
        <circle cx={5} cy={5} r={2.4} fill={CREAM} />
        <circle cx={0} cy={0} r={2.4} fill={CREAM} />
      </g>
      <g transform="translate(-24 -28) rotate(-14)">
        <rect x={-11} y={-11} width={22} height={22} rx={5} fill={MUSTARD} />
        <circle cx={-4} cy={-4} r={2.2} fill={INK} opacity={0.6} />
        <circle cx={4} cy={4} r={2.2} fill={INK} opacity={0.6} />
      </g>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Scenes: 5 per hobby, each Figure(s) + matching props, laid out over a
// shared warm background. viewBox is 0 0 200 200.
// ---------------------------------------------------------------------------
type SceneProps = { rand: () => number };
type Scene = (p: SceneProps) => JSX.Element;

function bg({ rand }: SceneProps) {
  const skin = skinFor(rand);
  const hair = hairFor(rand);
  return { skin, hair };
}

const craftingScenes: Scene[] = [
  // pottery
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={158} rx={52} ry={10} fill={PAPER_DARK} />
        <Figure x={70} y={110} skin={skin} hair={hair} outfit={TERRACOTTA} pose="kneel" scale={1.05} />
        <ellipse cx={128} cy={156} rx={22} ry={8} fill="#8B5A3C" />
        <path d="M 112 128 Q 128 116 144 128 Q 148 144 128 150 Q 108 144 112 128 Z" fill={RUST} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 60 }} />
      </>
    );
  },
  // embroidery
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={70} y={108} skin={skin} hair={hair} outfit={DENIM} pose="sit" />
        <EmbroideryHoop x={128} y={122} s={0.95} />
        <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 120, r: 55 }} />
      </>
    );
  },
  // crochet / yarn
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={62} y={112} skin={skin} hair={hair} outfit={OLIVE} pose="sit" />
        <YarnAndNeedles x={132} y={128} s={0.9} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
  // candle making
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={162} rx={54} ry={9} fill={PAPER_DARK} />
        <Figure x={64} y={106} skin={skin} hair={hair} outfit={BLUSH} pose="stand" />
        <Candle x={116} y={140} color={OLIVE} />
        <Candle x={148} y={148} color={TERRACOTTA} s={0.75} />
        <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 120, r: 55 }} />
      </>
    );
  },
  // watercolor
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={66} y={112} skin={skin} hair={hair} outfit={MUSTARD} pose="reach" />
        <PaintPalette x={130} y={128} s={0.85} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
];

const mysticismScenes: Scene[] = [
  // tarot
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={168} rx={56} ry={9} fill={PAPER_DARK} />
        <Figure x={64} y={112} skin={skin} hair={hair} outfit={DENIM} pose="kneel" />
        <TarotCards x={128} y={144} s={0.85} />
        <Sparkles rand={rand} count={3} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // crystals
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={66} y={108} skin={skin} hair={hair} outfit={OLIVE} pose="reach" />
        <CrystalCluster x={132} y={150} s={0.85} />
        <Sparkles rand={rand} count={3} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // moon water ritual
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={62} y={112} skin={skin} hair={hair} outfit={TERRACOTTA} pose="stand" />
        <MoonAndJar x={130} y={124} s={0.85} />
        <Sparkles rand={rand} count={3} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
  // journal / natal chart
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={64} y={110} skin={skin} hair={hair} outfit={BLUSH} pose="sit" />
        <JournalBook x={132} y={128} s={1.05} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
  // candle meditation
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <circle cx={100} cy={70} r={26} fill={MUSTARD_LIGHT} opacity={0.55} />
        <Figure x={100} y={128} skin={skin} hair={hair} outfit={DENIM} pose="kneel" scale={1.1} />
        <Candle x={148} y={150} color={RUST} s={0.85} />
        <Sparkles rand={rand} count={3} avoid={{ x: 100, y: 120, r: 50 }} />
      </>
    );
  },
];

const sportsScenes: Scene[] = [
  // pickleball paddle
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={170} rx={58} ry={9} fill={PAPER_DARK} />
        <Figure x={66} y={116} skin={skin} hair={hair} outfit={DENIM} pose="lean" />
        <PickleballPaddle x={128} y={150} s={0.72} rot={-18} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // padel racket
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={64} y={116} skin={skin} hair={hair} outfit={TERRACOTTA} pose="reach" />
        <PadelRacket x={132} y={150} s={0.6} rot={12} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // net / court setup
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={172} rx={58} ry={9} fill={PAPER_DARK} />
        <SportNet x={100} y={140} s={0.85} />
        <Figure x={158} y={128} skin={skin} hair={hair} outfit={OLIVE} pose="stand" scale={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
  // court shoes
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={68} y={112} skin={skin} hair={hair} outfit={MUSTARD} pose="kneel" />
        <Sneaker x={134} y={152} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // water bottle / recap
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={64} y={110} skin={skin} hair={hair} outfit={BLUSH} pose="stand" />
        <WaterBottle x={130} y={128} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
];

const recreationScenes: Scene[] = [
  // espresso machine
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={172} rx={58} ry={9} fill={PAPER_DARK} />
        <Figure x={62} y={126} skin={skin} hair={hair} outfit={OLIVE} pose="reach" scale={0.9} />
        <EspressoMachine x={132} y={126} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // latte art / syrups
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={64} y={112} skin={skin} hair={hair} outfit={TERRACOTTA} pose="sit" />
        <SyrupBottles x={130} y={144} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // coffee tray / corner
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={168} rx={58} ry={9} fill={PAPER_DARK} />
        <CoffeeTray x={100} y={132} s={1} />
        <Figure x={158} y={120} skin={skin} hair={hair} outfit={DENIM} pose="stand" scale={0.75} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // frother / microfoam
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={62} y={112} skin={skin} hair={hair} outfit={MUSTARD} pose="reach" />
        <MilkFrother x={130} y={132} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // cozy blanket / third place
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={166} rx={58} ry={9} fill={PAPER_DARK} />
        <Blanket x={100} y={140} s={1.15} />
        <Figure x={100} y={100} skin={skin} hair={hair} outfit={BLUSH} pose="sit" scale={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
];

const collectingScenes: Scene[] = [
  // display shelf
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Shelf x={100} y={100} s={1} />
        <Figure x={64} y={140} skin={skin} hair={hair} outfit={DENIM} pose="reach" scale={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 100, r: 55 }} />
      </>
    );
  },
  // trading card binder
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={62} y={116} skin={skin} hair={hair} outfit={OLIVE} pose="sit" />
        <CardBinder x={132} y={130} s={0.75} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // sashiko mending
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={62} y={116} skin={skin} hair={hair} outfit={TERRACOTTA} pose="sit" />
        <SashikoCloth x={132} y={128} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
  // display case / pins
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <DisplayCase x={100} y={110} s={0.95} />
        <Figure x={60} y={140} skin={skin} hair={hair} outfit={MUSTARD} pose="reach" scale={0.8} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 110, r: 55 }} />
      </>
    );
  },
  // tote / scraps
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <Figure x={64} y={112} skin={skin} hair={hair} outfit={BLUSH} pose="stand" />
        <ToteBag x={132} y={138} s={0.85} />
        <Sparkles rand={rand} count={1} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
];

// Hero scenes for the four brand-new categories — one distinctive scene each
// for now (used as the space's cover art); more variants can be added later
// once each space has real posts/products that need visual variety.
const makerLabScenes: Scene[] = [
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={168} rx={58} ry={9} fill={PAPER_DARK} />
        <Printer3D x={112} y={126} s={0.95} />
        <Figure x={54} y={128} skin={skin} hair={hair} outfit={DENIM} pose="lean" scale={0.9} />
        <Sparkles rand={rand} count={2} avoid={{ x: 110, y: 120, r: 55 }} />
      </>
    );
  },
];
const buildStackScenes: Scene[] = [
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={166} rx={58} ry={9} fill={PAPER_DARK} />
        <Figure x={70} y={112} skin={skin} hair={hair} outfit={OLIVE} pose="sit" />
        <LaptopCode x={128} y={132} s={0.85} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
];
const rootedScenes: Scene[] = [
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={172} rx={58} ry={9} fill={PAPER_DARK} />
        <Figure x={64} y={124} skin={skin} hair={hair} outfit={TERRACOTTA} pose="kneel" />
        <PottedPlant x={128} y={132} s={0.85} />
        <WateringCan x={158} y={156} s={0.55} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 130, r: 55 }} />
      </>
    );
  },
];
const theStudioScenes: Scene[] = [
  ({ rand }) => {
    const { skin, hair } = bg({ rand });
    return (
      <>
        <ellipse cx={100} cy={172} rx={58} ry={9} fill={PAPER_DARK} />
        <Easel x={126} y={118} s={0.85} />
        <Figure x={62} y={128} skin={skin} hair={hair} outfit={BLUSH} pose="reach" />
        <PaintPalette x={54} y={162} s={0.5} />
        <Sparkles rand={rand} count={2} avoid={{ x: 100, y: 120, r: 55 }} />
      </>
    );
  },
];

const ART_ALIAS: Record<string, string> = {
  "food-cooking": "kitchentable",
  "sports-fitness": "inmotion",
  "art-creative": "thestudio",
  "crafts-making": "workbench",
  "books-writing": "rabbithole",
  "nature-outdoors": "rooted",
  "home-garden": "rooted",
  "gaming-tabletop": "rabbithole",
  music: "thestudio",
  "photography-film": "thestudio",
  "health-wellness": "inmotion",
  "fashion-beauty": "thestudio",
  "tech-building": "makerlab",
  "collecting-fandom": "rabbithole",
  "travel-adventure": "rooted",
};

const HOBBY_SCENES: Record<string, Scene[]> = {
  // The four categories that map closely to earlier hobby spaces keep their
  // proven, five-scene-deep art (see the "what belongs inside" overlap:
  // pottery/embroidery/candle-making -> Workbench, pickleball/padel ->
  // In Motion, home coffee -> Kitchen Table, trading cards/mending -> Rabbit
  // Hole) — that's the "reuse the pattern" half of the brief. The four
  // brand-new categories below get one fresh hero scene each.
  workbench: craftingScenes,
  inmotion: sportsScenes,
  kitchentable: recreationScenes,
  rabbithole: collectingScenes,
  makerlab: makerLabScenes,
  buildstack: buildStackScenes,
  rooted: rootedScenes,
  thestudio: theStudioScenes,
};

// ---------------------------------------------------------------------------
// Explicit id -> variant mapping, so real products/posts show the scene that
// actually matches them, instead of a repeated/wrong one.
// ---------------------------------------------------------------------------
// Product ids, in file order (see data/products.ts):
// Workbench 1-7, In Motion 14-19, Kitchen Table 20-25, Rabbit Hole 26-31
// (ids 8-13 were the old Mysticism products, retired when the taxonomy
// moved to today's 8 categories — no replacement ids were issued.)
const PRODUCT_VARIANT: Record<number, number> = {
  1: 0, // Pottery Starter Kit -> pottery wheel
  2: 1, // Embroidery Hoop Set -> embroidery
  3: 0, // Air-Dry Clay Kit -> pottery wheel
  4: 2, // Crochet Starter Kit -> yarn/needles
  5: 3, // Candle-Making Kit -> candle
  6: 4, // Watercolor Sketchbook Set -> palette
  7: 0, // Hand-Building Pottery course -> pottery wheel
  14: 0, // Pickleball Paddle Set -> paddle
  15: 1, // Padel Racket -> racket
  16: 2, // Portable Sport Net -> net
  17: 3, // Court Shoes -> shoes
  18: 4, // Sport Water Bottle -> bottle
  19: 0, // Pickleball Fundamentals course -> paddle
  20: 0, // Mini Espresso Machine -> machine
  21: 1, // Latte Syrup Set -> syrups
  22: 2, // Coffee Station Tray -> tray
  23: 3, // Milk Frother -> frother
  24: 4, // Cozy Throw Blanket -> blanket
  25: 1, // Home Barista Masterclass -> syrups/latte art
  26: 0, // Trinket Display Shelf -> shelf
  27: 1, // Trading Card Binder -> binder
  28: 2, // Sashiko Mending Kit -> sashiko
  29: 3, // Keepsake Display Case -> display case
  30: 4, // Upcycled Tote Bag -> tote
  31: 2, // Visible Mending 101 guide -> sashiko
};

// Posts without a linked product get their own explicit mapping, chosen from
// their caption's actual subject. Posts with a productId inherit that
// product's variant automatically (see resolveVariant below).
const POST_VARIANT: Record<number, number> = {
  102: 1, // hoop embroidery
  103: 0, // clay dish
  104: 2, // granny square blanket -> crochet
  105: 3, // candles
  302: 1, // padel
  303: 2, // pickleball league / net
  304: 3, // court shoes
  305: 4, // recap / water bottle
  402: 1, // cardamom rose latte -> syrups
  403: 2, // coffee corner tray
  404: 4, // blanket, book, mug -> cozy blanket
  405: 3, // microfoam -> frother
  502: 1, // sleeving binder
  503: 2, // sashiko mending
  504: 3, // pin display case
  505: 4, // tote from scraps
};

function resolveVariant(hobbySlug: string, seed: string | number, sceneCount: number, fallbackRand: () => number): number {
  if (typeof seed === "number" || /^\d+$/.test(String(seed))) {
    const n = Number(seed);
    if (n in PRODUCT_VARIANT) return PRODUCT_VARIANT[n] % sceneCount;
    if (n in POST_VARIANT) return POST_VARIANT[n] % sceneCount;
  }
  // hero tiles are seeded with the hobby's own slug — always show that
  // hobby's most iconic/first scene so the space's cover art stays consistent.
  if (seed === hobbySlug) return 0;
  return Math.floor(fallbackRand() * sceneCount) % sceneCount;
}

export function GeneratedArt({
  hobbySlug,
  seed,
  className,
}: {
  hobbySlug: string;
  seed: string | number;
  className?: string;
}) {
  const scenes = HOBBY_SCENES[ART_ALIAS[hobbySlug] ?? hobbySlug] ?? collectingScenes;
  const rand = mulberry32(hashSeed(`${hobbySlug}:${seed}`));
  const variantIndex = resolveVariant(hobbySlug, seed, scenes.length, rand);
  const Scene = scenes[variantIndex];

  const rotate = Math.round(rand() * 6 - 3);
  const glowX = 20 + rand() * 55;
  const glowY = 10 + rand() * 40;

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ backgroundColor: PAPER }}>
      <div
        className="animate-float-slow absolute rounded-full blur-2xl"
        style={{
          left: `${glowX}%`,
          top: `${glowY}%`,
          width: "60%",
          height: "60%",
          background: `radial-gradient(circle, ${MUSTARD_LIGHT}55, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox="0 0 200 200"
          style={{ width: "88%", height: "88%", transform: `rotate(${rotate}deg)` }}
        >
          <g className="generated-art-float">
            <Scene rand={rand} />
          </g>
        </svg>
      </div>
    </div>
  );
}
