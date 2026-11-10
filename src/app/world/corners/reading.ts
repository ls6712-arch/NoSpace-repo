import type { CornerWorldConfig } from "../config";

/**
 * The Reading Corner's room: armchairs, a window seat, a writing desk and a fire. Hana, Ellie, Omar and Moth are
 * characters, not people. Every word here is in docs/glossary.md under "Corner rooms: Gardening, Reading and
 * Board games".
 */
export const reading: CornerWorldConfig = {
  key: "books-writing/reading",
  slug: "reading",
  name: "Reading",
  setting: "nook",
  pieceKind: "book",
  copy: {
    intro: "The fire’s lit, the shelves go up to the ceiling, and three readers are lost in their books. Pull up a chair, halfway through or just starting.",
    stageLabel: "The Reading Corner as a 3D room. Drag to look around. Everything in it is also in the Walls panel.",
    walls: {
      still: { label: "Still reading", sub: "open" },
      made: { label: "Read it", sub: "finished" },
    },
    yoursEmpty: "Nothing yet. Log a Moment and your book appears in the Corner: open on the reading cart while you’re reading it, on your shelf once you finish.",
    yoursNote: "Finished books stand on your shelf. Ones you’re still reading lie open on the cart.",
    hint: "Tap a sign to see who’s still reading, who read it, and your own shelf.",
  },
  characters: [
    {
      name: "Hana",
      pose: "seated",
      action: "read",
      at: [1.35, 0.85],
      rot: 0.55,
      bookColor: 0x7a3b3b,
      look: { skin: 0xe3b896, shirt: 0xb5643f, pants: 0x2f3a4a, hair: 0x1c1310, bun: true, glasses: true },
      lines: ["Just one more chapter.", "Abandoning a book is allowed, you know.", "Read the first page out loud. It helps."],
    },
    {
      name: "Ellie",
      pose: "seated",
      action: "read",
      at: [-3.95, -0.5],
      rot: Math.PI / 2,
      bookColor: 0x2f4f6e,
      look: { skin: 0xf0c9a8, shirt: 0xc9a24a, pants: 0x4a3b30, hair: 0xa0522d },
      lines: ["Rain is the best reading weather.", "I keep a pencil for lines I love.", "Ten pages counts. It really does."],
    },
    {
      name: "Omar",
      pose: "seated",
      action: "write",
      at: [-1.6, -0.15],
      rot: 0,
      look: { skin: 0xa8774f, shirt: 0x7a3b3b, pants: 0x3a3a44, hair: 0x141010, glasses: true },
      lines: ["I write one line about every book.", "Libraries are the best free thing there is.", "Swap a book with a friend. It’s a gift that comes back."],
    },
  ],
  pet: { name: "Moth", at: [0.15, 1.05], rot: 0.4, color: 0x8a8a8a, dark: 0x5a5a5a, line: "(Moth is asleep on the rug, very much not reading.)" },
  greeting: ["Hana", "Oh, hello. The armchair by the fire is free."],
  sounds: { bed: ["fire", "clock"] },
};
