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
 * In Motion — small flat-vector hobby illustrations.
 * Each entry returns raw SVG children for a 200x200 viewBox: the subject is
 * centred on x=100 and rests on a ground line at y=150.
 */
export const inmotionArt: Record<string, SubArtDrawing> = {
  // Running shoe travelling fast, with speed lines trailing behind it.
  running: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <line x1={30} y1={90} x2={54} y2={90} stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <line x1={26} y1={108} x2={50} y2={108} stroke={DENIM_LIGHT} strokeWidth={5} strokeLinecap="round" />
      <line x1={32} y1={126} x2={46} y2={126} stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M 58 130 Q 58 104 88 100 Q 116 96 128 80 Q 134 70 144 72 Q 154 76 154 96 L 154 130 Z"
        fill={TERRACOTTA}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <ellipse cx={146} cy={78} rx={11} ry={6} fill={INK} transform="rotate(-22 146 78)" />
      <line x1={98} y1={112} x2={114} y2={102} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <line x1={104} y1={120} x2={120} y2={110} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <line x1={110} y1={128} x2={126} y2={118} stroke={CREAM} strokeWidth={4} strokeLinecap="round" />
      <path
        d="M 52 128 L 158 128 Q 168 128 168 138 Q 168 148 156 148 L 60 148 Q 50 148 50 138 Q 50 130 52 128 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <line x1={56} y1={138} x2={162} y2={138} stroke={MUSTARD} strokeWidth={5} strokeLinecap="round" />
    </>
  ),

  // Three club runners jogging along in a row.
  "run-clubs": () => (
    <>
      <ellipse cx={100} cy={150} rx={66} ry={7} fill={INK} opacity={0.13} />
      <circle cx={54} cy={76} r={9} fill={MUSTARD_LIGHT} />
      <path d="M 45 73 Q 54 61 63 73" fill={INK} />
      <rect x={45} y={88} width={18} height={30} rx={8} fill={TERRACOTTA} />
      <path d="M 45 96 L 33 106" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 63 94 L 74 86" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M 51 116 L 40 134 L 43 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 57 116 L 67 132 L 74 142"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={100} cy={72} r={9} fill={MUSTARD_LIGHT} />
      <path d="M 91 69 Q 100 57 109 69" fill={INK} />
      <rect x={91} y={84} width={18} height={30} rx={8} fill={DENIM} />
      <path d="M 91 90 L 80 82" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 109 92 L 121 102" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M 97 112 L 84 128 L 78 138"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 103 112 L 112 132 L 109 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={146} cy={78} r={9} fill={MUSTARD_LIGHT} />
      <path d="M 137 75 Q 146 63 155 75" fill={INK} />
      <rect x={137} y={90} width={18} height={30} rx={8} fill={OLIVE} />
      <path d="M 137 98 L 125 108" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 155 96 L 166 88" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M 143 118 L 132 134 L 135 150"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 149 118 L 159 132 L 166 142"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),

  // Standing tree pose on a rolled-out mat.
  yoga: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <rect x={40} y={138} width={116} height={11} rx={5} fill={SAGE} />
      <circle cx={156} cy={143} r={7} fill={OLIVE} />
      <path
        d="M 90 90 Q 84 66 100 52"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 110 90 Q 116 66 100 52"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={100} cy={76} r={11} fill={MUSTARD_LIGHT} />
      <circle cx={100} cy={64} r={6} fill={INK} />
      <rect x={88} y={86} width={24} height={34} rx={10} fill={TERRACOTTA} />
      <path
        d="M 100 118 L 100 140"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <path
        d="M 98 118 L 74 132 L 94 124"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={92} y1={140} x2={110} y2={140} stroke={INK} strokeWidth={6} strokeLinecap="round" />
    </>
  ),

  // Climber reaching between coloured holds on a wall.
  climbing: () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <rect x={30} y={44} width={140} height={106} rx={4} fill={PAPER_DARK} />
      <circle cx={44} cy={92} r={7} fill={DENIM} />
      <circle cx={158} cy={108} r={6} fill={BLUSH} />
      <circle cx={50} cy={54} r={6} fill={SAGE} />
      <circle cx={72} cy={58} r={8} fill={MUSTARD} />
      <circle cx={130} cy={56} r={8} fill={TERRACOTTA} />
      <circle cx={76} cy={140} r={7} fill={OLIVE} />
      <circle cx={126} cy={140} r={7} fill={RUST} />
      <path d="M 90 80 L 74 60" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M 110 78 L 128 58" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path
        d="M 94 108 L 88 128 L 78 138"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 106 108 L 114 128 L 124 138"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={100} cy={62} r={10} fill={MUSTARD_LIGHT} />
      <path d="M 90 60 Q 100 48 110 60" fill={INK} />
      <rect x={87} y={74} width={26} height={36} rx={10} fill={DENIM} />
    </>
  ),

  // Side-on bicycle.
  cycling: () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />
      <circle cx={58} cy={120} r={28} fill="none" stroke={INK} strokeWidth={6} />
      <circle cx={142} cy={120} r={28} fill="none" stroke={INK} strokeWidth={6} />
      <circle cx={58} cy={120} r={21} fill="none" stroke={SAGE} strokeWidth={3} />
      <circle cx={142} cy={120} r={21} fill="none" stroke={SAGE} strokeWidth={3} />
      <path
        d="M 58 120 L 92 82 L 100 120 Z"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 92 82 L 128 78 L 142 120"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 100 120 L 128 78"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <ellipse cx={90} cy={76} rx={12} ry={5} fill={INK} transform="rotate(-10 90 76)" />
      <path
        d="M 122 66 L 136 66 Q 142 66 142 74"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={128} y1={78} x2={130} y2={68} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <circle cx={58} cy={120} r={5} fill={INK} />
      <circle cx={142} cy={120} r={5} fill={INK} />
      <circle cx={100} cy={120} r={6} fill={MUSTARD} stroke={INK} strokeWidth={3} />
      <line x1={100} y1={120} x2={110} y2={132} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={106} y1={134} x2={118} y2={132} stroke={INK} strokeWidth={5} strokeLinecap="round" />
    </>
  ),

  // Dancer mid-turn, skirt flaring, with a motion arc behind.
  dance: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 42 116 Q 100 70 158 116"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 54 128 Q 100 92 146 128"
        fill="none"
        stroke={SAGE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path d="M 96 82 Q 76 76 66 60" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M 116 82 Q 134 80 142 64" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={106} cy={62} r={11} fill={MUSTARD_LIGHT} />
      <path d="M 96 58 Q 104 46 118 54 Q 124 58 120 68 Q 112 52 96 58 Z" fill={INK} />
      <path d="M 96 76 L 116 76 L 120 106 L 98 106 Z" fill={BLUSH} />
      <path
        d="M 94 100 Q 62 128 78 136 Q 102 145 126 133 Q 142 126 122 100 Z"
        fill={RUST}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M 106 130 L 106 148" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M 112 128 L 132 138" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <line x1={98} y1={148} x2={116} y2={148} stroke={INK} strokeWidth={6} strokeLinecap="round" />
    </>
  ),

  // Flat solid pickleball paddle beside a perforated plastic ball.
  pickleball: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={48} y={54} width={72} height={80} rx={16} fill={TERRACOTTA} stroke={INK} strokeWidth={4} />
      <line x1={62} y1={70} x2={106} y2={70} stroke={RUST} strokeWidth={4} strokeLinecap="round" />
      <rect x={74} y={128} width={20} height={22} rx={7} fill={INK} />
      <rect x={76} y={134} width={16} height={5} fill={MUSTARD} />
      <circle cx={148} cy={137} r={13} fill={MUSTARD_LIGHT} stroke={INK} strokeWidth={3} />
      <circle cx={143} cy={131} r={2.5} fill={INK} />
      <circle cx={153} cy={132} r={2.5} fill={INK} />
      <circle cx={147} cy={140} r={2.5} fill={INK} />
      <circle cx={156} cy={141} r={2.5} fill={INK} />
      <circle cx={140} cy={141} r={2.5} fill={INK} />
    </>
  ),

  // Perforated teardrop padel racket in front of a glass court wall.
  padel: () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <rect x={28} y={46} width={144} height={104} rx={3} fill={PAPER_DARK} />
      <line x1={76} y1={46} x2={76} y2={150} stroke={DENIM_LIGHT} strokeWidth={4} />
      <line x1={124} y1={46} x2={124} y2={150} stroke={DENIM_LIGHT} strokeWidth={4} />
      <line x1={28} y1={98} x2={172} y2={98} stroke={DENIM_LIGHT} strokeWidth={4} />
      <path
        d="M 100 50 Q 136 50 136 90 Q 136 120 100 126 Q 64 120 64 90 Q 64 50 100 50 Z"
        fill={OLIVE}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx={100} cy={74} r={4} fill={INK} />
      <circle cx={84} cy={86} r={4} fill={INK} />
      <circle cx={116} cy={86} r={4} fill={INK} />
      <circle cx={100} cy={98} r={4} fill={INK} />
      <circle cx={84} cy={110} r={4} fill={INK} />
      <circle cx={116} cy={110} r={4} fill={INK} />
      <circle cx={100} cy={62} r={4} fill={INK} />
      <rect x={92} y={124} width={16} height={26} rx={6} fill={INK} />
      <rect x={93} y={132} width={14} height={5} fill={MUSTARD} />
    </>
  ),

  // Strung oval tennis racket with a seamed felt ball.
  tennis: () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <path d="M 96 116 L 104 148" fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d="M 100 132 L 105 146" fill="none" stroke={TERRACOTTA} strokeWidth={10} strokeLinecap="round" />
      <ellipse cx={96} cy={80} rx={34} ry={40} fill={DENIM} stroke={INK} strokeWidth={6} />
      <line x1={78} y1={51} x2={78} y2={109} stroke={CREAM} strokeWidth={3} />
      <line x1={87} y1={46} x2={87} y2={114} stroke={CREAM} strokeWidth={3} />
      <line x1={96} y1={44} x2={96} y2={116} stroke={CREAM} strokeWidth={3} />
      <line x1={105} y1={46} x2={105} y2={114} stroke={CREAM} strokeWidth={3} />
      <line x1={114} y1={51} x2={114} y2={109} stroke={CREAM} strokeWidth={3} />
      <line x1={74} y1={56} x2={118} y2={56} stroke={CREAM} strokeWidth={3} />
      <line x1={68} y1={68} x2={124} y2={68} stroke={CREAM} strokeWidth={3} />
      <line x1={66} y1={80} x2={126} y2={80} stroke={CREAM} strokeWidth={3} />
      <line x1={68} y1={92} x2={124} y2={92} stroke={CREAM} strokeWidth={3} />
      <line x1={74} y1={104} x2={118} y2={104} stroke={CREAM} strokeWidth={3} />
      <circle cx={146} cy={137} r={13} fill={SAGE} stroke={INK} strokeWidth={3} />
      <path d="M 136 128 Q 146 137 136 146" fill="none" stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <path d="M 156 128 Q 146 137 156 146" fill="none" stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Hiking boot and trekking pole in front of a trail up a hill.
  hiking: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <path d="M 26 150 L 66 98 L 100 150 Z" fill={SAGE} />
      <path d="M 68 150 L 112 82 L 158 150 Z" fill={OLIVE} />
      <path d="M 112 82 L 124 100 L 100 100 Z" fill={CREAM} />
      <path
        d="M 122 150 Q 128 132 118 122 Q 108 112 118 100"
        fill="none"
        stroke={CREAM}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <line x1={56} y1={66} x2={70} y2={146} stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <line x1={55} y1={64} x2={59} y2={84} stroke={INK} strokeWidth={8} strokeLinecap="round" />
      <line x1={62} y1={132} x2={72} y2={132} stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path
        d="M 92 104 L 116 104 Q 120 124 136 130 Q 148 134 148 142 L 96 142 Q 90 142 90 136 Z"
        fill={RUST}
        stroke={INK}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <line x1={96} y1={112} x2={112} y2={112} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <line x1={96} y1={121} x2={116} y2={121} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <line x1={98} y1={130} x2={122} y2={130} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <rect x={86} y={139} width={66} height={11} rx={5} fill={INK} />
    </>
  ),

  // Front-crawl swimmer in stylised lane water.
  swimming: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <rect x={26} y={112} width={148} height={38} rx={8} fill={DENIM} />
      <path
        d="M 30 122 Q 48 114 66 122 Q 84 130 102 122 Q 120 114 138 122 Q 156 130 172 122"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 28 138 Q 46 130 64 138 Q 82 146 100 138 Q 118 130 136 138 Q 154 146 170 138"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path d="M 64 108 L 44 98" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M 64 114 L 46 122" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path
        d="M 64 110 Q 92 98 124 102"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={17}
        strokeLinecap="round"
      />
      <path d="M 112 100 Q 106 76 94 62" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <path d="M 120 108 L 142 114" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={130} cy={98} r={11} fill={MUSTARD_LIGHT} />
      <path d="M 119 96 Q 122 84 134 87 Q 141 89 141 98 Z" fill={MUSTARD} />
      <circle cx={88} cy={54} r={4} fill={CREAM} />
      <circle cx={78} cy={66} r={3} fill={CREAM} />
      <circle cx={100} cy={48} r={3} fill={CREAM} />
    </>
  ),

  // Folded martial-arts gi with the belt tied round it.
  "martial-arts": () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 46 74 L 100 58 L 154 74 L 148 144 L 52 144 Z"
        fill={CREAM}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M 74 66 L 100 110 L 126 66"
        fill="none"
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M 100 58 L 100 110" fill="none" stroke={INK} strokeWidth={3} />
      <rect x={46} y={106} width={108} height={16} rx={4} fill={RUST} stroke={INK} strokeWidth={3} />
      <rect x={88} y={100} width={24} height={28} rx={6} fill={RUST} stroke={INK} strokeWidth={3} />
      <path d="M 94 128 L 90 146" fill="none" stroke={RUST} strokeWidth={7} strokeLinecap="round" />
      <path d="M 108 128 L 113 146" fill="none" stroke={RUST} strokeWidth={7} strokeLinecap="round" />
    </>
  ),

  // Kettlebell with a looped resistance band beside it.
  "strength-training": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <ellipse
        cx={150}
        cy={122}
        rx={16}
        ry={28}
        fill="none"
        stroke={OLIVE}
        strokeWidth={6}
        transform="rotate(16 150 122)"
      />
      <path
        d="M 81 106 Q 79 70 101 70 Q 123 70 121 106"
        fill="none"
        stroke={INK}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M 74 104 Q 66 122 70 138 Q 73 148 88 148 L 116 148 Q 131 148 134 138 Q 138 122 130 104 Z"
        fill={DENIM}
        stroke={INK}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <ellipse cx={91} cy={124} rx={9} ry={7} fill={DENIM_LIGHT} />
      <rect x={78} y={100} width={48} height={9} rx={4} fill={INK} />
    </>
  ),

  // Loaded barbell resting on the floor, spare plate standing behind it.
  weightlifting: () => (
    <>
      <ellipse cx={100} cy={150} rx={66} ry={7} fill={INK} opacity={0.13} />
      <circle cx={100} cy={112} r={38} fill={MUSTARD} stroke={INK} strokeWidth={4} />
      <circle cx={100} cy={112} r={11} fill={CREAM} stroke={INK} strokeWidth={3} />
      <circle cx={42} cy={126} r={15} fill={DENIM} stroke={INK} strokeWidth={4} />
      <circle cx={158} cy={126} r={15} fill={DENIM} stroke={INK} strokeWidth={4} />
      <rect x={30} y={122} width={140} height={9} rx={4} fill={INK} />
      <circle cx={62} cy={126} r={24} fill={RUST} stroke={INK} strokeWidth={4} />
      <circle cx={138} cy={126} r={24} fill={RUST} stroke={INK} strokeWidth={4} />
      <circle cx={62} cy={126} r={7} fill={CREAM} />
      <circle cx={138} cy={126} r={7} fill={CREAM} />
      <line x1={92} y1={122} x2={92} y2={131} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
      <line x1={108} y1={122} x2={108} y2={131} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Basketball with its seams, next to a backboard and hoop.
  basketball: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <rect x={152} y={88} width={9} height={62} fill={INK} />
      <rect x={100} y={46} width={62} height={44} rx={4} fill={CREAM} stroke={INK} strokeWidth={4} />
      <rect x={118} y={60} width={26} height={20} fill="none" stroke={TERRACOTTA} strokeWidth={3} />
      <line x1={110} y1={92} x2={150} y2={92} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
      <path d="M 112 94 L 118 112" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M 130 94 L 130 114" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M 148 94 L 142 112" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M 115 104 L 145 104" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <circle cx={66} cy={122} r={28} fill={TERRACOTTA} stroke={INK} strokeWidth={4} />
      <line x1={66} y1={94} x2={66} y2={150} stroke={INK} strokeWidth={3} />
      <line x1={38} y1={122} x2={94} y2={122} stroke={INK} strokeWidth={3} />
      <path d="M 46 102 Q 66 122 46 142" fill="none" stroke={INK} strokeWidth={3} />
      <path d="M 86 102 Q 66 122 86 142" fill="none" stroke={INK} strokeWidth={3} />
    </>
  ),

  // Panelled soccer ball in the corner of a goal.
  soccer: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <line x1={52} y1={62} x2={52} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={68} y1={62} x2={68} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={84} y1={62} x2={84} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={100} y1={62} x2={100} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={116} y1={62} x2={116} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={132} y1={62} x2={132} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={148} y1={62} x2={148} y2={148} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={42} y1={78} x2={158} y2={78} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={42} y1={94} x2={158} y2={94} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={42} y1={110} x2={158} y2={110} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={42} y1={126} x2={158} y2={126} stroke={INK} strokeWidth={2} opacity={0.28} />
      <line x1={42} y1={142} x2={158} y2={142} stroke={INK} strokeWidth={2} opacity={0.28} />
      <path
        d="M 42 148 L 42 60 L 158 60"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={112} cy={124} r={26} fill={CREAM} stroke={INK} strokeWidth={4} />
      <path d="M 112 113 L 122 120 L 118 132 L 106 132 L 102 120 Z" fill={INK} />
      <line x1={112} y1={113} x2={112} y2={100} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <line x1={122} y1={120} x2={135} y2={114} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <line x1={118} y1={132} x2={124} y2={146} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <line x1={106} y1={132} x2={100} y2={146} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <line x1={102} y1={120} x2={89} y2={114} stroke={INK} strokeWidth={4} strokeLinecap="round" />
    </>
  ),

  // Volleyball with curved bands in front of a net strip.
  volleyball: () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <line x1={31} y1={62} x2={31} y2={148} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={169} y1={62} x2={169} y2={148} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={40} y1={90} x2={160} y2={90} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={40} y1={102} x2={160} y2={102} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={40} y1={114} x2={160} y2={114} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={52} y1={80} x2={52} y2={118} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={76} y1={80} x2={76} y2={118} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={100} y1={80} x2={100} y2={118} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={124} y1={80} x2={124} y2={118} stroke={INK} strokeWidth={2} opacity={0.3} />
      <line x1={148} y1={80} x2={148} y2={118} stroke={INK} strokeWidth={2} opacity={0.3} />
      <rect x={31} y={64} width={138} height={16} fill={CREAM} stroke={INK} strokeWidth={3} />
      <circle cx={100} cy={120} r={30} fill={CREAM} stroke={INK} strokeWidth={4} />
      <path d="M 78 100 Q 92 120 78 142" fill="none" stroke={DENIM} strokeWidth={6} strokeLinecap="round" />
      <path d="M 122 100 Q 108 120 122 142" fill="none" stroke={DENIM} strokeWidth={6} strokeLinecap="round" />
      <path d="M 72 108 Q 100 130 128 108" fill="none" stroke={MUSTARD} strokeWidth={6} strokeLinecap="round" />
    </>
  ),

  // Pilates: lying leg work on the mat with a magic-circle ring.
  pilates: () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />
      <rect x={30} y={132} width={140} height={9} rx={4} fill={PAPER_DARK} />
      <rect x={34} y={136} width={132} height={12} rx={6} fill={DENIM_LIGHT} />
      <line x1={44} y1={141} x2={44} y2={150} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <line x1={156} y1={141} x2={156} y2={150} stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <circle cx={50} cy={92} r={15} fill="none" stroke={MUSTARD} strokeWidth={6} />
      <rect x={44} y={74} width={12} height={6} rx={3} fill={INK} />
      <rect x={44} y={104} width={12} height={6} rx={3} fill={INK} />
      <path
        d="M 108 130 L 128 104 L 148 114"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.55}
      />
      <path
        d="M 110 126 L 132 96 L 152 106"
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x={68} y={110} width={46} height={26} rx={12} fill={OLIVE} />
      <path d="M 78 116 L 62 100" fill="none" stroke={INK} strokeWidth={6} strokeLinecap="round" />
      <circle cx={60} cy={122} r={11} fill={MUSTARD_LIGHT} />
      <path d="M 50 118 Q 54 108 66 112 Q 72 115 70 122 Q 62 112 50 118 Z" fill={INK} />
    </>
  ),
};
