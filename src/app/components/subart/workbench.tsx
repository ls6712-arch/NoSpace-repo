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
 * Workbench hobbies — craft-table subjects drawn in the shared flat-vector
 * style. Every entry emits raw SVG children for a 200x200 viewBox: subject
 * centred on x=100, resting on the ground line at y=150.
 */
export const workbenchArt: Record<string, SubArtDrawing> = {
  // Potter's wheel with a pot being thrown on it.
  pottery: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />
      <rect x={72} y={140} width={56} height={9} rx={4} fill={INK} opacity={0.55} />
      <rect x={88} y={112} width={24} height={30} fill={INK} opacity={0.45} />
      <ellipse cx={100} cy={114} rx={46} ry={11} fill={INK} opacity={0.3} />
      <ellipse cx={100} cy={109} rx={46} ry={11} fill={PAPER_DARK} />
      <path
        d="M 82 105 Q 68 86 76 70 Q 82 56 100 56 Q 118 56 124 70 Q 132 86 118 105 Z"
        fill={TERRACOTTA}
      />
      <ellipse cx={100} cy={105} rx={18} ry={5} fill={RUST} />
      <ellipse cx={100} cy={56} rx={17} ry={5} fill={RUST} />
      <path d="M 80 82 Q 100 90 120 82" fill="none" stroke={RUST} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // A set of finished glazed vessels: tall vase, wide bowl, little pot.
  ceramics: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={54} y={74} width={12} height={22} fill={DENIM} />
      <path
        d="M 60 92 Q 78 100 76 124 Q 74 146 60 146 Q 46 146 44 124 Q 42 100 60 92 Z"
        fill={DENIM}
      />
      <ellipse cx={60} cy={74} rx={10} ry={4} fill={DENIM_LIGHT} />
      <line x1={45} y1={118} x2={75} y2={118} stroke={DENIM_LIGHT} strokeWidth={6} strokeLinecap="round" />
      <path d="M 82 118 Q 82 144 106 144 Q 130 144 130 118 Z" fill={MUSTARD} />
      <rect x={98} y={142} width={16} height={7} rx={2} fill={MUSTARD} />
      <ellipse cx={106} cy={118} rx={24} ry={6} fill={MUSTARD_LIGHT} />
      <path
        d="M 134 132 Q 132 148 146 148 Q 160 148 158 132 Q 156 123 146 123 Q 136 123 134 132 Z"
        fill={BLUSH}
      />
      <ellipse cx={146} cy={126} rx={10} ry={4} fill={CREAM} />
    </>
  ),

  // Ball of yarn with two straight needles pushed through it.
  knitting: () => (
    <>
      <ellipse cx={100} cy={150} rx={40} ry={7} fill={INK} opacity={0.13} />
      <line x1={58} y1={140} x2={144} y2={62} stroke={MUSTARD_LIGHT} strokeWidth={6} strokeLinecap="round" />
      <circle cx={145} cy={60} r={5} fill={MUSTARD} />
      <line x1={76} y1={146} x2={152} y2={78} stroke={MUSTARD_LIGHT} strokeWidth={6} strokeLinecap="round" />
      <circle cx={153} cy={76} r={5} fill={MUSTARD} />
      <circle cx={98} cy={116} r={33} fill={BLUSH} />
      <path d="M 70 104 Q 98 92 126 108" fill="none" stroke={RUST} strokeWidth={3} strokeLinecap="round" />
      <path d="M 68 122 Q 96 112 128 126" fill="none" stroke={RUST} strokeWidth={3} strokeLinecap="round" />
      <path d="M 78 138 Q 100 128 120 142" fill="none" stroke={RUST} strokeWidth={3} strokeLinecap="round" />
      <path
        d="M 128 126 Q 148 136 138 148"
        fill="none"
        stroke={BLUSH}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),

  // One hook pulling a chunky chain of loops out of a yarn ball.
  crochet: () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />
      <circle cx={54} cy={132} r={18} fill={MUSTARD} />
      <path d="M 40 124 Q 54 118 68 126" fill="none" stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <path d="M 40 138 Q 56 132 68 140" fill="none" stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <ellipse
        cx={72}
        cy={126}
        rx={13}
        ry={8}
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        transform="rotate(-28 72 126)"
      />
      <ellipse
        cx={90}
        cy={117}
        rx={13}
        ry={8}
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        transform="rotate(-28 90 117)"
      />
      <ellipse
        cx={108}
        cy={108}
        rx={13}
        ry={8}
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        transform="rotate(-28 108 108)"
      />
      <ellipse
        cx={126}
        cy={99}
        rx={13}
        ry={8}
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        transform="rotate(-28 126 99)"
      />
      <line x1={134} y1={94} x2={154} y2={64} stroke={DENIM} strokeWidth={6} strokeLinecap="round" />
      <path
        d="M 154 64 Q 162 54 154 50 Q 147 48 147 56"
        fill="none"
        stroke={DENIM}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),

  // Hoop of fabric with a stitched flower and a threaded needle.
  embroidery: () => (
    <>
      <ellipse cx={100} cy={150} rx={42} ry={7} fill={INK} opacity={0.13} />
      <rect x={92} y={52} width={16} height={12} rx={4} fill={MUSTARD} />
      <circle cx={100} cy={104} r={42} fill={CREAM} />
      <circle cx={100} cy={104} r={42} fill="none" stroke={MUSTARD_LIGHT} strokeWidth={8} />
      <ellipse cx={86} cy={88} rx={9} ry={12} fill={BLUSH} transform="rotate(-35 86 88)" />
      <ellipse cx={110} cy={86} rx={9} ry={12} fill={BLUSH} transform="rotate(25 110 86)" />
      <ellipse cx={82} cy={108} rx={9} ry={12} fill={BLUSH} transform="rotate(-70 82 108)" />
      <ellipse cx={114} cy={106} rx={9} ry={12} fill={BLUSH} transform="rotate(60 114 106)" />
      <circle cx={98} cy={98} r={9} fill={MUSTARD} />
      <path d="M 98 108 Q 96 126 86 134" fill="none" stroke={OLIVE} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={82} cy={128} rx={10} ry={6} fill={SAGE} transform="rotate(-32 82 128)" />
      <line x1={116} y1={124} x2={124} y2={130} stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <line x1={124} y1={120} x2={132} y2={124} stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <line x1={142} y1={132} x2={166} y2={148} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <path d="M 142 132 Q 150 118 138 112" fill="none" stroke={BLUSH} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Sewing machine with a spool and fabric under the needle.
  sewing: () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <rect x={44} y={130} width={112} height={18} rx={5} fill={DENIM} />
      <rect x={124} y={68} width={28} height={64} rx={7} fill={DENIM} />
      <rect x={52} y={66} width={100} height={24} rx={9} fill={DENIM} />
      <rect x={50} y={84} width={24} height={22} rx={6} fill={DENIM_LIGHT} />
      <rect x={132} y={48} width={11} height={20} rx={2} fill={MUSTARD} />
      <line x1={128} y1={48} x2={147} y2={48} stroke={MUSTARD_LIGHT} strokeWidth={5} strokeLinecap="round" />
      <circle cx={152} cy={102} r={12} fill={MUSTARD_LIGHT} />
      <circle cx={152} cy={102} r={4} fill={INK} opacity={0.5} />
      <rect x={38} y={122} width={44} height={9} rx={4} fill={BLUSH} />
      <line x1={62} y1={106} x2={62} y2={122} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.6} />
      <rect x={54} y={122} width={16} height={5} rx={2} fill={INK} opacity={0.5} />
      <line x1={62} y1={72} x2={62} y2={80} stroke={CREAM} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Hand plane on a board, curling shavings off the front.
  woodworking: () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={36} y={126} width={128} height={20} rx={4} fill={PAPER_DARK} />
      <line x1={44} y1={134} x2={156} y2={134} stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.2} />
      <line x1={50} y1={141} x2={148} y2={141} stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.2} />
      <path
        d="M 128 100 Q 138 82 130 72"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <rect x={70} y={100} width={68} height={26} rx={6} fill={RUST} />
      <circle cx={82} cy={94} r={10} fill={MUSTARD} />
      <line x1={98} y1={104} x2={110} y2={122} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <path
        d="M 68 116 Q 50 106 46 120 Q 44 132 58 126"
        fill="none"
        stroke={MUSTARD_LIGHT}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 66 126 Q 54 124 52 134"
        fill="none"
        stroke={MUSTARD_LIGHT}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </>
  ),

  // Pliers standing over a beaded wire.
  "jewelry-making": () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 66 144 L 96 98 Q 100 90 96 82"
        fill="none"
        stroke={DENIM}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <path
        d="M 134 144 L 104 98 Q 100 90 104 82"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <line x1={95} y1={82} x2={90} y2={60} stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <line x1={105} y1={82} x2={110} y2={60} stroke={DENIM_LIGHT} strokeWidth={5} strokeLinecap="round" />
      <circle cx={100} cy={100} r={7} fill={INK} opacity={0.5} />
      <path
        d="M 40 116 Q 100 142 160 112"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <circle cx={56} cy={124} r={8} fill={BLUSH} />
      <circle cx={78} cy={133} r={7} fill={OLIVE} />
      <circle cx={122} cy={133} r={8} fill={TERRACOTTA} />
      <circle cx={146} cy={122} r={7} fill={MUSTARD_LIGHT} />
    </>
  ),

  // A poured candle burning next to its pouring pitcher.
  "candle-making": () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <rect x={48} y={86} width={44} height={61} rx={6} fill={CREAM} />
      <ellipse cx={70} cy={86} rx={22} ry={6} fill={PAPER_DARK} />
      <line x1={70} y1={84} x2={70} y2={74} stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M 70 54 Q 79 66 70 78 Q 61 66 70 54 Z" fill={MUSTARD} />
      <path d="M 70 64 Q 74 70 70 76 Q 66 70 70 64 Z" fill={MUSTARD_LIGHT} />
      <path d="M 108 108 L 98 103 L 111 116 Z" fill={DENIM} />
      <path
        d="M 106 110 L 110 142 Q 110 147 116 147 L 138 147 Q 144 147 144 142 L 146 110 Z"
        fill={DENIM_LIGHT}
      />
      <ellipse cx={126} cy={110} rx={20} ry={5} fill={DENIM} />
      <path
        d="M 146 118 Q 157 122 150 134"
        fill="none"
        stroke={DENIM}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),

  // Cut bars stacked beside the wooden mould they came out of.
  "soap-making": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={136} y={114} width={34} height={32} rx={4} fill={RUST} />
      <rect x={142} y={120} width={22} height={26} rx={2} fill={PAPER_DARK} />
      <rect x={40} y={124} width={92} height={22} rx={5} fill={SAGE} />
      <rect x={46} y={104} width={78} height={20} rx={5} fill={BLUSH} />
      <rect
        x={54}
        y={84}
        width={62}
        height={20}
        rx={5}
        fill={MUSTARD_LIGHT}
        transform="rotate(-6 85 94)"
      />
      <circle cx={72} cy={72} r={7} fill={CREAM} />
      <circle cx={92} cy={62} r={5} fill={CREAM} />
      <circle cx={108} cy={74} r={4} fill={CREAM} />
    </>
  ),

  // A chair half repainted, brush leaning against it.
  "furniture-flipping": () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <rect x={60} y={52} width={68} height={13} rx={5} fill={PAPER_DARK} />
      <rect x={60} y={52} width={10} height={62} fill={PAPER_DARK} />
      <rect x={118} y={52} width={10} height={62} fill={PAPER_DARK} />
      <rect x={66} y={80} width={56} height={11} rx={4} fill={PAPER_DARK} />
      <rect x={56} y={112} width={76} height={15} rx={4} fill={PAPER_DARK} />
      <rect x={60} y={127} width={10} height={21} fill={PAPER_DARK} />
      <rect x={118} y={127} width={10} height={21} fill={PAPER_DARK} />
      <rect x={96} y={52} width={32} height={13} rx={5} fill={DENIM} />
      <rect x={118} y={52} width={10} height={62} fill={DENIM} />
      <rect x={96} y={80} width={26} height={11} rx={4} fill={DENIM} />
      <rect x={96} y={112} width={36} height={15} rx={4} fill={DENIM} />
      <rect x={118} y={127} width={10} height={21} fill={DENIM} />
      <line x1={154} y1={146} x2={142} y2={102} stroke={MUSTARD} strokeWidth={7} strokeLinecap="round" />
      <line x1={141} y1={99} x2={138} y2={90} stroke={INK} strokeWidth={9} strokeLinecap="round" opacity={0.45} />
      <line x1={137} y1={88} x2={133} y2={74} stroke={DENIM} strokeWidth={9} strokeLinecap="round" />
    </>
  ),

  // Old mantel clock opened up, screwdriver going in.
  restoration: () => (
    <>
      <ellipse cx={100} cy={150} rx={48} ry={7} fill={INK} opacity={0.13} />
      <ellipse cx={94} cy={56} rx={11} ry={7} fill={RUST} />
      <rect x={66} y={136} width={14} height={12} rx={3} fill={RUST} />
      <rect x={108} y={136} width={14} height={12} rx={3} fill={RUST} />
      <circle cx={94} cy={100} r={42} fill={TERRACOTTA} />
      <circle cx={94} cy={100} r={32} fill={CREAM} />
      <line x1={94} y1={72} x2={94} y2={78} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <line x1={122} y1={100} x2={116} y2={100} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <line x1={94} y1={128} x2={94} y2={122} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <line x1={66} y1={100} x2={72} y2={100} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
      <line x1={94} y1={100} x2={94} y2={80} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <line x1={94} y1={100} x2={110} y2={108} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <circle cx={94} cy={100} r={4} fill={INK} opacity={0.7} />
      <line x1={158} y1={140} x2={140} y2={112} stroke={DENIM} strokeWidth={10} strokeLinecap="round" />
      <line x1={138} y1={110} x2={124} y2={90} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <line x1={126} y1={92} x2={122} y2={86} stroke={MUSTARD} strokeWidth={5} strokeLinecap="round" />
    </>
  ),

  // A tin reborn as a planter, with a loop of arrows around it.
  upcycling: () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />
      <path d="M 44 108 Q 44 72 74 62" fill="none" stroke={MUSTARD} strokeWidth={5} strokeLinecap="round" />
      <path d="M 74 54 L 88 63 L 72 71 Z" fill={MUSTARD} />
      <path d="M 158 100 Q 158 130 130 138" fill="none" stroke={MUSTARD} strokeWidth={5} strokeLinecap="round" />
      <path d="M 130 130 L 116 139 L 132 146 Z" fill={MUSTARD} />
      <path d="M 100 92 Q 90 68 78 58" fill="none" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={80} cy={58} rx={12} ry={7} fill={SAGE} transform="rotate(-38 80 58)" />
      <path d="M 100 92 Q 112 70 124 62" fill="none" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={122} cy={62} rx={12} ry={7} fill={SAGE} transform="rotate(34 122 62)" />
      <path d="M 100 92 Q 100 74 100 66" fill="none" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={100} cy={64} rx={8} ry={11} fill={SAGE} />
      <rect x={71} y={96} width={58} height={50} rx={4} fill={DENIM_LIGHT} />
      <ellipse cx={100} cy={96} rx={29} ry={8} fill={DENIM} />
      <ellipse cx={100} cy={96} rx={22} ry={6} fill={RUST} />
      <rect x={71} y={114} width={58} height={9} fill={CREAM} />
    </>
  ),

  // Folded paper crane with offcuts around it.
  "paper-crafts": () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />
      <rect x={34} y={139} width={28} height={9} rx={2} fill={BLUSH} transform="rotate(-12 48 143)" />
      <rect x={140} y={140} width={28} height={9} rx={2} fill={SAGE} transform="rotate(10 154 144)" />
      <path d="M 100 88 L 44 62 L 84 106 Z" fill={DENIM_LIGHT} />
      <path d="M 100 88 L 156 62 L 116 106 Z" fill={DENIM} />
      <path d="M 108 92 L 140 58 L 148 66 L 112 98 Z" fill={PAPER_DARK} />
      <path d="M 92 92 L 66 56 L 76 52 L 100 88 Z" fill={PAPER_DARK} />
      <path d="M 66 56 L 50 52 L 68 45 Z" fill={MUSTARD} />
      <path d="M 100 142 L 76 100 L 100 84 L 124 100 Z" fill={CREAM} />
      <line x1={100} y1={86} x2={100} y2={140} stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.22} />
    </>
  ),

  // Small stapled zine with a bold cover, one behind it.
  zines: () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />
      <rect
        x={112}
        y={60}
        width={44}
        height={84}
        rx={3}
        fill={PAPER_DARK}
        transform="rotate(11 134 102)"
      />
      <rect
        x={58}
        y={58}
        width={60}
        height={88}
        rx={3}
        fill={SAGE}
        transform="rotate(-8 88 102)"
      />
      <rect x={66} y={52} width={9} height={94} fill={MUSTARD} />
      <rect x={74} y={52} width={64} height={94} rx={3} fill={CREAM} />
      <circle cx={106} cy={86} r={22} fill={RUST} />
      <rect x={78} y={118} width={56} height={12} rx={3} fill={DENIM} />
      <rect x={78} y={135} width={34} height={7} rx={3} fill={INK} opacity={0.35} />
      <rect x={68} y={74} width={9} height={5} rx={1} fill={INK} opacity={0.6} />
      <rect x={68} y={118} width={9} height={5} rx={1} fill={INK} opacity={0.6} />
    </>
  ),

  // Open album spread with a taped-in photo and washi strips.
  scrapbooking: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={68} y={50} width={56} height={46} rx={2} fill={CREAM} transform="rotate(-8 96 73)" />
      <rect x={74} y={56} width={44} height={30} rx={1} fill={SAGE} transform="rotate(-8 96 73)" />
      <rect x={82} y={44} width={30} height={9} rx={1} fill={MUSTARD_LIGHT} transform="rotate(-8 97 48)" />
      <rect x={28} y={98} width={144} height={50} rx={5} fill={RUST} />
      <rect x={32} y={92} width={66} height={52} rx={3} fill={CREAM} transform="rotate(-3 65 118)" />
      <rect x={102} y={92} width={66} height={52} rx={3} fill={CREAM} transform="rotate(3 135 118)" />
      <line x1={100} y1={94} x2={100} y2={146} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      <rect x={44} y={102} width={44} height={32} rx={2} fill={DENIM_LIGHT} transform="rotate(-3 66 118)" />
      <path d="M 44 102 L 54 102 L 44 112 Z" fill={MUSTARD} transform="rotate(-3 66 118)" />
      <path d="M 88 134 L 78 134 L 88 124 Z" fill={MUSTARD} transform="rotate(-3 66 118)" />
      <rect x={110} y={100} width={48} height={11} rx={1} fill={BLUSH} transform="rotate(-6 134 105)" />
      <rect x={112} y={120} width={42} height={10} rx={1} fill={OLIVE} transform="rotate(4 133 125)" />
      <rect x={112} y={136} width={30} height={7} rx={1} fill={PAPER_DARK} transform="rotate(2 127 139)" />
    </>
  ),
};
