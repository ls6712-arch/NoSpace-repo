import type { SubArtDrawing } from "./palette";
import {
  INK,
  PAPER_DARK,
  TERRACOTTA,
  RUST,
  MUSTARD,
  MUSTARD_LIGHT,
  OLIVE,
  SAGE,
  DENIM,
  DENIM_LIGHT,
  BLUSH,
  CREAM,
} from "./palette";

/**
 * "The Studio" hobby tiles — making things: paint, film, sound, words, stage.
 * Every entry draws raw SVG children into the shared 200x200 viewBox, centred
 * on x=100 and resting on the ground line at y=150.
 */
export const thestudioArt: Record<string, SubArtDrawing> = {
  // Easel holding a canvas of bold acrylic strokes, with a loaded brush.
  painting: () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 74 150 L 88 110"
        fill="none"
        stroke={RUST}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 126 150 L 112 110"
        fill="none"
        stroke={RUST}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 82 134 L 118 134"
        fill="none"
        stroke={RUST}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <rect x={56} y={46} width={88} height={64} rx={3} fill={CREAM} />
      <path
        d="M 68 96 Q 80 60 94 90"
        fill="none"
        stroke={DENIM}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M 100 96 Q 114 64 130 84"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M 70 102 L 128 102"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x={50} y={108} width={100} height={8} rx={3} fill={RUST} />
      <path
        d="M 130 146 L 154 122"
        fill="none"
        stroke={OLIVE}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 154 122 L 164 112"
        fill="none"
        stroke={BLUSH}
        strokeWidth={9}
        strokeLinecap="round"
      />
    </>
  ),

  // Spiral sketchpad, a soft contour line and a graphite pencil lying across it.
  drawing: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />
      <rect x={46} y={50} width={108} height={98} rx={5} fill={PAPER_DARK} />
      <rect x={54} y={58} width={92} height={84} rx={3} fill={CREAM} />
      <circle cx={66} cy={50} r={5} fill={INK} opacity={0.55} />
      <circle cx={84} cy={50} r={5} fill={INK} opacity={0.55} />
      <circle cx={102} cy={50} r={5} fill={INK} opacity={0.55} />
      <circle cx={120} cy={50} r={5} fill={INK} opacity={0.55} />
      <circle cx={138} cy={50} r={5} fill={INK} opacity={0.55} />
      <path
        d="M 78 128 Q 68 100 84 82 Q 100 66 116 80 Q 128 92 118 106 Q 110 118 118 128"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.75}
      />
      <path
        d="M 86 96 Q 96 90 106 96"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d="M 62 140 L 122 116"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 122 116 L 134 112"
        fill="none"
        stroke={PAPER_DARK}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path d="M 58 142 L 52 148 L 54 138 Z" fill={INK} />
    </>
  ),

  // Pan palette, water jar and a soft wet bleed — deliberately looser than painting.
  watercolor: () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <rect x={38} y={48} width={88} height={66} rx={2} fill={CREAM} />
      <ellipse cx={64} cy={72} rx={18} ry={13} fill={BLUSH} />
      <ellipse cx={88} cy={82} rx={20} ry={14} fill={MUSTARD_LIGHT} />
      <ellipse cx={104} cy={68} rx={15} ry={11} fill={DENIM_LIGHT} />
      <ellipse cx={76} cy={96} rx={16} ry={10} fill={SAGE} />
      <rect x={132} y={98} width={36} height={50} rx={7} fill={DENIM_LIGHT} />
      <path d="M 134 118 L 166 118 L 166 141 Q 166 148 158 148 L 142 148 Q 134 148 134 141 Z" fill={DENIM} />
      <path
        d="M 150 96 L 156 58"
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <rect x={36} y={122} width={84} height={26} rx={6} fill={CREAM} />
      <rect x={42} y={128} width={16} height={14} rx={3} fill={BLUSH} />
      <rect x={62} y={128} width={16} height={14} rx={3} fill={MUSTARD_LIGHT} />
      <rect x={82} y={128} width={16} height={14} rx={3} fill={SAGE} />
      <rect x={102} y={128} width={14} height={14} rx={3} fill={DENIM_LIGHT} />
    </>
  ),

  // Camera body seen front-on, with a big lens.
  photography: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={68} y={56} width={44} height={18} rx={5} fill={DENIM} />
      <rect x={38} y={70} width={124} height={76} rx={12} fill={DENIM} />
      <rect x={38} y={70} width={124} height={16} rx={8} fill={DENIM_LIGHT} />
      <circle cx={140} cy={62} r={8} fill={MUSTARD} />
      <circle cx={100} cy={110} r={34} fill={DENIM_LIGHT} />
      <circle cx={100} cy={110} r={26} fill={INK} />
      <circle cx={100} cy={110} r={15} fill={DENIM} />
      <circle cx={93} cy={103} r={5} fill={CREAM} />
      <rect x={44} y={94} width={16} height={16} rx={4} fill={CREAM} />
    </>
  ),

  // Movie camera on a tripod, with a clapperboard on the ground.
  filmmaking: () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 100 118 L 74 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 100 118 L 126 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 100 118 L 104 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={82} cy={62} r={14} fill={DENIM_LIGHT} />
      <circle cx={82} cy={62} r={5} fill={INK} />
      <circle cx={112} cy={62} r={14} fill={DENIM_LIGHT} />
      <circle cx={112} cy={62} r={5} fill={INK} />
      <rect x={64} y={74} width={64} height={44} rx={6} fill={DENIM} />
      <rect x={128} y={86} width={20} height={18} rx={4} fill={DENIM_LIGHT} />
      <circle cx={150} cy={95} r={8} fill={INK} />
      <rect x={30} y={126} width={44} height={22} rx={3} fill={INK} />
      <rect x={30} y={116} width={44} height={10} rx={3} fill={CREAM} />
      <path
        d="M 38 126 L 44 116"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 56 126 L 62 116"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),

  // MIDI controller with faders and knobs, under a waveform.
  "music-production": () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 40 78 L 40 90"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 56 66 L 56 102"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 72 52 L 72 116"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 88 70 L 88 98"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 104 58 L 104 110"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 120 72 L 120 96"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 136 62 L 136 106"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 152 78 L 152 90"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x={32} y={118} width={136} height={30} rx={7} fill={DENIM} />
      <rect x={32} y={118} width={136} height={8} rx={4} fill={DENIM_LIGHT} />
      <rect x={42} y={130} width={8} height={14} rx={4} fill={CREAM} />
      <rect x={58} y={130} width={8} height={14} rx={4} fill={CREAM} />
      <rect x={74} y={130} width={8} height={14} rx={4} fill={CREAM} />
      <rect x={90} y={130} width={8} height={14} rx={4} fill={CREAM} />
      <rect x={40} y={132} width={12} height={5} rx={2} fill={MUSTARD} />
      <rect x={56} y={138} width={12} height={5} rx={2} fill={MUSTARD} />
      <rect x={72} y={134} width={12} height={5} rx={2} fill={MUSTARD} />
      <rect x={88} y={140} width={12} height={5} rx={2} fill={MUSTARD} />
      <circle cx={118} cy={136} r={8} fill={MUSTARD_LIGHT} />
      <circle cx={140} cy={136} r={8} fill={MUSTARD_LIGHT} />
      <circle cx={158} cy={136} r={6} fill={CREAM} />
    </>
  ),

  // Acoustic guitar leaning beside a music stand.
  instrument: () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 152 150 L 152 100"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 140 150 L 164 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path d="M 128 78 L 172 86 L 170 106 L 126 98 Z" fill={CREAM} />
      <path
        d="M 134 88 L 162 93"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <circle cx={78} cy={118} r={30} fill={MUSTARD} />
      <circle cx={82} cy={86} r={22} fill={MUSTARD} />
      <circle cx={80} cy={110} r={10} fill={INK} />
      <rect x={64} y={128} width={30} height={7} rx={3} fill={RUST} />
      <path
        d="M 90 72 L 116 46"
        fill="none"
        stroke={RUST}
        strokeWidth={11}
        strokeLinecap="round"
      />
      <path
        d="M 116 48 L 124 42"
        fill="none"
        stroke={INK}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 86 74 L 110 50"
        fill="none"
        stroke={CREAM}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </>
  ),

  // Microphone on a stand with sound arcs.
  singing: () => (
    <>
      <ellipse cx={100} cy={150} rx={34} ry={7} fill={INK} opacity={0.13} />
      <ellipse cx={100} cy={145} rx={26} ry={8} fill={INK} />
      <path
        d="M 100 145 L 100 92"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x={90} y={82} width={20} height={30} rx={7} fill={INK} />
      <circle cx={100} cy={70} r={19} fill={DENIM} />
      <circle cx={100} cy={70} r={11} fill={DENIM_LIGHT} />
      <rect x={88} y={86} width={24} height={7} rx={3} fill={MUSTARD} />
      <path
        d="M 132 54 Q 146 70 132 86"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 148 46 Q 168 70 148 94"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 68 54 Q 54 70 68 86"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 52 46 Q 32 70 52 94"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),

  // Typewriter with a sheet curling out of the roller.
  writing: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <path d="M 76 98 L 76 58 Q 100 46 124 58 L 124 98 Z" fill={CREAM} />
      <path
        d="M 86 68 L 114 68"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d="M 84 78 L 116 78"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <path
        d="M 84 88 L 106 88"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.4}
      />
      <rect x={64} y={94} width={72} height={16} rx={8} fill={INK} />
      <circle cx={60} cy={102} r={9} fill={MUSTARD} />
      <circle cx={140} cy={102} r={9} fill={MUSTARD} />
      <rect x={46} y={108} width={108} height={28} rx={6} fill={TERRACOTTA} />
      <rect x={38} y={132} width={124} height={16} rx={5} fill={RUST} />
      <circle cx={62} cy={122} r={5} fill={CREAM} />
      <circle cx={78} cy={122} r={5} fill={CREAM} />
      <circle cx={94} cy={122} r={5} fill={CREAM} />
      <circle cx={110} cy={122} r={5} fill={CREAM} />
      <circle cx={126} cy={122} r={5} fill={CREAM} />
      <circle cx={142} cy={122} r={5} fill={CREAM} />
      <rect x={64} y={138} width={72} height={6} rx={3} fill={CREAM} />
    </>
  ),

  // A single tilted sheet of short ragged lines with a fountain pen.
  poetry: () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />
      <path d="M 60 58 L 134 46 L 148 140 L 74 150 Z" fill={CREAM} />
      <path
        d="M 72 74 L 118 67"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d="M 74 88 L 106 83"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d="M 76 102 L 124 95"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d="M 78 116 L 100 113"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d="M 80 130 L 116 125"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
        opacity={0.6}
      />
      <path
        d="M 164 60 L 132 116"
        fill="none"
        stroke={DENIM}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path d="M 134 112 L 144 118 L 126 132 Z" fill={MUSTARD} />
      <circle cx={131} cy={126} r={3} fill={INK} />
    </>
  ),

  // Closed cloth-bound journal with an elastic band and ribbon marker.
  journaling: () => (
    <>
      <ellipse cx={100} cy={150} rx={48} ry={7} fill={INK} opacity={0.13} />
      <rect x={50} y={54} width={100} height={90} rx={7} fill={OLIVE} />
      <rect x={50} y={54} width={16} height={90} rx={7} fill={SAGE} />
      <rect x={142} y={60} width={10} height={78} rx={3} fill={CREAM} />
      <rect x={144} y={64} width={6} height={70} rx={2} fill={PAPER_DARK} />
      <path
        d="M 124 54 L 124 144"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={100} cy={94} r={16} fill={SAGE} />
      <circle cx={100} cy={94} r={8} fill={CREAM} />
      <path d="M 106 144 L 122 144 L 122 150 L 114 145 L 106 150 Z" fill={BLUSH} />
    </>
  ),

  // Nib pen, ink pot and a flourished stroke on a card.
  calligraphy: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={76} y={96} width={90} height={52} rx={4} fill={CREAM} />
      <path
        d="M 86 134 Q 106 100 122 126 Q 134 146 156 112"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <rect x={30} y={104} width={46} height={44} rx={8} fill={DENIM} />
      <path d="M 32 122 L 74 122 L 74 141 Q 74 148 66 148 L 40 148 Q 32 148 32 141 Z" fill={INK} />
      <rect x={42} y={92} width={22} height={14} rx={4} fill={DENIM_LIGHT} />
      <path
        d="M 148 50 L 106 118"
        fill="none"
        stroke={RUST}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 148 50 L 140 63"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path d="M 100 112 L 112 120 L 98 132 Z" fill={INK} />
    </>
  ),

  // Small stage with curtains and a spotlight beam.
  theater: () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />
      <rect x={42} y={54} width={116} height={80} fill={PAPER_DARK} />
      <path d="M 100 58 L 72 134 L 128 134 Z" fill={MUSTARD_LIGHT} />
      <path d="M 42 50 L 42 134 Q 62 122 68 50 Z" fill={TERRACOTTA} />
      <path d="M 158 50 L 158 134 Q 138 122 132 50 Z" fill={TERRACOTTA} />
      <path
        d="M 52 58 L 52 126"
        fill="none"
        stroke={RUST}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 148 58 L 148 126"
        fill="none"
        stroke={RUST}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect x={36} y={44} width={128} height={16} rx={6} fill={RUST} />
      <ellipse cx={100} cy={130} rx={26} ry={7} fill={MUSTARD} />
      <rect x={34} y={132} width={132} height={16} rx={4} fill={RUST} />
      <rect x={34} y={132} width={132} height={5} rx={2} fill={TERRACOTTA} />
    </>
  ),
};
