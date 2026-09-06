import {
  BLUSH,
  Cat,
  Easel,
  Figure,
  MUSTARD_LIGHT,
  PAPER,
  PAPER_DARK,
  PaintPalette,
  PottedPlant,
  Sparkles,
  hairFor,
  hashSeed,
  mulberry32,
  skinFor,
} from "./GeneratedArt";

/**
 * A bespoke, one-off illustration for Discover's hero — not a generic hobby
 * scene picked from the shared rotation. It reuses the same flat-vector
 * primitives and warm palette as the rest of the app (so it still reads as
 * "NoSpace," not a foreign asset), just composed once, deliberately, at a
 * larger and more detailed scale: someone painting at an easel, a cat
 * keeping her company, a plant nearby — the "someone making something"
 * feeling the front door is supposed to give at a glance.
 */
export function DiscoverHeroArt({ className }: { className?: string }) {
  const rand = mulberry32(hashSeed("discover-hero-illustration"));
  const skin = skinFor(rand);
  const hair = hairFor(rand);

  return (
    <div className={`relative overflow-hidden ${className ?? ""}`} style={{ backgroundColor: PAPER }}>
      <div
        className="animate-float-slow absolute rounded-full blur-2xl"
        style={{
          left: "24%",
          top: "14%",
          width: "62%",
          height: "62%",
          background: `radial-gradient(circle, ${MUSTARD_LIGHT}55, transparent 70%)`,
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 240 240" style={{ width: "90%", height: "90%" }}>
          <g className="generated-art-float">
            {/* ground shadow */}
            <ellipse cx={122} cy={210} rx={86} ry={10} fill={PAPER_DARK} />

            {/* potted plant, off to the left, clear of everything else */}
            <PottedPlant x={30} y={168} s={0.85} />

            {/* the easel and the finished-in-progress canvas on it */}
            <Easel x={158} y={146} s={1} />

            {/* the painter, mid-stroke, between the plant and the easel */}
            <Figure x={98} y={156} skin={skin} hair={hair} outfit={BLUSH} pose="reach" scale={1} />
            <PaintPalette x={86} y={198} s={0.58} />

            {/* the cat, sitting off to the right, facing the easel, well clear
                of the plant so the two don't read as one shape */}
            <Cat x={200} y={214} s={0.82} flip />

            <Sparkles rand={rand} count={4} avoid={{ x: 120, y: 150, r: 62 }} />
          </g>
        </svg>
      </div>
    </div>
  );
}
