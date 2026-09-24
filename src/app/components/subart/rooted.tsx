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
 * Rooted hobbies: growing things and being outdoors.
 * Every entry draws raw SVG children inside the shared 200x200 viewBox,
 * centred on x=100 and resting on the ground line at y=150.
 */
export const rootedArt: Record<string, SubArtDrawing> = {
  // Trowel and hand fork stuck in a mound of soil, seedling between them.
  gardening: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />

      {/* tool blades, half buried */}
      <path d="M 62 132 Q 54 120 58 110 Q 66 120 62 132 Z" fill={DENIM_LIGHT} />
      <path d="M 138 130 L 138 116" stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 146 130 L 146 116" stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 154 130 L 154 116" stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 137 117 L 155 117" stroke={DENIM_LIGHT} strokeWidth={4} strokeLinecap="round" />

      {/* soil */}
      <path d="M 36 148 Q 44 124 100 124 Q 156 124 164 148 Z" fill={RUST} />
      <path
        d="M 52 136 Q 60 130 70 134"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M 126 138 Q 136 132 146 137"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* seedling */}
      <path d="M 100 126 L 100 96" stroke={OLIVE} strokeWidth={5} strokeLinecap="round" />
      <ellipse cx={85} cy={94} rx={13} ry={8} fill={SAGE} transform="rotate(-25 85 94)" />
      <ellipse cx={115} cy={92} rx={13} ry={8} fill={OLIVE} transform="rotate(25 115 92)" />

      {/* handles */}
      <path d="M 60 122 L 50 98" stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <path d="M 49 96 L 44 82" stroke={TERRACOTTA} strokeWidth={9} strokeLinecap="round" />
      <path d="M 146 118 L 152 98" stroke={DENIM} strokeWidth={5} strokeLinecap="round" />
      <path d="M 153 96 L 157 82" stroke={TERRACOTTA} strokeWidth={9} strokeLinecap="round" />
    </>
  ),

  // Big split-leaf plant in a patterned pot on a three-legged stand.
  houseplants: () => (
    <>
      <ellipse cx={100} cy={150} rx={36} ry={7} fill={INK} opacity={0.13} />

      {/* foliage */}
      <path
        d="M 100 96 Q 94 78 80 68"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 100 96 Q 106 76 122 70"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path d="M 100 96 L 100 62" stroke={OLIVE} strokeWidth={4} strokeLinecap="round" />
      <ellipse cx={76} cy={64} rx={18} ry={12} fill={SAGE} transform="rotate(-25 76 64)" />
      <ellipse cx={124} cy={66} rx={18} ry={12} fill={OLIVE} transform="rotate(25 124 66)" />
      <ellipse cx={100} cy={56} rx={17} ry={12} fill={SAGE} />
      <path
        d="M 90 58 L 110 54"
        stroke={INK}
        opacity={0.18}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M 66 68 L 86 60"
        stroke={INK}
        opacity={0.18}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* stand */}
      <path d="M 86 128 L 78 148" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M 114 128 L 122 148" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M 100 128 L 100 146" stroke={INK} strokeWidth={4} strokeLinecap="round" />

      {/* pot */}
      <path
        d="M 76 96 L 82 124 Q 83 130 90 130 L 110 130 Q 117 130 118 124 L 124 96 Z"
        fill={DENIM}
      />
      <path d="M 79 110 L 121 110" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <circle cx={90} cy={120} r={3} fill={MUSTARD_LIGHT} />
      <circle cx={110} cy={120} r={3} fill={MUSTARD_LIGHT} />
      <ellipse cx={100} cy={96} rx={24} ry={7} fill={DENIM_LIGHT} />
    </>
  ),

  // Raised bed with a row of lettuces and a row of carrot tops.
  "vegetable-gardens": () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />

      {/* carrot tops */}
      <path d="M 118 108 L 110 78" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 118 108 L 118 76" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 118 108 L 127 79" stroke={SAGE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 140 108 L 132 80" stroke={SAGE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 140 108 L 140 78" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 140 108 L 149 81" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />

      {/* lettuces */}
      <ellipse cx={50} cy={100} rx={14} ry={9} fill={SAGE} />
      <ellipse cx={42} cy={97} rx={8} ry={6} fill={OLIVE} />
      <ellipse cx={58} cy={96} rx={8} ry={6} fill={OLIVE} />
      <ellipse cx={82} cy={101} rx={14} ry={9} fill={SAGE} />
      <ellipse cx={74} cy={98} rx={8} ry={6} fill={OLIVE} />
      <ellipse cx={90} cy={97} rx={8} ry={6} fill={OLIVE} />

      {/* soil and bed */}
      <path d="M 40 106 L 160 106 L 168 118 L 32 118 Z" fill={RUST} />
      <ellipse cx={118} cy={110} rx={7} ry={3} fill={TERRACOTTA} />
      <ellipse cx={140} cy={110} rx={7} ry={3} fill={TERRACOTTA} />
      <rect x={32} y={116} width={136} height={30} rx={3} fill={MUSTARD_LIGHT} />
      <path d="M 32 131 L 168 131" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <rect x={28} y={112} width={10} height={36} rx={2} fill={MUSTARD} />
      <rect x={162} y={112} width={10} height={36} rx={2} fill={MUSTARD} />
    </>
  ),

  // Wild meadow clump: grasses, coneflowers and a bee.
  "native-plants": () => (
    <>
      <ellipse cx={100} cy={150} rx={48} ry={7} fill={INK} opacity={0.13} />

      {/* grasses */}
      <path
        d="M 70 148 Q 62 110 52 84"
        fill="none"
        stroke={SAGE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 82 148 Q 78 106 70 76"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 92 148 Q 98 108 90 80"
        fill="none"
        stroke={SAGE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 116 148 Q 122 110 132 86"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 128 148 Q 134 112 144 94"
        fill="none"
        stroke={SAGE}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* coneflower stems */}
      <path
        d="M 74 148 Q 70 112 76 98"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 126 148 Q 128 110 124 94"
        fill="none"
        stroke={OLIVE}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path d="M 100 148 L 100 78" stroke={OLIVE} strokeWidth={4} strokeLinecap="round" />

      {/* small heads */}
      <ellipse cx={68} cy={94} rx={8} ry={3.5} fill={BLUSH} transform="rotate(20 68 94)" />
      <ellipse cx={84} cy={94} rx={8} ry={3.5} fill={BLUSH} transform="rotate(-20 84 94)" />
      <circle cx={76} cy={92} r={6} fill={RUST} />
      <ellipse cx={116} cy={90} rx={8} ry={3.5} fill={BLUSH} transform="rotate(20 116 90)" />
      <ellipse cx={132} cy={90} rx={8} ry={3.5} fill={BLUSH} transform="rotate(-20 132 90)" />
      <circle cx={124} cy={88} r={6} fill={RUST} />

      {/* main coneflower */}
      <ellipse cx={86} cy={78} rx={11} ry={4.5} fill={BLUSH} transform="rotate(20 86 78)" />
      <ellipse cx={114} cy={78} rx={11} ry={4.5} fill={BLUSH} transform="rotate(-20 114 78)" />
      <ellipse cx={90} cy={68} rx={10} ry={4} fill={BLUSH} transform="rotate(-28 90 68)" />
      <ellipse cx={110} cy={67} rx={10} ry={4} fill={BLUSH} transform="rotate(28 110 67)" />
      <circle cx={100} cy={73} r={8.5} fill={RUST} />
      <ellipse cx={100} cy={69} rx={7} ry={3} fill={MUSTARD} />

      {/* bee */}
      <ellipse cx={148} cy={74} rx={8} ry={5.5} fill={MUSTARD} />
      <path d="M 146 69 L 146 79" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 151 70 L 151 78" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <ellipse cx={146} cy={66} rx={6} ry={3.5} fill={DENIM_LIGHT} />
    </>
  ),

  // Open compost bin layered with scraps, worm on the ground.
  composting: () => (
    <>
      <ellipse cx={100} cy={150} rx={48} ry={7} fill={INK} opacity={0.13} />

      {/* bin */}
      <path
        d="M 60 88 L 66 144 Q 67 148 74 148 L 126 148 Q 133 148 134 144 L 140 88 Z"
        fill={OLIVE}
      />
      <path d="M 76 96 L 72 142" stroke={SAGE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 100 98 L 100 144" stroke={SAGE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 124 96 L 128 142" stroke={SAGE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={100} cy={88} rx={40} ry={10} fill={OLIVE} />
      <ellipse cx={100} cy={88} rx={33} ry={7.5} fill={RUST} />

      {/* scraps */}
      <ellipse cx={86} cy={84} rx={9} ry={5} fill={SAGE} />
      <ellipse cx={102} cy={87} rx={7} ry={3.5} fill={TERRACOTTA} />
      <path
        d="M 106 86 Q 114 74 124 84"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={5}
        strokeLinecap="round"
      />

      {/* worm and fallen leaves */}
      <path
        d="M 38 146 Q 46 137 54 146 Q 60 152 68 145"
        fill="none"
        stroke={BLUSH}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <ellipse cx={154} cy={145} rx={9} ry={4} fill={SAGE} transform="rotate(-18 154 145)" />
      <ellipse cx={166} cy={147} rx={7} ry={3} fill={MUSTARD} transform="rotate(14 166 147)" />
    </>
  ),

  // Shelf unit with a grow-light bar over two trays of seedlings.
  "indoor-growing": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />

      {/* frame */}
      <rect x={38} y={54} width={7} height={94} fill={INK} />
      <rect x={155} y={54} width={7} height={94} fill={INK} />

      {/* light bar */}
      <rect x={46} y={60} width={108} height={13} rx={5} fill={DENIM} />
      <path d="M 66 78 L 62 104" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 86 78 L 84 104" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 114 78 L 116 104" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />
      <path d="M 134 78 L 138 104" stroke={MUSTARD_LIGHT} strokeWidth={4} strokeLinecap="round" />

      {/* seedlings */}
      <path d="M 60 114 L 60 102" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={55} cy={100} rx={5} ry={3} fill={SAGE} />
      <ellipse cx={65} cy={99} rx={5} ry={3} fill={SAGE} />
      <path d="M 72 114 L 72 104" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={67} cy={102} rx={5} ry={3} fill={OLIVE} />
      <ellipse cx={77} cy={101} rx={5} ry={3} fill={OLIVE} />
      <path d="M 84 114 L 84 102" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={79} cy={100} rx={5} ry={3} fill={SAGE} />
      <ellipse cx={89} cy={99} rx={5} ry={3} fill={SAGE} />
      <path d="M 116 114 L 116 103" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={111} cy={101} rx={5} ry={3} fill={OLIVE} />
      <ellipse cx={121} cy={100} rx={5} ry={3} fill={OLIVE} />
      <path d="M 128 114 L 128 101" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={123} cy={99} rx={5} ry={3} fill={SAGE} />
      <ellipse cx={133} cy={98} rx={5} ry={3} fill={SAGE} />
      <path d="M 140 114 L 140 104" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={135} cy={102} rx={5} ry={3} fill={OLIVE} />
      <ellipse cx={145} cy={101} rx={5} ry={3} fill={OLIVE} />

      {/* trays and shelves */}
      <rect x={50} y={112} width={44} height={14} rx={3} fill={TERRACOTTA} />
      <rect x={106} y={112} width={44} height={14} rx={3} fill={TERRACOTTA} />
      <rect x={34} y={126} width={132} height={9} rx={2} fill={PAPER_DARK} />
      <rect x={34} y={140} width={132} height={8} rx={2} fill={PAPER_DARK} />
    </>
  ),

  // Binoculars with a small bird perched on a branch above.
  birdwatching: () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />

      {/* branch and bird */}
      <path
        d="M 110 80 Q 138 72 166 80"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <ellipse cx={156} cy={74} rx={9} ry={4} fill={SAGE} transform="rotate(-18 156 74)" />
      <path d="M 128 62 L 118 58 L 130 68 Z" fill={MUSTARD_LIGHT} />
      <ellipse cx={142} cy={62} rx={13} ry={10} fill={MUSTARD} />
      <ellipse cx={139} cy={63} rx={7} ry={4} fill={RUST} transform="rotate(-15 139 63)" />
      <circle cx={153} cy={54} r={7} fill={MUSTARD} />
      <path d="M 159 53 L 166 55 L 159 58 Z" fill={RUST} />
      <circle cx={155} cy={52} r={1.8} fill={INK} />
      <path d="M 150 62 L 150 72" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />

      {/* binoculars */}
      <path
        d="M 62 104 Q 42 118 48 146"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <rect x={64} y={90} width={18} height={10} rx={5} fill={INK} />
      <rect x={94} y={90} width={18} height={10} rx={5} fill={INK} />
      <rect x={62} y={98} width={22} height={48} rx={9} fill={DENIM} />
      <rect x={92} y={98} width={22} height={48} rx={9} fill={DENIM} />
      <rect x={82} y={106} width={12} height={18} fill={DENIM_LIGHT} />
      <circle cx={88} cy={104} r={6} fill={DENIM_LIGHT} />
      <ellipse cx={73} cy={146} rx={11} ry={4} fill={DENIM_LIGHT} />
      <ellipse cx={103} cy={146} rx={11} ry={4} fill={DENIM_LIGHT} />
    </>
  ),

  // Woven basket of mushrooms and berries beside a field guide.
  foraging: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />

      {/* contents, sitting down in the basket */}
      <rect x={88} y={92} width={7} height={16} rx={3.5} fill={CREAM} />
      <path d="M 80 96 Q 80 83 92 83 Q 104 83 104 96 Z" fill={TERRACOTTA} />
      <circle cx={86} cy={92} r={2.2} fill={CREAM} />
      <circle cx={96} cy={90} r={2} fill={CREAM} />
      <rect x={110} y={98} width={6} height={12} rx={3} fill={CREAM} />
      <path d="M 104 100 Q 104 91 113 91 Q 122 91 122 100 Z" fill={RUST} />
      <circle cx={126} cy={100} r={4.5} fill={BLUSH} />
      <circle cx={133} cy={97} r={4} fill={BLUSH} />
      <circle cx={129} cy={92} r={3.5} fill={BLUSH} />

      {/* basket */}
      <path
        d="M 66 106 L 74 142 Q 75 148 84 148 L 128 148 Q 137 148 138 142 L 146 106 Z"
        fill={MUSTARD_LIGHT}
      />
      <path d="M 88 110 L 84 146" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <path d="M 106 110 L 106 148" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <path d="M 124 110 L 128 146" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <path
        d="M 69 120 Q 106 127 143 120"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d="M 72 134 Q 106 141 140 134"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <ellipse cx={106} cy={106} rx={40} ry={9} fill={MUSTARD} />
      <path
        d="M 70 104 Q 106 64 142 104"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={6}
        strokeLinecap="round"
      />

      {/* field guide */}
      <rect
        x={28}
        y={112}
        width={26}
        height={36}
        rx={2}
        fill={DENIM}
        transform="rotate(-8 41 130)"
      />
      <rect
        x={33}
        y={120}
        width={16}
        height={13}
        rx={2}
        fill={SAGE}
        transform="rotate(-8 41 130)"
      />
      <rect
        x={53}
        y={114}
        width={5}
        height={33}
        fill={CREAM}
        transform="rotate(-8 41 130)"
      />

      {/* stray finds */}
      <ellipse cx={158} cy={144} rx={9} ry={4} fill={OLIVE} transform="rotate(-16 158 144)" />
      <circle cx={169} cy={143} r={4} fill={BLUSH} />
    </>
  ),

  // Ridge tent pitched next to a campfire.
  camping: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />

      {/* tent */}
      <path d="M 82 64 L 124 148 L 40 148 Z" fill={DENIM} />
      <path d="M 82 80 L 102 148 L 62 148 Z" fill={DENIM_LIGHT} />
      <path d="M 82 92 L 95 148 L 69 148 Z" fill={INK} opacity={0.4} />
      <path d="M 124 148 L 138 148" stroke={INK} strokeWidth={3} strokeLinecap="round" />

      {/* campfire */}
      <path d="M 140 138 Q 136 118 148 102 Q 162 118 156 138 Z" fill={MUSTARD} />
      <path d="M 145 138 Q 143 122 149 112 Q 156 124 152 138 Z" fill={MUSTARD_LIGHT} />
      <path d="M 134 146 L 160 138" stroke={TERRACOTTA} strokeWidth={7} strokeLinecap="round" />
      <path d="M 134 138 L 160 146" stroke={RUST} strokeWidth={7} strokeLinecap="round" />
    </>
  ),

  // Rod and line over the water, float bobbing and a fish below.
  fishing: () => (
    <>
      <ellipse cx={100} cy={150} rx={48} ry={7} fill={INK} opacity={0.13} />

      {/* rod */}
      <path d="M 44 146 L 130 60" stroke={TERRACOTTA} strokeWidth={5} strokeLinecap="round" />
      <path d="M 44 146 L 58 132" stroke={RUST} strokeWidth={10} strokeLinecap="round" />
      <circle cx={64} cy={128} r={8} fill={DENIM} />
      <path
        d="M 130 60 Q 146 82 142 104"
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
      />

      {/* water */}
      <ellipse cx={102} cy={132} rx={60} ry={12} fill={DENIM_LIGHT} />
      <path
        d="M 58 128 Q 68 123 78 128"
        fill="none"
        stroke={DENIM}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path
        d="M 122 140 Q 132 135 142 140"
        fill="none"
        stroke={DENIM}
        strokeWidth={3}
        strokeLinecap="round"
      />

      {/* fish */}
      <path d="M 130 136 L 146 128 L 146 144 Z" fill={MUSTARD_LIGHT} />
      <ellipse cx={116} cy={136} rx={17} ry={9} fill={MUSTARD} />
      <path d="M 112 128 L 120 121 L 125 129 Z" fill={RUST} />
      <circle cx={104} cy={134} r={2} fill={INK} />

      {/* float */}
      <path d="M 142 106 L 142 100" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <circle cx={142} cy={113} r={7} fill={RUST} />
      <ellipse cx={142} cy={118} rx={6} ry={3} fill={CREAM} />
    </>
  ),

  // Camera on a tripod aimed at a distant hillside.
  "outdoor-photography": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />

      {/* distant view */}
      <circle cx={146} cy={78} r={12} fill={MUSTARD_LIGHT} />
      <path d="M 112 128 Q 138 86 168 128 Z" fill={SAGE} />
      <path d="M 98 128 Q 116 100 136 128 Z" fill={OLIVE} />
      <path d="M 96 128 L 172 128" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />

      {/* tripod */}
      <path d="M 72 104 L 50 148" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M 72 104 L 94 148" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M 72 104 L 72 144" stroke={INK} strokeWidth={4} strokeLinecap="round" />

      {/* camera */}
      <rect x={62} y={71} width={16} height={10} rx={3} fill={DENIM} />
      <rect x={50} y={80} width={44} height={27} rx={5} fill={DENIM} />
      <rect x={92} y={86} width={15} height={15} rx={3} fill={DENIM_LIGHT} />
      <ellipse cx={108} cy={93} rx={4} ry={7.5} fill={INK} />
      <circle cx={62} cy={90} r={4} fill={CREAM} />
    </>
  ),

  // Open sketchbook with a pressed leaf and a pencil across it.
  "nature-journaling": () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />

      {/* pencil */}
      <rect
        x={112}
        y={84}
        width={46}
        height={9}
        rx={2}
        fill={MUSTARD}
        transform="rotate(-10 135 88)"
      />
      <rect
        x={105}
        y={84}
        width={8}
        height={9}
        fill={DENIM_LIGHT}
        transform="rotate(-10 135 88)"
      />
      <rect
        x={99}
        y={84}
        width={7}
        height={9}
        rx={3}
        fill={BLUSH}
        transform="rotate(-10 135 88)"
      />
      <path
        d="M 158 84 L 171 88.5 L 158 93 Z"
        fill={MUSTARD_LIGHT}
        transform="rotate(-10 135 88)"
      />

      {/* book */}
      <path d="M 30 116 Q 60 100 98 106 L 98 140 Q 60 134 30 148 Z" fill={CREAM} />
      <path d="M 170 116 Q 140 100 102 106 L 102 140 Q 140 134 170 148 Z" fill={CREAM} />
      <rect x={96} y={106} width={8} height={34} rx={2} fill={PAPER_DARK} />
      <path
        d="M 112 118 Q 138 113 160 122"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path
        d="M 112 128 Q 138 123 160 132"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      {/* pressed leaf */}
      <ellipse cx={62} cy={122} rx={18} ry={10} fill={SAGE} transform="rotate(-12 62 122)" />
      <path d="M 47 126 L 78 118" stroke={OLIVE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 78 118 L 85 115" stroke={OLIVE} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),
};
