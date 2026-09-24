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
 * Maker-lab hobbies — machines, boards and prototypes drawn in the shared
 * flat-vector style. Every entry emits raw SVG children for a 200x200
 * viewBox: subject centred on x=100, resting on the ground line at y=150.
 */
export const makerlabArt: Record<string, SubArtDrawing> = {
  // Printer frame with the extruder head laying down a lattice part.
  "3d-printing": () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <rect x={44} y={52} width={112} height={9} rx={3} fill={INK} opacity={0.5} />
      <rect x={44} y={58} width={9} height={88} fill={INK} opacity={0.5} />
      <rect x={147} y={58} width={9} height={88} fill={INK} opacity={0.5} />
      <rect x={52} y={78} width={96} height={8} rx={4} fill={DENIM} />
      <rect x={87} y={72} width={28} height={21} rx={4} fill={MUSTARD} />
      <path d="M 95 93 L 107 93 L 101 105 Z" fill={INK} opacity={0.6} />
      <rect x={56} y={134} width={88} height={11} rx={3} fill={DENIM_LIGHT} />
      <rect x={78} y={106} width={44} height={28} fill={SAGE} />
      <line x1={88} y1={106} x2={88} y2={134} stroke={OLIVE} strokeWidth={3} />
      <line x1={100} y1={106} x2={100} y2={134} stroke={OLIVE} strokeWidth={3} />
      <line x1={112} y1={106} x2={112} y2={134} stroke={OLIVE} strokeWidth={3} />
      <line x1={78} y1={115} x2={122} y2={115} stroke={OLIVE} strokeWidth={3} />
      <line x1={78} y1={125} x2={122} y2={125} stroke={OLIVE} strokeWidth={3} />
      <line x1={101} y1={105} x2={101} y2={112} stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
    </>
  ),

  // Monitor showing a wireframe cube with dimension lines.
  cad: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />
      <rect x={92} y={128} width={16} height={16} fill={INK} opacity={0.5} />
      <rect x={72} y={141} width={56} height={9} rx={4} fill={INK} opacity={0.55} />
      <rect x={34} y={52} width={132} height={80} rx={7} fill={DENIM} />
      <rect x={42} y={60} width={116} height={64} rx={3} fill={CREAM} />
      <path
        d="M 66 80 L 114 80 L 114 116 L 66 116 Z"
        fill="none"
        stroke={DENIM}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path
        d="M 84 66 L 132 66 L 132 102 L 84 102 Z"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <line x1={66} y1={80} x2={84} y2={66} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={114} y1={80} x2={132} y2={66} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={114} y1={116} x2={132} y2={102} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={66} y1={116} x2={84} y2={102} stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={66} y1={120} x2={114} y2={120} stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <line x1={66} y1={116} x2={66} y2={122} stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <line x1={114} y1={116} x2={114} y2={122} stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <line x1={56} y1={80} x2={56} y2={116} stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Laser head burning a cut pattern out of a flat sheet.
  "laser-cutting": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={36} y={56} width={128} height={10} rx={4} fill={INK} opacity={0.5} />
      <rect x={36} y={118} width={128} height={28} rx={3} fill={PAPER_DARK} />
      <circle cx={60} cy={132} r={9} fill={CREAM} />
      <rect x={76} y={124} width={17} height={17} rx={3} fill={CREAM} />
      <rect x={128} y={124} width={16} height={16} rx={3} fill={CREAM} transform="rotate(45 136 132)" />
      <rect x={84} y={64} width={36} height={26} rx={5} fill={DENIM} />
      <path d="M 95 90 L 109 90 L 102 100 Z" fill={DENIM_LIGHT} />
      <line x1={102} y1={100} x2={102} y2={128} stroke={RUST} strokeWidth={4} strokeLinecap="round" />
      <circle cx={102} cy={131} r={7} fill={MUSTARD} />
      <line x1={112} y1={120} x2={120} y2={114} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={92} y1={120} x2={84} y2={114} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Gantry mill running a cutter into a block.
  cnc: () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={34} y={126} width={132} height={20} rx={4} fill={INK} opacity={0.5} />
      <rect x={38} y={56} width={13} height={70} fill={DENIM} />
      <rect x={149} y={56} width={13} height={70} fill={DENIM} />
      <rect x={38} y={56} width={124} height={15} rx={4} fill={DENIM} />
      <rect x={70} y={98} width={60} height={28} rx={3} fill={MUSTARD_LIGHT} />
      <rect x={88} y={98} width={20} height={11} fill={PAPER_DARK} />
      <rect x={86} y={71} width={24} height={26} rx={3} fill={DENIM_LIGHT} />
      <line x1={98} y1={97} x2={98} y2={106} stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.6} />
      <circle cx={78} cy={92} r={4} fill={MUSTARD} />
      <circle cx={120} cy={88} r={3} fill={MUSTARD} />
      <circle cx={112} cy={96} r={3} fill={MUSTARD} />
    </>
  ),

  // Breadboard with a resistor and jumper wires arcing over it.
  electronics: () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <path d="M 46 116 Q 58 68 100 78" fill="none" stroke={BLUSH} strokeWidth={4} strokeLinecap="round" />
      <path d="M 152 116 Q 140 62 106 74" fill="none" stroke={OLIVE} strokeWidth={4} strokeLinecap="round" />
      <path d="M 118 116 Q 138 94 156 116" fill="none" stroke={DENIM} strokeWidth={4} strokeLinecap="round" />
      <rect x={34} y={110} width={132} height={38} rx={5} fill={CREAM} />
      <rect x={34} y={126} width={132} height={7} fill={PAPER_DARK} />
      <circle cx={46} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={62} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={78} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={94} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={110} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={126} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={142} cy={118} r={2} fill={INK} opacity={0.3} />
      <circle cx={54} cy={141} r={2} fill={INK} opacity={0.3} />
      <circle cx={70} cy={141} r={2} fill={INK} opacity={0.3} />
      <circle cx={86} cy={141} r={2} fill={INK} opacity={0.3} />
      <circle cx={102} cy={141} r={2} fill={INK} opacity={0.3} />
      <circle cx={118} cy={141} r={2} fill={INK} opacity={0.3} />
      <circle cx={134} cy={141} r={2} fill={INK} opacity={0.3} />
      <line x1={64} y1={100} x2={64} y2={116} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <line x1={96} y1={100} x2={96} y2={116} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <rect x={62} y={90} width={36} height={14} rx={7} fill={MUSTARD_LIGHT} />
      <line x1={72} y1={90} x2={72} y2={104} stroke={RUST} strokeWidth={3} />
      <line x1={80} y1={90} x2={80} y2={104} stroke={DENIM} strokeWidth={3} />
      <line x1={88} y1={90} x2={88} y2={104} stroke={OLIVE} strokeWidth={3} />
    </>
  ),

  // Microcontroller board, header pins, a lit LED and a USB lead.
  arduino: () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <path d="M 38 110 Q 32 68 74 58" fill="none" stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <rect x={70} y={50} width={22} height={12} rx={3} fill={INK} opacity={0.5} transform="rotate(-14 81 56)" />
      <rect x={30} y={100} width={20} height={20} rx={3} fill={INK} opacity={0.45} />
      <rect x={30} y={124} width={17} height={16} rx={3} fill={INK} opacity={0.55} />
      <rect x={42} y={86} width={116} height={60} rx={6} fill={OLIVE} />
      <rect x={52} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={64} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={76} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={88} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={100} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={112} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={124} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={136} y={88} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={58} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={70} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={82} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={94} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={106} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={118} y={135} width={8} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={84} y={106} width={36} height={20} rx={3} fill={INK} opacity={0.6} />
      <rect x={56} y={106} width={14} height={14} rx={4} fill={BLUSH} />
      <circle cx={140} cy={112} r={8} fill={MUSTARD} />
      <line x1={140} y1={98} x2={140} y2={92} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={152} y1={104} x2={158} y2={100} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
      <line x1={128} y1={104} x2={122} y2={100} stroke={MUSTARD_LIGHT} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Small single-board computer: USB stack, GPIO header, ribbon cable.
  "raspberry-pi": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />
      <path d="M 62 100 Q 40 66 78 52" fill="none" stroke={BLUSH} strokeWidth={11} strokeLinecap="round" />
      <path d="M 62 100 Q 40 66 78 52" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" />
      <rect x={72} y={46} width={24} height={11} rx={2} fill={INK} opacity={0.5} transform="rotate(-16 84 51)" />
      <rect x={38} y={100} width={124} height={48} rx={5} fill={SAGE} />
      <rect x={52} y={100} width={76} height={9} rx={2} fill={INK} opacity={0.55} />
      <rect x={140} y={104} width={22} height={17} rx={2} fill={INK} opacity={0.5} />
      <rect x={140} y={125} width={22} height={17} rx={2} fill={INK} opacity={0.5} />
      <rect x={76} y={116} width={28} height={22} rx={3} fill={INK} opacity={0.55} />
      <rect x={46} y={116} width={18} height={12} rx={2} fill={DENIM} />
      <rect x={46} y={132} width={22} height={9} rx={2} fill={DENIM_LIGHT} />
      <rect x={34} y={132} width={14} height={10} rx={2} fill={INK} opacity={0.4} />
      <circle cx={116} cy={126} r={4} fill={MUSTARD} />
      <circle cx={116} cy={138} r={4} fill={OLIVE} />
    </>
  ),

  // Wheeled robot with a sensor mast and a grabber arm.
  robotics: () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <circle cx={58} cy={136} r={13} fill={INK} opacity={0.6} />
      <circle cx={58} cy={136} r={5} fill={PAPER_DARK} />
      <circle cx={118} cy={136} r={13} fill={INK} opacity={0.6} />
      <circle cx={118} cy={136} r={5} fill={PAPER_DARK} />
      <line x1={88} y1={96} x2={88} y2={70} stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.55} />
      <circle cx={88} cy={64} r={11} fill={DENIM_LIGHT} />
      <circle cx={88} cy={64} r={4} fill={CREAM} />
      <line x1={88} y1={53} x2={88} y2={50} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.55} />
      <circle cx={88} cy={47} r={4} fill={MUSTARD_LIGHT} />
      <rect x={44} y={96} width={88} height={38} rx={9} fill={MUSTARD} />
      <rect x={54} y={104} width={38} height={21} rx={4} fill={DENIM} />
      <circle cx={64} cy={114} r={4} fill={CREAM} />
      <circle cx={82} cy={114} r={4} fill={CREAM} />
      <line x1={132} y1={106} x2={152} y2={94} stroke={MUSTARD} strokeWidth={7} strokeLinecap="round" />
      <line x1={152} y1={94} x2={162} y2={88} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
      <line x1={152} y1={94} x2={160} y2={100} stroke={RUST} strokeWidth={5} strokeLinecap="round" />
    </>
  ),

  // Quadcopter seen from a slight angle, four rotors turning.
  drones: () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />
      <line x1={94} y1={100} x2={52} y2={80} stroke={DENIM} strokeWidth={7} strokeLinecap="round" />
      <line x1={106} y1={100} x2={148} y2={80} stroke={DENIM} strokeWidth={7} strokeLinecap="round" />
      <line x1={92} y1={112} x2={60} y2={126} stroke={DENIM} strokeWidth={7} strokeLinecap="round" />
      <line x1={108} y1={112} x2={140} y2={126} stroke={DENIM} strokeWidth={7} strokeLinecap="round" />
      <ellipse cx={52} cy={76} rx={20} ry={6} fill={DENIM_LIGHT} />
      <circle cx={52} cy={80} r={7} fill={INK} opacity={0.6} />
      <ellipse cx={148} cy={76} rx={20} ry={6} fill={DENIM_LIGHT} />
      <circle cx={148} cy={80} r={7} fill={INK} opacity={0.6} />
      <ellipse cx={60} cy={122} rx={18} ry={6} fill={DENIM_LIGHT} />
      <circle cx={60} cy={126} r={7} fill={INK} opacity={0.6} />
      <ellipse cx={140} cy={122} rx={18} ry={6} fill={DENIM_LIGHT} />
      <circle cx={140} cy={126} r={7} fill={INK} opacity={0.6} />
      <line x1={100} y1={94} x2={100} y2={64} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <circle cx={100} cy={61} r={5} fill={MUSTARD_LIGHT} />
      <ellipse cx={100} cy={108} rx={26} ry={15} fill={DENIM} />
      <circle cx={100} cy={124} r={9} fill={MUSTARD} />
      <circle cx={100} cy={124} r={4} fill={CREAM} />
      <line x1={84} y1={118} x2={78} y2={146} stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
      <line x1={116} y1={118} x2={122} y2={146} stroke={INK} strokeWidth={5} strokeLinecap="round" opacity={0.5} />
    </>
  ),

  // Model ship on a display stand, with a parts sprue beside it.
  "model-making": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={68} y={137} width={64} height={11} rx={3} fill={RUST} />
      <rect x={93} y={118} width={14} height={22} fill={RUST} />
      <line x1={92} y1={92} x2={92} y2={50} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <line x1={64} y1={60} x2={120} y2={60} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <path d="M 66 60 L 118 60 Q 112 76 118 90 L 66 90 Q 72 76 66 60 Z" fill={CREAM} />
      <path d="M 94 48 L 112 54 L 94 60 Z" fill={BLUSH} />
      <rect x={44} y={92} width={112} height={7} rx={3} fill={MUSTARD_LIGHT} />
      <path d="M 44 98 L 156 98 L 138 120 Q 100 128 62 120 Z" fill={TERRACOTTA} />
      <line x1={56} y1={108} x2={144} y2={108} stroke={RUST} strokeWidth={3} strokeLinecap="round" />
      <line x1={120} y1={144} x2={166} y2={144} stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <circle cx={128} cy={134} r={6} fill={OLIVE} />
      <rect x={142} y={128} width={13} height={11} rx={2} fill={OLIVE} />
      <line x1={128} y1={140} x2={128} y2={144} stroke={OLIVE} strokeWidth={3} />
      <line x1={148} y1={139} x2={148} y2={144} stroke={OLIVE} strokeWidth={3} />
    </>
  ),

  // A single painted figure on a round base, fine brush at its shoulder.
  miniatures: () => (
    <>
      <ellipse cx={100} cy={150} rx={40} ry={7} fill={INK} opacity={0.13} />
      <ellipse cx={84} cy={142} rx={27} ry={9} fill={DENIM} />
      <ellipse cx={84} cy={138} rx={27} ry={9} fill={DENIM_LIGHT} />
      <line x1={112} y1={126} x2={102} y2={54} stroke={INK} strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <path d="M 102 56 L 96 44 L 108 50 Z" fill={SAGE} />
      <rect x={72} y={110} width={10} height={28} rx={4} fill={DENIM} />
      <rect x={87} y={110} width={10} height={28} rx={4} fill={DENIM} />
      <path d="M 84 74 Q 99 78 99 98 L 99 116 L 69 116 L 69 98 Q 69 78 84 74 Z" fill={RUST} />
      <circle cx={84} cy={68} r={12} fill={MUSTARD_LIGHT} />
      <path d="M 72 64 Q 84 50 96 64 Z" fill={OLIVE} />
      <circle cx={68} cy={104} r={13} fill={MUSTARD} />
      <circle cx={68} cy={104} r={4} fill={CREAM} />
      <line x1={158} y1={120} x2={126} y2={94} stroke={DENIM} strokeWidth={6} strokeLinecap="round" />
      <line x1={125} y1={93} x2={119} y2={88} stroke={INK} strokeWidth={7} strokeLinecap="round" opacity={0.45} />
      <line x1={118} y1={87} x2={110} y2={80} stroke={BLUSH} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Pegboard wall of hanging tools above a workbench.
  makerspaces: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={38} y={44} width={124} height={62} rx={4} fill={PAPER_DARK} />
      <circle cx={50} cy={54} r={2} fill={INK} opacity={0.18} />
      <circle cx={68} cy={54} r={2} fill={INK} opacity={0.18} />
      <circle cx={110} cy={54} r={2} fill={INK} opacity={0.18} />
      <circle cx={128} cy={54} r={2} fill={INK} opacity={0.18} />
      <circle cx={146} cy={54} r={2} fill={INK} opacity={0.18} />
      <circle cx={50} cy={80} r={2} fill={INK} opacity={0.18} />
      <circle cx={68} cy={80} r={2} fill={INK} opacity={0.18} />
      <circle cx={112} cy={82} r={2} fill={INK} opacity={0.18} />
      <circle cx={148} cy={80} r={2} fill={INK} opacity={0.18} />
      <rect x={48} y={52} width={22} height={11} rx={3} fill={INK} opacity={0.55} />
      <rect x={55} y={62} width={8} height={32} rx={3} fill={MUSTARD} />
      <rect x={78} y={50} width={15} height={11} rx={3} fill={RUST} />
      <path d="M 82 60 L 82 96 L 106 64 Z" fill={DENIM_LIGHT} />
      <circle cx={132} cy={56} r={9} fill={DENIM} />
      <circle cx={132} cy={56} r={4} fill={PAPER_DARK} />
      <rect x={128} y={60} width={8} height={36} rx={3} fill={DENIM} />
      <rect x={30} y={108} width={140} height={13} rx={3} fill={RUST} />
      <rect x={38} y={121} width={11} height={27} fill={RUST} />
      <rect x={151} y={121} width={11} height={27} fill={RUST} />
      <rect x={62} y={94} width={28} height={14} rx={2} fill={MUSTARD_LIGHT} />
      <rect x={104} y={92} width={18} height={16} rx={3} fill={CREAM} />
      <rect x={104} y={92} width={18} height={5} rx={2} fill={OLIVE} />
    </>
  ),

  // Cardboard mockup being measured with a caliper.
  "product-prototyping": () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />
      <rect x={64} y={56} width={76} height={90} rx={8} fill={MUSTARD_LIGHT} />
      <rect x={126} y={56} width={14} height={90} rx={6} fill={PAPER_DARK} />
      <rect x={64} y={92} width={62} height={9} fill={PAPER_DARK} />
      <rect x={76} y={68} width={40} height={11} rx={4} fill={INK} opacity={0.25} />
      <circle cx={96} cy={120} r={11} fill={INK} opacity={0.2} />
      <line x1={78} y1={136} x2={114} y2={136} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.25} />
      <rect x={44} y={130} width={112} height={9} rx={4} fill={DENIM} />
      <rect x={47} y={106} width={9} height={26} rx={2} fill={DENIM} />
      <rect x={110} y={122} width={30} height={16} rx={3} fill={DENIM_LIGHT} />
      <rect x={117} y={104} width={9} height={22} rx={2} fill={DENIM_LIGHT} />
      <line x1={116} y1={143} x2={116} y2={148} stroke={INK} strokeWidth={3} strokeLinecap="round" opacity={0.4} />
    </>
  ),
};
