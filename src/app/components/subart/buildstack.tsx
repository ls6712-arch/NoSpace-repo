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
 * Build & Stack — small flat-vector hobby illustrations.
 * Each entry returns raw SVG children for a 200x200 viewBox: the subject is
 * centred on x=100 and rests on a ground line at y=150.
 */
export const buildstackArt: Record<string, SubArtDrawing> = {
  // Terminal window: prompt caret, code lines, blinking block cursor.
  coding: () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <rect x={32} y={50} width={136} height={96} rx={8} fill={INK} />
      <rect x={39} y={70} width={122} height={69} rx={3} fill={DENIM} />
      <circle cx={46} cy={60} r={4} fill={TERRACOTTA} />
      <circle cx={59} cy={60} r={4} fill={MUSTARD} />
      <circle cx={72} cy={60} r={4} fill={SAGE} />
      <path
        d="M 50 84 L 59 90 L 50 96"
        fill="none"
        stroke={MUSTARD_LIGHT}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={68} y1={90} x2={106} y2={90} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <line x1={50} y1={106} x2={88} y2={106} stroke={SAGE} strokeWidth={4} strokeLinecap="round" />
      <line x1={97} y1={106} x2={132} y2={106} stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <line x1={50} y1={122} x2={80} y2={122} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <rect x={88} y={115} width={11} height={14} rx={2} fill={MUSTARD} />
    </>
  ),

  // Canvas of snap-together blocks, one being dragged in by a cursor.
  "no-code-building": () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <rect x={28} y={48} width={144} height={98} rx={9} fill={CREAM} stroke={INK} strokeWidth={4} />
      <rect x={44} y={62} width={46} height={22} rx={7} fill={TERRACOTTA} />
      <rect x={112} y={62} width={44} height={22} rx={7} fill={DENIM} />
      <rect x={44} y={100} width={46} height={22} rx={7} fill={OLIVE} />
      <path
        d="M 90 73 L 112 73"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 67 84 L 67 100"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={67} cy={100} r={4} fill={INK} />
      <g transform="rotate(-9 133 111)">
        <rect x={110} y={100} width={46} height={22} rx={7} fill={MUSTARD} />
        <line x1={118} y1={111} x2={140} y2={111} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      </g>
      <path
        d="M 128 122 L 128 142 L 133 137 L 137 145 L 141 143 L 137 135 L 143 134 Z"
        fill={INK}
      />
    </>
  ),

  // Generative spiral of particles blooming out of a little screen.
  "creative-coding": () => (
    <>
      <ellipse cx={100} cy={150} rx={38} ry={7} fill={INK} opacity={0.13} />
      <rect x={70} y={116} width={60} height={34} rx={5} fill={INK} />
      <rect x={76} y={122} width={48} height={22} rx={2} fill={DENIM} />
      <path
        d="M 100 118 C 88 116 84 105 92 99 C 101 92 113 98 113 108 C 113 121 99 129 86 124 C 68 117 63 92 76 76 C 88 61 116 58 131 74"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <circle cx={131} cy={74} r={6} fill={MUSTARD} />
      <circle cx={64} cy={64} r={5} fill={SAGE} />
      <circle cx={140} cy={100} r={4} fill={BLUSH} />
      <circle cx={54} cy={96} r={4} fill={RUST} />
      <circle cx={104} cy={50} r={5} fill={MUSTARD_LIGHT} />
      <circle cx={150} cy={58} r={4} fill={OLIVE} />
      <circle cx={40} cy={120} r={4} fill={DENIM_LIGHT} />
    </>
  ),

  // Browser window with a header band and a three-column layout.
  "web-design": () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <rect x={28} y={48} width={144} height={98} rx={8} fill={INK} />
      <rect x={33} y={53} width={134} height={88} rx={4} fill={CREAM} />
      <rect x={33} y={53} width={134} height={17} fill={PAPER_DARK} />
      <circle cx={43} cy={61} r={3} fill={INK} opacity={0.45} />
      <circle cx={53} cy={61} r={3} fill={INK} opacity={0.45} />
      <circle cx={63} cy={61} r={3} fill={INK} opacity={0.45} />
      <rect x={41} y={77} width={118} height={21} rx={4} fill={DENIM} />
      <line x1={49} y1={87} x2={82} y2={87} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <rect x={41} y={104} width={34} height={30} rx={4} fill={TERRACOTTA} />
      <rect x={83} y={104} width={34} height={30} rx={4} fill={MUSTARD} />
      <rect x={125} y={104} width={34} height={30} rx={4} fill={SAGE} />
    </>
  ),

  // Game controller in front of a tilemap.
  "game-development": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={40} y={46} width={120} height={50} rx={4} fill={PAPER_DARK} />
      <rect x={40} y={46} width={24} height={25} fill={SAGE} />
      <rect x={88} y={46} width={24} height={25} fill={OLIVE} />
      <rect x={136} y={46} width={24} height={25} fill={SAGE} />
      <rect x={64} y={71} width={24} height={25} fill={OLIVE} />
      <rect x={112} y={71} width={24} height={25} fill={SAGE} />
      <line x1={64} y1={46} x2={64} y2={96} stroke={INK} strokeWidth={2} opacity={0.25} />
      <line x1={88} y1={46} x2={88} y2={96} stroke={INK} strokeWidth={2} opacity={0.25} />
      <line x1={112} y1={46} x2={112} y2={96} stroke={INK} strokeWidth={2} opacity={0.25} />
      <line x1={136} y1={46} x2={136} y2={96} stroke={INK} strokeWidth={2} opacity={0.25} />
      <line x1={40} y1={71} x2={160} y2={71} stroke={INK} strokeWidth={2} opacity={0.25} />
      <path
        d="M 62 104 L 138 104 Q 156 104 160 122 Q 164 140 152 145 Q 142 148 134 136 L 66 136 Q 58 148 48 145 Q 36 140 40 122 Q 44 104 62 104 Z"
        fill={TERRACOTTA}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M 62 112 L 70 112 L 70 118 L 76 118 L 76 126 L 70 126 L 70 132 L 62 132 L 62 126 L 56 126 L 56 118 L 62 118 Z" fill={INK} />
      <circle cx={135} cy={114} r={6} fill={MUSTARD} />
      <circle cx={147} cy={126} r={6} fill={CREAM} />
      <circle cx={123} cy={126} r={6} fill={DENIM_LIGHT} />
    </>
  ),

  // Branching node pipeline with a spark.
  "ai-workflows": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 58 108 Q 78 108 86 88"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 58 116 Q 78 118 86 132"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 114 84 Q 132 88 142 104"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 114 132 Q 132 130 142 118"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={44} cy={112} r={16} fill={DENIM} stroke={INK} strokeWidth={4} />
      <circle cx={100} cy={78} r={15} fill={MUSTARD} stroke={INK} strokeWidth={4} />
      <circle cx={100} cy={134} r={15} fill={SAGE} stroke={INK} strokeWidth={4} />
      <circle cx={156} cy={112} r={16} fill={TERRACOTTA} stroke={INK} strokeWidth={4} />
      <circle cx={100} cy={78} r={5} fill={CREAM} />
      <circle cx={100} cy={134} r={5} fill={CREAM} />
      <path
        d="M 66 60 L 71 74 L 85 79 L 71 84 L 66 98 L 61 84 L 47 79 L 61 74 Z"
        fill={MUSTARD_LIGHT}
      />
    </>
  ),

  // One parametric shape morphing across three steps, with parameter knobs.
  "generative-design": () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <line x1={38} y1={62} x2={162} y2={62} stroke={INK} strokeWidth={3} opacity={0.3} />
      <circle cx={54} cy={62} r={7} fill={MUSTARD} />
      <circle cx={100} cy={62} r={7} fill={OLIVE} />
      <circle cx={146} cy={62} r={7} fill={RUST} />
      <rect x={32} y={98} width={44} height={44} rx={2} fill={DENIM_LIGHT} stroke={INK} strokeWidth={3} />
      <rect
        x={80}
        y={94}
        width={40}
        height={40}
        rx={12}
        fill={MUSTARD}
        stroke={INK}
        strokeWidth={3}
        transform="rotate(16 100 114)"
      />
      <circle cx={148} cy={114} r={22} fill={TERRACOTTA} stroke={INK} strokeWidth={3} />
      <circle cx={148} cy={114} r={7} fill={CREAM} />
      <path
        d="M 82 122 L 88 116 L 82 110"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 128 122 L 134 116 L 128 110"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // Bar chart on axes with a trend curve.
  "data-visualization": () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={56} y={104} width={19} height={38} rx={2} fill={TERRACOTTA} />
      <rect x={81} y={86} width={19} height={56} rx={2} fill={MUSTARD} />
      <rect x={106} y={112} width={19} height={30} rx={2} fill={DENIM} />
      <rect x={131} y={72} width={19} height={70} rx={2} fill={OLIVE} />
      <path
        d="M 44 52 L 44 142 L 158 142"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 65 120 C 84 100 96 108 113 94 C 128 82 138 72 150 60"
        fill="none"
        stroke={RUST}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={65} cy={120} r={5} fill={CREAM} stroke={RUST} strokeWidth={3} />
      <circle cx={113} cy={94} r={5} fill={CREAM} stroke={RUST} strokeWidth={3} />
      <circle cx={150} cy={60} r={5} fill={CREAM} stroke={RUST} strokeWidth={3} />
    </>
  ),

  // VR headset projecting a floating cube.
  "ar-vr-projects": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 54 98 Q 34 106 36 124 Q 38 140 50 144"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <line x1={72} y1={104} x2={84} y2={88} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={128} y1={104} x2={116} y2={88} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <path d="M 100 44 L 120 55 L 100 66 L 80 55 Z" fill={MUSTARD_LIGHT} />
      <path d="M 80 55 L 100 66 L 100 88 L 80 77 Z" fill={MUSTARD} />
      <path d="M 120 55 L 120 77 L 100 88 L 100 66 Z" fill={RUST} />
      <rect x={44} y={94} width={112} height={52} rx={18} fill={DENIM} stroke={INK} strokeWidth={4} />
      <rect x={54} y={104} width={92} height={30} rx={13} fill={INK} />
      <rect x={62} y={110} width={24} height={9} rx={4} fill={DENIM_LIGHT} />
      <path
        d="M 90 146 Q 100 136 110 146"
        fill={PAPER_DARK}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </>
  ),

  // House with a connected smart bulb sending signal arcs.
  "smart-home-projects": () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 100 48 L 160 98 L 40 98 Z"
        fill={TERRACOTTA}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <rect x={54} y={96} width={92} height={50} fill={CREAM} stroke={INK} strokeWidth={4} />
      <rect x={86} y={116} width={28} height={30} rx={4} fill={OLIVE} />
      <circle cx={108} cy={132} r={3} fill={INK} />
      <rect x={62} y={106} width={18} height={18} rx={2} fill={DENIM_LIGHT} stroke={INK} strokeWidth={3} />
      <circle cx={128} cy={114} r={10} fill={MUSTARD} stroke={INK} strokeWidth={3} />
      <line x1={128} y1={124} x2={128} y2={130} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path
        d="M 140 104 Q 148 114 140 124"
        fill="none"
        stroke={DENIM}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 150 96 Q 162 114 150 132"
        fill="none"
        stroke={DENIM}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),

  // Padlock on a shield, with a key beside it.
  "cybersecurity-learning": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 100 46 L 148 62 L 148 100 Q 148 130 100 148 Q 52 130 52 100 L 52 62 Z"
        fill={DENIM}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M 100 52 L 142 66 L 142 100 Q 142 126 100 142"
        fill={DENIM_LIGHT}
        stroke="none"
      />
      <path
        d="M 88 98 L 88 88 Q 88 77 100 77 Q 112 77 112 88 L 112 98"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x={79} y={97} width={42} height={33} rx={7} fill={MUSTARD} stroke={INK} strokeWidth={3} />
      <circle cx={100} cy={109} r={4} fill={INK} />
      <path d="M 100 110 L 100 120" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <line x1={140} y1={138} x2={158} y2={138} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
      <line x1={145} y1={138} x2={145} y2={146} stroke={RUST} strokeWidth={4} strokeLinecap="round" />
      <line x1={152} y1={138} x2={152} y2={144} stroke={RUST} strokeWidth={4} strokeLinecap="round" />
      <circle cx={166} cy={138} r={8} fill={RUST} stroke={INK} strokeWidth={3} />
      <circle cx={166} cy={138} r={3} fill={CREAM} />
    </>
  ),
};
