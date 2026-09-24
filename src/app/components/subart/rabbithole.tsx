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
 * "Rabbit Hole" hobby tiles — collecting, playing, poring over things.
 * Every entry draws raw SVG children into the shared 200x200 viewBox, centred
 * on x=100 and resting on the ground line at y=150.
 *
 * All objects here are deliberately generic: no logos, wordmarks, mascots,
 * cover art or recognisable product designs of any kind.
 */
export const rabbitholeArt: Record<string, SubArtDrawing> = {
  // A folded board standing open, with meeples and a pair of dice.
  "board-games": () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <path d="M 40 132 L 100 108 L 100 60 L 40 84 Z" fill={DENIM} />
      <path d="M 160 132 L 100 108 L 100 60 L 160 84 Z" fill={DENIM_LIGHT} />
      <path d="M 52 96 L 70 89 L 70 105 L 52 112 Z" fill={CREAM} />
      <path d="M 82 84 L 100 77 L 100 93 L 82 100 Z" fill={CREAM} />
      <path d="M 118 89 L 136 96 L 136 112 L 118 105 Z" fill={CREAM} />
      <path d="M 66 148 L 66 138 Q 66 132 72 130 L 78 130 Q 84 132 84 148 Z" fill={MUSTARD} />
      <circle cx={75} cy={126} r={7} fill={MUSTARD} />
      <path d="M 90 148 L 90 140 Q 90 134 96 132 L 100 132 Q 106 134 106 148 Z" fill={TERRACOTTA} />
      <circle cx={98} cy={128} r={6} fill={TERRACOTTA} />
      <rect x={118} y={126} width={22} height={22} rx={5} fill={CREAM} />
      <circle cx={125} cy={133} r={2.5} fill={INK} />
      <circle cx={133} cy={141} r={2.5} fill={INK} />
      <rect x={144} y={132} width={18} height={16} rx={4} fill={PAPER_DARK} />
      <circle cx={153} cy={140} r={2.5} fill={INK} />
    </>
  ),

  // A board corner with a knight and a pawn.
  chess: () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <rect x={36} y={124} width={128} height={24} rx={3} fill={CREAM} />
      <rect x={36} y={124} width={32} height={12} fill={INK} />
      <rect x={100} y={124} width={32} height={12} fill={INK} />
      <rect x={68} y={136} width={32} height={12} fill={INK} />
      <rect x={132} y={136} width={32} height={12} fill={INK} />
      <rect x={62} y={114} width={40} height={12} rx={4} fill={INK} />
      <path
        d="M 74 114 Q 68 88 84 74 Q 92 64 106 60 L 100 76 L 112 80 Q 116 100 106 114 Z"
        fill={INK}
      />
      <circle cx={98} cy={80} r={3} fill={CREAM} />
      <path
        d="M 88 70 L 96 66"
        fill="none"
        stroke={CREAM}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <rect x={124} y={114} width={34} height={11} rx={4} fill={CREAM} />
      <path d="M 132 114 Q 138 100 138 94 L 148 94 Q 148 100 152 114 Z" fill={CREAM} />
      <rect x={130} y={86} width={24} height={9} rx={4} fill={CREAM} />
      <circle cx={142} cy={74} r={11} fill={CREAM} />
    </>
  ),

  // A big d20 beside a character sheet and a couple of small dice.
  "tabletop-rpgs": () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <rect x={30} y={50} width={68} height={94} rx={4} fill={CREAM} />
      <path d="M 44 62 L 62 62 L 62 78 Q 53 86 44 78 Z" fill={MUSTARD} />
      <path
        d="M 70 66 L 88 66"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <path
        d="M 70 76 L 86 76"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <path
        d="M 40 98 L 88 98"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <path
        d="M 40 110 L 76 110"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <path
        d="M 40 122 L 84 122"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <path d="M 132 58 L 164 76 L 164 112 L 132 130 L 100 112 L 100 76 Z" fill={DENIM} />
      <path d="M 132 72 L 152 106 L 112 106 Z" fill={DENIM_LIGHT} />
      <path d="M 132 58 L 164 76 L 132 72 Z" fill={SAGE} />
      <path d="M 100 76 L 132 72 L 112 106 Z" fill={DENIM_LIGHT} />
      <rect x={100} y={128} width={20} height={20} rx={4} fill={CREAM} />
      <circle cx={110} cy={138} r={3} fill={INK} />
      <path d="M 132 134 L 146 148 L 118 148 Z" fill={MUSTARD} />
    </>
  ),

  // A binder plus a fanned hand of blank sleeved cards.
  "trading-cards": () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <rect x={28} y={58} width={66} height={88} rx={5} fill={RUST} />
      <rect x={42} y={64} width={46} height={76} rx={3} fill={CREAM} />
      <circle cx={38} cy={80} r={5} fill={CREAM} />
      <circle cx={38} cy={102} r={5} fill={CREAM} />
      <circle cx={38} cy={124} r={5} fill={CREAM} />
      <rect x={50} y={74} width={30} height={26} rx={2} fill={PAPER_DARK} />
      <rect x={50} y={106} width={30} height={26} rx={2} fill={PAPER_DARK} />
      <rect
        x={98}
        y={78}
        width={44}
        height={64}
        rx={5}
        fill={DENIM_LIGHT}
        transform="rotate(-20 120 110)"
      />
      <rect
        x={104}
        y={80}
        width={44}
        height={64}
        rx={5}
        fill={CREAM}
        stroke={DENIM}
        strokeWidth={3}
        transform="rotate(-4 126 112)"
      />
      <rect
        x={110}
        y={80}
        width={44}
        height={64}
        rx={5}
        fill={CREAM}
        stroke={DENIM}
        strokeWidth={3}
        transform="rotate(14 132 112)"
      />
      <rect x={122} y={98} width={22} height={26} rx={3} fill={SAGE} transform="rotate(14 133 111)" />
    </>
  ),

  // Generic sealed foil pack and one blank card with a plain starburst.
  pokemon: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={46} y={64} width={58} height={84} rx={6} fill={TERRACOTTA} />
      <path
        d="M 46 70 L 54 64 L 62 70 L 70 64 L 78 70 L 86 64 L 94 70 L 102 64 L 104 72 L 46 72 Z"
        fill={CREAM}
      />
      <rect x={46} y={98} width={58} height={16} fill={MUSTARD} />
      <rect x={46} y={120} width={58} height={6} rx={3} fill={CREAM} />
      <rect x={56} y={132} width={38} height={8} rx={4} fill={RUST} />
      <rect
        x={108}
        y={68}
        width={54}
        height={72}
        rx={6}
        fill={CREAM}
        stroke={DENIM}
        strokeWidth={3}
        transform="rotate(12 135 104)"
      />
      <path
        d="M 134 82 L 137.4 93.7 L 148.1 87.9 L 142.3 98.6 L 154 102 L 142.3 105.4 L 148.1 116.1 L 137.4 110.3 L 134 122 L 130.6 110.3 L 119.9 116.1 L 125.7 105.4 L 114 102 L 125.7 98.6 L 119.9 87.9 L 130.6 93.7 Z"
        fill={MUSTARD}
        transform="rotate(12 135 104)"
      />
      <circle cx={134} cy={102} r={7} fill={MUSTARD_LIGHT} transform="rotate(12 135 104)" />
    </>
  ),

  // A mid-build stack of generic stud-topped bricks.
  lego: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={58} y={118} width={16} height={12} rx={4} fill={DENIM_LIGHT} />
      <rect x={86} y={118} width={16} height={12} rx={4} fill={DENIM_LIGHT} />
      <rect x={114} y={118} width={16} height={12} rx={4} fill={DENIM_LIGHT} />
      <rect x={50} y={124} width={96} height={24} rx={4} fill={DENIM} />
      <rect x={68} y={92} width={16} height={12} rx={4} fill={BLUSH} />
      <rect x={96} y={92} width={16} height={12} rx={4} fill={BLUSH} />
      <rect x={62} y={98} width={72} height={24} rx={4} fill={TERRACOTTA} />
      <rect x={82} y={66} width={16} height={12} rx={4} fill={MUSTARD_LIGHT} />
      <rect x={104} y={66} width={16} height={12} rx={4} fill={MUSTARD_LIGHT} />
      <rect x={76} y={72} width={50} height={24} rx={4} fill={MUSTARD} />
      <rect x={150} y={126} width={12} height={9} rx={3} fill={SAGE} />
      <rect x={144} y={132} width={26} height={16} rx={4} fill={OLIVE} />
    </>
  ),

  // A record half out of a plain sleeve, with a turntable arm.
  vinyl: () => (
    <>
      <ellipse cx={100} cy={150} rx={60} ry={7} fill={INK} opacity={0.13} />
      <circle cx={124} cy={104} r={38} fill={INK} />
      <circle cx={124} cy={104} r={27} fill="none" stroke={DENIM_LIGHT} strokeWidth={2} />
      <circle cx={124} cy={104} r={14} fill={MUSTARD} />
      <circle cx={124} cy={104} r={4} fill={CREAM} />
      <rect x={32} y={62} width={84} height={84} rx={3} fill={DENIM} />
      <path d="M 74 78 L 98 122 L 50 122 Z" fill={MUSTARD_LIGHT} />
      <circle cx={62} cy={94} r={9} fill={CREAM} />
      <path
        d="M 166 56 L 152 92"
        fill="none"
        stroke={DENIM_LIGHT}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={168} cy={54} r={7} fill={INK} />
      <path d="M 146 88 L 158 94 L 150 106 L 142 98 Z" fill={CREAM} />
    </>
  ),

  // A stack of blank-spined books with one lying open on top.
  books: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={46} y={130} width={104} height={18} rx={4} fill={TERRACOTTA} />
      <rect x={128} y={134} width={18} height={10} rx={2} fill={CREAM} />
      <rect x={52} y={112} width={94} height={18} rx={4} fill={OLIVE} />
      <rect x={56} y={116} width={18} height={10} rx={2} fill={CREAM} />
      <rect x={48} y={94} width={100} height={18} rx={4} fill={DENIM} />
      <rect x={126} y={98} width={18} height={10} rx={2} fill={CREAM} />
      <path d="M 100 90 Q 76 74 50 80 L 50 66 Q 76 60 100 76 Z" fill={CREAM} />
      <path d="M 100 90 Q 124 74 150 80 L 150 66 Q 124 60 100 76 Z" fill={PAPER_DARK} />
      <path
        d="M 100 76 L 100 90"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M 62 74 L 88 80"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.3}
      />
      <path
        d="M 112 80 L 138 74"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.3}
      />
    </>
  ),

  // Three chairs drawn up around a small table with a book on it.
  "book-clubs": () => (
    <>
      <ellipse cx={100} cy={150} rx={64} ry={7} fill={INK} opacity={0.13} />
      <rect x={86} y={62} width={28} height={30} rx={5} fill={TERRACOTTA} />
      <rect x={84} y={90} width={32} height={9} rx={3} fill={RUST} />
      <rect x={36} y={78} width={10} height={38} rx={4} fill={OLIVE} />
      <rect x={30} y={112} width={34} height={9} rx={3} fill={OLIVE} />
      <path
        d="M 36 121 L 34 144"
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 58 121 L 60 144"
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <rect x={154} y={78} width={10} height={38} rx={4} fill={SAGE} />
      <rect x={136} y={112} width={34} height={9} rx={3} fill={SAGE} />
      <path
        d="M 164 121 L 166 144"
        fill="none"
        stroke={SAGE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 142 121 L 140 144"
        fill="none"
        stroke={SAGE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <ellipse cx={100} cy={112} rx={36} ry={13} fill={MUSTARD} />
      <rect x={95} y={116} width={10} height={26} rx={3} fill={RUST} />
      <ellipse cx={100} cy={144} rx={20} ry={7} fill={RUST} />
      <path d="M 100 104 Q 88 98 78 102 L 78 108 Q 88 104 100 110 Z" fill={CREAM} />
      <path d="M 100 104 Q 112 98 122 102 L 122 108 Q 112 104 100 110 Z" fill={DENIM_LIGHT} />
    </>
  ),

  // A clothing rack of hangers with a swing price tag.
  thrifting: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <path
        d="M 44 68 L 44 146"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 156 68 L 156 146"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 32 148 L 56 148"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 144 148 L 168 148"
        fill="none"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 38 68 L 162 68"
        fill="none"
        stroke={INK}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <path
        d="M 66 68 Q 66 78 60 82 M 66 68 Q 66 78 74 82"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M 58 84 L 66 80 L 74 84 L 80 92 L 74 96 L 74 124 L 58 124 L 58 96 L 52 92 Z" fill={TERRACOTTA} />
      <path
        d="M 104 68 Q 104 78 98 82 M 104 68 Q 104 78 112 82"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M 96 84 L 104 80 L 112 84 L 122 132 L 86 132 Z" fill={DENIM} />
      <path
        d="M 136 68 Q 136 78 130 82 M 136 68 Q 136 78 144 82"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M 128 84 L 136 80 L 144 84 L 150 94 L 146 98 L 148 126 L 124 126 L 126 98 L 122 94 Z" fill={MUSTARD} />
      <path
        d="M 144 126 L 144 132"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <path d="M 138 132 L 156 132 L 156 148 L 138 148 Z" fill={CREAM} />
      <circle cx={144} cy={137} r={3} fill={INK} />
    </>
  ),

  // A generic three-quarter sneaker resting on a shoebox.
  sneakers: () => (
    <>
      <ellipse cx={100} cy={150} rx={62} ry={7} fill={INK} opacity={0.13} />
      <rect x={42} y={122} width={116} height={26} rx={4} fill={TERRACOTTA} />
      <rect x={38} y={114} width={124} height={12} rx={4} fill={RUST} />
      <path d="M 48 112 Q 42 104 54 100 L 138 96 Q 154 98 152 108 Q 150 114 138 114 L 58 114 Q 50 114 48 112 Z" fill={CREAM} />
      <path d="M 56 100 Q 58 78 82 70 Q 102 64 114 78 L 134 92 Q 148 94 144 100 Z" fill={DENIM} />
      <path d="M 116 84 Q 134 88 142 98 L 118 99 Z" fill={DENIM_LIGHT} />
      <path d="M 56 100 Q 54 84 66 74 L 76 78 Q 62 88 64 100 Z" fill={DENIM_LIGHT} />
      <path
        d="M 84 78 L 98 86"
        fill="none"
        stroke={CREAM}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 92 74 L 106 82"
        fill="none"
        stroke={CREAM}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 100 70 L 114 78"
        fill="none"
        stroke={CREAM}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M 50 106 L 148 102"
        fill="none"
        stroke={INK}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.25}
      />
    </>
  ),

  // A partly assembled jigsaw with a couple of loose pieces.
  puzzles: () => (
    <>
      <ellipse cx={100} cy={150} rx={58} ry={7} fill={INK} opacity={0.13} />
      <rect x={46} y={82} width={108} height={66} rx={4} fill={PAPER_DARK} />
      <rect x={46} y={82} width={36} height={33} fill={DENIM_LIGHT} />
      <rect x={82} y={82} width={36} height={33} fill={SAGE} />
      <rect x={118} y={82} width={36} height={33} fill={MUSTARD_LIGHT} />
      <rect x={46} y={115} width={36} height={33} fill={SAGE} />
      <rect x={82} y={115} width={36} height={33} fill={DENIM_LIGHT} />
      <circle cx={82} cy={98} r={7} fill={SAGE} />
      <circle cx={118} cy={98} r={7} fill={MUSTARD_LIGHT} />
      <circle cx={82} cy={131} r={7} fill={DENIM_LIGHT} />
      <circle cx={64} cy={115} r={7} fill={DENIM_LIGHT} />
      <circle cx={100} cy={115} r={7} fill={SAGE} />
      <path
        d="M 46 115 L 154 115 M 82 82 L 82 148 M 118 82 L 118 115"
        fill="none"
        stroke={INK}
        strokeWidth={2}
        opacity={0.25}
      />
      <rect x={124} y={122} width={30} height={26} rx={3} fill={TERRACOTTA} />
      <circle cx={124} cy={135} r={7} fill={TERRACOTTA} />
      <rect x={30} y={54} width={30} height={26} rx={3} fill={MUSTARD} />
      <circle cx={60} cy={67} r={7} fill={MUSTARD} />
      <circle cx={45} cy={54} r={7} fill={PAPER_DARK} />
    </>
  ),

  // Flashcards showing an abstract glyph pair, under a speech bubble.
  "language-learning": () => (
    <>
      <ellipse cx={100} cy={150} rx={56} ry={7} fill={INK} opacity={0.13} />
      <rect x={38} y={86} width={78} height={58} rx={6} fill={PAPER_DARK} transform="rotate(-9 77 115)" />
      <rect x={44} y={92} width={80} height={56} rx={6} fill={CREAM} />
      <path
        d="M 66 104 Q 54 112 60 126 Q 66 138 78 132"
        fill="none"
        stroke={TERRACOTTA}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <circle cx={68} cy={118} r={4} fill={TERRACOTTA} />
      <path
        d="M 104 104 L 104 134 M 96 112 L 116 112 M 98 126 L 114 126"
        fill="none"
        stroke={OLIVE}
        strokeWidth={5}
        strokeLinecap="round"
      />
      <path
        d="M 84 120 L 92 120"
        fill="none"
        stroke={INK}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.45}
      />
      <rect x={100} y={44} width={70} height={44} rx={12} fill={DENIM} />
      <path d="M 116 86 L 114 102 L 132 86 Z" fill={DENIM} />
      <circle cx={120} cy={66} r={5} fill={CREAM} />
      <circle cx={135} cy={66} r={5} fill={CREAM} />
      <circle cx={150} cy={66} r={5} fill={CREAM} />
    </>
  ),
};
