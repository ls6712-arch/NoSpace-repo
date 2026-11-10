import type { CornerWorldConfig } from "../config";

/**
 * The Board games Corner's room: a game table, a card table and shelves of games. Theo, Mira, Sol and Meeple are
 * characters, not people. Every word here is in docs/glossary.md under "Corner rooms: Gardening, Reading and
 * Board games".
 */
export const boardGames: CornerWorldConfig = {
  key: "gaming-tabletop/board-games",
  slug: "board-games",
  name: "Board games",
  setting: "cafe",
  pieceKind: "game",
  copy: {
    intro: "Dice are rolling, someone’s thinking far too hard, and the shelves are full of games. Sit down and learn one, or play an old favourite.",
    stageLabel: "The Board games Corner as a 3D room. Drag to look around. Everything in it is also in the Walls panel.",
    walls: {
      still: { label: "Still learning", sub: "learning" },
      made: { label: "Played it", sub: "played" },
    },
    yoursEmpty: "Nothing yet. Log a Moment and your game appears in the Corner: open on the learning cart while you’re learning it, on your shelf once you’ve played it properly.",
    yoursNote: "Games you’ve played stand on your shelf. Ones you’re learning sit open on the cart.",
    hint: "Tap a sign to see who’s still learning, who played it, and your own shelf.",
  },
  characters: [
    {
      name: "Theo",
      pose: "seated",
      action: "dice",
      at: [0.95, -0.32],
      rot: 0,
      look: { skin: 0xc08a63, shirt: 0x2f6e8f, pants: 0x3a3a44, hair: 0x2a1d18 },
      lines: ["Come on, double six.", "Rule one: whoever explains the rules goes first.", "Losing is how you learn the good games."],
    },
    {
      name: "Mira",
      pose: "seated",
      action: "move",
      at: [0.02, 0.55],
      rot: Math.PI / 2,
      look: { skin: 0x8d5a3b, shirt: 0xe07a4a, pants: 0x2f3a4a, hair: 0x141010, bun: true },
      lines: ["Your turn. Take your time. Not that much time.", "First game is always a practice game.", "Read the rules out loud together. It’s faster."],
    },
    {
      name: "Sol",
      pose: "seated",
      action: "think",
      at: [1.88, 0.55],
      rot: -Math.PI / 2,
      look: { skin: 0xe3b896, shirt: 0x6b4a8a, pants: 0x4a3b30, hair: 0xd9b34a, glasses: true },
      lines: ["Hmm. Hmm. Hmm.", "I’m not losing, I’m strategising.", "Short games first. Big ones once you’re hooked."],
      cheerLine: "Yes! Did you see that?",
    },
  ],
  pet: { name: "Meeple", at: [-0.6, 2.0], rot: -0.6, color: 0xd9a05a, dark: 0xa0642a, line: "(Meeple is asleep and has knocked over a pawn.)" },
  greeting: ["Mira", "Hi! We’re mid-game, but there’s always room for one more."],
  sounds: { bed: ["cafe"] },
};
