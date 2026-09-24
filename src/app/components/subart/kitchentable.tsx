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
 * Kitchen-table hobbies: cooking, baking and drink-making.
 * Every entry draws raw SVG children inside the shared 200x200 viewBox,
 * centred on x=100 and resting on the ground line at y=150.
 */
export const kitchentableArt: Record<string, SubArtDrawing> = {
  // Cast-iron skillet over a flame, chopped veg on a board beside it.
  cooking: () => (
    <>
      <ellipse cx={100} cy={150} rx={50} ry={7} fill={INK} opacity={0.13} />

      {/* flame under the pan */}
      <path d="M 80 147 Q 72 132 84 120 Q 90 134 80 147 Z" fill={MUSTARD} />
      <path d="M 96 147 Q 84 128 98 112 Q 112 130 100 147 Z" fill={MUSTARD} />
      <path d="M 112 147 Q 104 132 114 122 Q 120 134 112 147 Z" fill={MUSTARD} />
      <path d="M 96 146 Q 90 130 98 122 Q 106 132 100 146 Z" fill={MUSTARD_LIGHT} />

      {/* skillet */}
      <path
        d="M 64 112 L 68 124 Q 70 131 78 131 L 114 131 Q 122 131 124 124 L 128 112 Z"
        fill={INK}
      />
      <ellipse cx={96} cy={112} rx={33} ry={8.5} fill={INK} />
      <ellipse cx={96} cy={112} rx={25} ry={5.5} fill={PAPER_DARK} />
      <circle cx={88} cy={111} r={5} fill={TERRACOTTA} />
      <circle cx={103} cy={113} r={4} fill={OLIVE} />
      <path d="M 128 108 L 158 100" stroke={INK} strokeWidth={7} strokeLinecap="round" />

      {/* board with chopped veg */}
      <rect x={34} y={142} width={44} height={7} rx={3.5} fill={PAPER_DARK} />
      <rect x={38} y={131} width={12} height={11} rx={3} fill={TERRACOTTA} />
      <rect x={52} y={133} width={11} height={9} rx={3} fill={OLIVE} />
      <rect x={64} y={130} width={11} height={12} rx={3} fill={MUSTARD} />
    </>
  ),

  // Layer cake on a stand with a rolling pin lying in front.
  baking: () => (
    <>
      <ellipse cx={100} cy={150} rx={52} ry={7} fill={INK} opacity={0.13} />

      {/* cake stand */}
      <ellipse cx={108} cy={140} rx={42} ry={8} fill={PAPER_DARK} />
      <rect x={102} y={140} width={12} height={7} fill={PAPER_DARK} />
      <ellipse cx={108} cy={147} rx={20} ry={5} fill={PAPER_DARK} />

      {/* cake */}
      <rect x={78} y={112} width={60} height={26} rx={4} fill={CREAM} />
      <rect x={78} y={105} width={60} height={8} fill={BLUSH} />
      <rect x={78} y={88} width={60} height={18} rx={4} fill={CREAM} />
      <ellipse cx={108} cy={88} rx={30} ry={8} fill={BLUSH} />
      <circle cx={108} cy={79} r={6} fill={RUST} />
      <path d="M 84 124 L 132 124" stroke={PAPER_DARK} strokeWidth={3} strokeLinecap="round" />

      {/* rolling pin */}
      <rect x={26} y={140} width={10} height={8} rx={4} fill={TERRACOTTA} />
      <rect x={34} y={134} width={44} height={15} rx={7.5} fill={MUSTARD_LIGHT} />
      <rect x={77} y={140} width={10} height={8} rx={4} fill={TERRACOTTA} />
    </>
  ),

  // Scored boule resting in a coiled banneton, lame leaning beside it.
  sourdough: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />

      {/* back rim of the banneton */}
      <ellipse cx={100} cy={112} rx={38} ry={9} fill={MUSTARD} />

      {/* boule */}
      <circle cx={100} cy={100} r={33} fill={TERRACOTTA} />
      <path
        d="M 82 94 Q 100 82 118 94"
        fill="none"
        stroke={RUST}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 86 106 Q 100 96 114 106"
        fill="none"
        stroke={RUST}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* basket front */}
      <path d="M 62 112 Q 66 148 100 148 Q 134 148 138 112 Z" fill={PAPER_DARK} />
      <path
        d="M 66 126 Q 100 138 134 126"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      <path
        d="M 70 137 Q 100 147 130 137"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={3.5}
        strokeLinecap="round"
      />

      {/* lame */}
      <path d="M 148 148 L 159 119" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M 156 118 L 166 106 L 171 114 L 161 124 Z" fill={DENIM_LIGHT} />
    </>
  ),

  // Weighted mason jar of cabbage, bubbling under an airlock lid.
  fermentation: () => (
    <>
      <ellipse cx={100} cy={150} rx={34} ry={7} fill={INK} opacity={0.13} />

      {/* jar */}
      <rect x={70} y={78} width={60} height={70} rx={10} fill={CREAM} />
      <rect x={74} y={100} width={52} height={44} rx={6} fill={SAGE} />
      <path d="M 80 113 L 96 108" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 104 121 L 120 116" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <path d="M 82 131 L 100 126" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={100} cy={102} rx={19} ry={5} fill={PAPER_DARK} />
      <circle cx={84} cy={122} r={3.5} fill={CREAM} />
      <circle cx={112} cy={134} r={3} fill={CREAM} />
      <circle cx={96} cy={140} r={2.5} fill={CREAM} />

      {/* neck, lid, airlock */}
      <rect x={82} y={70} width={36} height={12} fill={CREAM} />
      <rect x={76} y={60} width={48} height={12} rx={4} fill={DENIM} />
      <rect x={95} y={50} width={10} height={14} rx={5} fill={DENIM_LIGHT} />
      <circle cx={100} cy={50} r={6} fill={DENIM} />
    </>
  ),

  // Pour-over cone on a glass carafe, gooseneck kettle pouring in.
  "home-coffee": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />

      {/* carafe */}
      <path
        d="M 90 106 L 89 136 Q 89 148 102 148 L 122 148 Q 135 148 135 136 L 134 106 Z"
        fill={CREAM}
      />
      <path
        d="M 90 126 L 89.5 137 Q 89.5 147 102 147 L 122 147 Q 134.5 147 134.5 137 L 134 126 Z"
        fill={RUST}
      />
      <ellipse cx={112} cy={106} rx={22} ry={5} fill={PAPER_DARK} />

      {/* dripper cone */}
      <path d="M 86 82 L 138 82 L 120 108 L 104 108 Z" fill={TERRACOTTA} />
      <ellipse cx={112} cy={82} rx={26} ry={6} fill={RUST} />

      {/* gooseneck kettle */}
      <rect x={30} y={112} width={34} height={36} rx={12} fill={DENIM} />
      <path
        d="M 32 111 Q 47 92 62 111"
        fill="none"
        stroke={DENIM}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <rect x={38} y={104} width={18} height={9} rx={4} fill={DENIM_LIGHT} />
      <path
        d="M 62 120 Q 76 118 74 100 Q 73 88 84 84"
        fill="none"
        stroke={DENIM}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path d="M 86 86 L 94 96" stroke={DENIM_LIGHT} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Teapot pouring into a small cup, loose leaves on the table.
  tea: () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />

      {/* teapot */}
      <path
        d="M 52 116 Q 52 146 74 148 L 98 148 Q 120 146 120 116 Q 120 92 86 92 Q 52 92 52 116 Z"
        fill={OLIVE}
      />
      <path
        d="M 54 104 Q 36 108 42 126"
        fill="none"
        stroke={OLIVE}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 118 108 Q 136 106 140 92"
        fill="none"
        stroke={OLIVE}
        strokeWidth={8}
        strokeLinecap="round"
      />
      <ellipse cx={86} cy={92} rx={21} ry={6} fill={SAGE} />
      <circle cx={86} cy={85} r={5} fill={SAGE} />

      {/* pour */}
      <path
        d="M 141 95 Q 145 112 148 126"
        fill="none"
        stroke={MUSTARD_LIGHT}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* cup */}
      <path
        d="M 134 126 L 137 142 Q 138 148 146 148 L 156 148 Q 164 148 165 142 L 168 126 Z"
        fill={CREAM}
      />
      <ellipse cx={151} cy={126} rx={17} ry={4} fill={MUSTARD} />

      {/* loose leaves */}
      <ellipse cx={36} cy={145} rx={8} ry={3.5} fill={SAGE} transform="rotate(-22 36 145)" />
      <ellipse cx={50} cy={148} rx={7} ry={3} fill={OLIVE} transform="rotate(16 50 148)" />
    </>
  ),

  // Group head pulling a double shot into two demitasse cups.
  espresso: () => (
    <>
      <ellipse cx={100} cy={150} rx={46} ry={7} fill={INK} opacity={0.13} />

      {/* machine head */}
      <rect x={52} y={46} width={96} height={20} rx={6} fill={DENIM} />
      <circle cx={66} cy={56} r={8} fill={CREAM} />
      <path d="M 66 56 L 71 51" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      <rect x={86} y={62} width={30} height={32} rx={4} fill={DENIM_LIGHT} />
      <rect x={78} y={92} width={46} height={14} rx={5} fill={DENIM} />

      {/* portafilter */}
      <rect x={88} y={106} width={26} height={9} rx={3} fill={INK} />
      <rect x={112} y={106} width={34} height={8} rx={4} fill={INK} />
      <circle cx={146} cy={110} r={5} fill={INK} />
      <path d="M 98 115 L 98 120" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M 118 115 L 118 120" stroke={INK} strokeWidth={3} strokeLinecap="round" />

      {/* shots */}
      <path d="M 98 120 L 98 131" stroke={RUST} strokeWidth={3} strokeLinecap="round" />
      <path d="M 118 120 L 118 131" stroke={RUST} strokeWidth={3} strokeLinecap="round" />

      {/* drip tray and cups */}
      <rect x={78} y={142} width={72} height={8} rx={3} fill={DENIM_LIGHT} />
      <path
        d="M 88 132 L 90 143 Q 91 148 96 148 L 100 148 Q 105 148 106 143 L 108 132 Z"
        fill={CREAM}
      />
      <ellipse cx={98} cy={132} rx={10} ry={3} fill={RUST} />
      <path
        d="M 108 132 L 110 143 Q 111 148 116 148 L 120 148 Q 125 148 126 143 L 128 132 Z"
        fill={CREAM}
      />
      <ellipse cx={118} cy={132} rx={10} ry={3} fill={RUST} />
    </>
  ),

  // A plated dish with a camera overhead and a lamp raking across it.
  "food-photography": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />

      {/* plated dish */}
      <ellipse cx={92} cy={140} rx={40} ry={13} fill={CREAM} />
      <ellipse cx={92} cy={140} rx={29} ry={9} fill={PAPER_DARK} />
      <circle cx={83} cy={139} r={8} fill={TERRACOTTA} />
      <circle cx={100} cy={143} r={6} fill={OLIVE} />
      <circle cx={95} cy={134} r={5} fill={MUSTARD} />

      {/* camera looking down */}
      <rect x={90} y={54} width={16} height={9} rx={3} fill={INK} />
      <rect x={72} y={62} width={48} height={30} rx={6} fill={INK} />
      <rect x={86} y={88} width={20} height={10} fill={INK} />
      <circle cx={96} cy={102} r={11} fill={DENIM} />
      <circle cx={96} cy={102} r={5} fill={DENIM_LIGHT} />

      {/* lamp */}
      <path d="M 158 148 L 158 100" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <circle cx={158} cy={87} r={13} fill={MUSTARD_LIGHT} />
      <path d="M 146 96 L 136 107" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
      <path d="M 151 103 L 143 113" stroke={MUSTARD} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Demijohn of amber wort under an airlock, hop cones alongside.
  "home-brewing": () => (
    <>
      <ellipse cx={100} cy={150} rx={44} ry={7} fill={INK} opacity={0.13} />

      {/* carboy */}
      <path
        d="M 84 82 L 84 98 Q 60 108 60 126 Q 60 148 100 148 Q 140 148 140 126 Q 140 108 116 98 L 116 82 Z"
        fill={MUSTARD_LIGHT}
      />
      <path d="M 61 120 Q 62 148 100 148 Q 138 148 139 120 Z" fill={MUSTARD} />
      <ellipse cx={100} cy={121} rx={38} ry={5} fill={CREAM} />

      {/* bung and airlock */}
      <rect x={82} y={72} width={36} height={11} rx={3} fill={TERRACOTTA} />
      <rect x={95} y={58} width={10} height={16} rx={5} fill={DENIM_LIGHT} />
      <circle cx={100} cy={56} r={9} fill={DENIM_LIGHT} />
      <rect x={94} y={45} width={12} height={9} rx={3} fill={DENIM} />

      {/* hops */}
      <path d="M 44 122 L 44 114" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={44} cy={132} rx={9} ry={12} fill={SAGE} />
      <path d="M 36 128 L 52 128" stroke={OLIVE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 37 136 L 51 136" stroke={OLIVE} strokeWidth={2.5} strokeLinecap="round" />
      <ellipse cx={156} cy={138} rx={8} ry={10} fill={OLIVE} />
      <path d="M 149 136 L 163 136" stroke={SAGE} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 156 128 L 156 121" stroke={OLIVE} strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  // Cloth-covered brewing jar with a floating SCOBY, swing-top bottle beside.
  kombucha: () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />

      {/* jar */}
      <rect x={56} y={70} width={52} height={78} rx={8} fill={CREAM} />
      <rect x={59} y={92} width={46} height={54} rx={6} fill={TERRACOTTA} />
      <ellipse cx={82} cy={95} rx={21} ry={6} fill={CREAM} />
      <circle cx={68} cy={120} r={2.5} fill={CREAM} />
      <circle cx={96} cy={132} r={3} fill={CREAM} />
      <circle cx={78} cy={140} r={2.5} fill={CREAM} />

      {/* cloth cover */}
      <path d="M 50 70 L 52 82 Q 66 89 82 89 Q 98 89 112 82 L 114 70 Z" fill={BLUSH} />
      <ellipse cx={82} cy={70} rx={32} ry={9} fill={BLUSH} />
      <path
        d="M 53 77 Q 82 88 111 77"
        fill="none"
        stroke={RUST}
        strokeWidth={3.5}
        strokeLinecap="round"
      />

      {/* swing-top bottle */}
      <path
        d="M 128 110 L 128 142 Q 128 148 136 148 L 148 148 Q 156 148 156 142 L 156 110 Q 156 101 148 97 L 148 80 L 136 80 L 136 97 Q 128 101 128 110 Z"
        fill={OLIVE}
      />
      <rect x={134} y={71} width={16} height={10} rx={3} fill={DENIM} />
      <path d="M 135 80 L 132 93" stroke={DENIM} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M 149 80 L 152 93" stroke={DENIM} strokeWidth={2.5} strokeLinecap="round" />
    </>
  ),

  // Cobbler shaker, coupe glass and a curl of citrus peel.
  "cocktail-making": () => (
    <>
      <ellipse cx={100} cy={150} rx={54} ry={7} fill={INK} opacity={0.13} />

      {/* shaker */}
      <path
        d="M 55 100 L 57 140 Q 57 148 67 148 L 85 148 Q 95 148 95 140 L 97 100 Z"
        fill={DENIM_LIGHT}
      />
      <path d="M 59 100 L 63 84 L 89 84 L 93 100 Z" fill={DENIM} />
      <rect x={67} y={72} width={18} height={12} rx={4} fill={DENIM} />
      <rect x={71} y={65} width={10} height={8} rx={3} fill={DENIM_LIGHT} />

      {/* coupe */}
      <path d="M 107 96 Q 107 122 132 122 Q 157 122 157 96 Z" fill={CREAM} />
      <path d="M 109 102 Q 113 118 132 118 Q 151 118 155 102 Z" fill={BLUSH} />
      <rect x={129} y={121} width={6} height={21} fill={CREAM} />
      <ellipse cx={132} cy={144} rx={18} ry={5} fill={CREAM} />

      {/* citrus twist */}
      <path
        d="M 143 94 Q 156 84 148 76 Q 140 70 133 78"
        fill="none"
        stroke={MUSTARD}
        strokeWidth={5}
        strokeLinecap="round"
      />
    </>
  ),

  // A long table laid with plates and a lit candle.
  "supper-clubs": () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />

      {/* candle standing on the table */}
      <path d="M 100 68 Q 106 76 100 81 Q 94 76 100 68 Z" fill={MUSTARD} />
      <rect x={96} y={80} width={8} height={30} fill={CREAM} />
      <ellipse cx={100} cy={111} rx={10} ry={4} fill={DENIM} />

      {/* table */}
      <path d="M 34 112 L 166 112 L 172 124 L 28 124 Z" fill={PAPER_DARK} />
      <rect x={28} y={124} width={144} height={8} fill={TERRACOTTA} />
      <rect x={38} y={132} width={10} height={16} fill={TERRACOTTA} />
      <rect x={152} y={132} width={10} height={16} fill={TERRACOTTA} />

      {/* place settings */}
      <ellipse cx={56} cy={120} rx={15} ry={5} fill={CREAM} />
      <ellipse cx={56} cy={120} rx={8} ry={2.5} fill={OLIVE} />
      <ellipse cx={100} cy={121} rx={15} ry={5} fill={CREAM} />
      <ellipse cx={100} cy={121} rx={8} ry={2.5} fill={BLUSH} />
      <ellipse cx={144} cy={120} rx={15} ry={5} fill={CREAM} />
      <ellipse cx={144} cy={120} rx={8} ry={2.5} fill={MUSTARD} />
    </>
  ),
};
