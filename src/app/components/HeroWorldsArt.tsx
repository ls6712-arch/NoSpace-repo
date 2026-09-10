import { hashSeed, mulberry32, skinFor, hairFor, SAGE, OLIVE } from "./GeneratedArt";
import { WORLD_SCENES } from "./WorldIllustration";
import type { WorldSpace } from "../data/worldSpaces";

/**
 * The hero's single large illustration: six of the Worlds scenes composited
 * onto one wide canvas as small floating islands linked by glowing trails —
 * built to evoke a reference the team shared (isometric floating islands,
 * warm light, connecting light trails), translated into this app's own flat-
 * vector illustration language rather than reproduced as a photorealistic
 * render, since nothing in this project can generate one of those. Every
 * figure/prop here is the exact same scene-drawing code the Worlds section
 * cards use (WORLD_SCENES, exported from WorldIllustration.tsx) — this file
 * only adds the islands, the connecting trails, and the composition.
 */

const ISLAND_TONES = {
  wood: { top: "#8A6A49", mid: "#6B4E35", dark: "#4A3728" },
  stone: { top: "#9C9C93", mid: "#7C7C72", dark: "#5A5A52" },
  grass: { top: "#93B25E", mid: "#719046", dark: "#4F6B30" },
} as const;

function Island({
  cx,
  cy,
  rx,
  ry,
  tone,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tone: keyof typeof ISLAND_TONES;
}) {
  const c = ISLAND_TONES[tone];
  return (
    <g>
      <ellipse cx={cx} cy={cy + ry * 0.62} rx={rx * 0.93} ry={ry * 0.6} fill={c.dark} />
      <ellipse cx={cx} cy={cy + ry * 0.16} rx={rx} ry={ry * 0.86} fill={c.mid} />
      <ellipse cx={cx} cy={cy - ry * 0.18} rx={rx * 0.95} ry={ry * 0.72} fill={c.top} />
    </g>
  );
}

/** A small rounded cartoon tree, same "flat, warm, a little playful" spirit
 * as everything in GeneratedArt.tsx, built fresh since no Tree prop exists
 * there yet. */
function Tree({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x={-5} y={0} width={10} height={26} rx={3} fill="#6B4E35" />
      <circle cx={-14} cy={-14} r={20} fill={OLIVE} />
      <circle cx={14} cy={-16} r={22} fill={OLIVE} />
      <circle cx={0} cy={-30} r={24} fill={SAGE} />
    </g>
  );
}

function Cloud({ x, y, s = 1, opacity = 0.5 }: { x: number; y: number; s?: number; opacity?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={opacity}>
      <ellipse cx={0} cy={0} rx={42} ry={18} fill="#FFFFFF" />
      <ellipse cx={-28} cy={6} rx={26} ry={14} fill="#FFFFFF" />
      <ellipse cx={30} cy={6} rx={30} ry={15} fill="#FFFFFF" />
    </g>
  );
}

interface IslandSpec {
  illustration: WorldSpace["illustration"];
  cx: number;
  groundY: number;
  scale: number;
  tone: keyof typeof ISLAND_TONES;
  islandRx: number;
  islandRy: number;
}

const ISLANDS: IslandSpec[] = [
  { illustration: "music", cx: 250, groundY: 280, scale: 1.3, tone: "wood", islandRx: 200, islandRy: 78 },
  { illustration: "painting", cx: 800, groundY: 235, scale: 1.55, tone: "wood", islandRx: 240, islandRy: 90 },
  { illustration: "sculpture", cx: 1350, groundY: 290, scale: 1.25, tone: "stone", islandRx: 190, islandRy: 76 },
  { illustration: "gardening", cx: 220, groundY: 690, scale: 1.35, tone: "grass", islandRx: 220, islandRy: 84 },
  { illustration: "reading", cx: 800, groundY: 640, scale: 0.92, tone: "grass", islandRx: 130, islandRy: 52 },
  { illustration: "coding", cx: 1350, groundY: 670, scale: 1.3, tone: "wood", islandRx: 220, islandRy: 84 },
];

// Trails drawn as smooth curves between island ground-points, echoing the
// reference's glowing connections — always behind the islands, never framed
// as a network graph (no nodes, no arrows, just a sense of travel).
const TRAILS = [
  "M 250 280 C 420 380, 560 400, 800 400 C 700 500, 720 570, 800 640",
  "M 800 235 C 950 320, 1120 320, 1350 290",
  "M 800 400 C 950 470, 1150 500, 1350 670",
  "M 220 690 C 400 660, 560 650, 800 640",
];

function WorldOnIsland({ spec, seedKey }: { spec: IslandSpec; seedKey: string }) {
  const rand = mulberry32(hashSeed(`hero-world:${seedKey}`));
  const skin = skinFor(rand);
  const hair = hairFor(rand);
  const scene = WORLD_SCENES[spec.illustration];
  return (
    <>
      <Island cx={spec.cx} cy={spec.groundY} rx={spec.islandRx} ry={spec.islandRy} tone={spec.tone} />
      <g transform={`translate(${spec.cx} ${spec.groundY - spec.islandRy * 0.55}) scale(${spec.scale})`}>
        <g transform="translate(-100 -172)">
          {/* The idle-breathe class sets transform-box: fill-box, which — on
              Chromium at least — double-applies when it's the same <g> that
              also carries an SVG "transform" attribute (measured empirically:
              the whole scene rendered offset by exactly scale*(100,172), i.e.
              the recenter translate above got applied twice). Keeping the
              animated class on its own, attribute-free wrapper avoids that. */}
          <g className="ns-breathe" style={{ animationDelay: `-${spec.cx % 5}s` }}>
            {scene(rand, skin, hair)}
          </g>
        </g>
      </g>
    </>
  );
}

export function HeroWorldsArt({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #FBEBD9 0%, #F7DFCF 32%, #ECD7DE 62%, #D8DCEC 100%)",
        }}
      />
      <svg viewBox="0 0 1600 900" className="relative h-full w-full" role="img" aria-label="Small illustrated scenes of people playing music, painting, sculpting, gardening, reading, and coding, connected by soft glowing paths.">
        <defs>
          <linearGradient id="ns-hero-trail-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF9D6C" />
            <stop offset="100%" stopColor="#F5C542" />
          </linearGradient>
        </defs>

        <Cloud x={140} y={90} s={1.1} opacity={0.55} />
        <Cloud x={1420} y={130} s={1.3} opacity={0.5} />
        <Cloud x={760} y={70} s={0.9} opacity={0.4} />

        {TRAILS.map((d, i) => (
          <g key={i} className="ns-hero-trail">
            <path d={d} fill="none" stroke="url(#ns-hero-trail-grad)" strokeWidth={14} strokeLinecap="round" opacity={0.22} style={{ filter: "blur(5px)" }} />
            <path
              d={d}
              fill="none"
              stroke="url(#ns-hero-trail-grad)"
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeDasharray="1 16"
              opacity={0.9}
              className="ns-hero-trail-flow"
              style={{ animationDelay: `${-i * 3}s` }}
            />
          </g>
        ))}

        <Tree x={70} y={330} s={0.8} />
        <Tree x={70} y={760} s={1.05} />
        <Tree x={1540} y={340} s={0.9} />
        <Tree x={1080} y={230} s={0.55} />

        {ISLANDS.map((spec) => (
          <WorldOnIsland key={spec.illustration} spec={spec} seedKey={spec.illustration} />
        ))}
      </svg>
    </div>
  );
}
