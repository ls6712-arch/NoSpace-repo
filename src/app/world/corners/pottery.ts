import type { CornerWorldConfig } from "../config";

/**
 * The Pottery Corner's room. Meera, Sid, Lena and Biscuit are characters, not people. Every word here is
 * in docs/glossary.md under "Corner room: Pottery".
 */
export const pottery: CornerWorldConfig = {
  key: "crafts-making/pottery",
  slug: "pottery",
  name: "Pottery",
  setting: "studio",
  pieceKind: "pot",
  copy: {
    intro: "The wheel is spinning and three potters are at work. Come make something, finished or not.",
    stageLabel: "The Pottery Corner as a 3D room. Drag to look around. Everything in it is also in the Walls panel.",
    walls: {
      still: { label: "Still making", sub: "in progress" },
      made: { label: "Made it", sub: "finished" },
    },
    yoursEmpty: "Nothing yet. Log a Moment and your piece appears in the Corner: on the drying rack while you’re still making it, on your shelf once it’s done.",
    yoursNote: "Finished pieces sit on your shelf. Pieces in progress dry on the rack.",
    hint: "Tap a sign to see who’s still making, who made it, and your own shelf.",
  },
  characters: [
    {
      name: "Sid",
      pose: "standing",
      action: "press",
      at: [-1.6, -0.3],
      rot: 0,
      look: { skin: 0xc08a63, shirt: 0x6b7a3f, pants: 0x4a3b30, apron: 0xc9b79a, hair: 0x1c1310 },
      lines: ["Wedge out the air bubbles first.", "Mine looked like a potato too. Keep going.", "You showed up. That’s the hard part."],
    },
    {
      name: "Meera",
      pose: "seated",
      action: "wheel",
      at: [1.3, 0.2],
      rot: 0,
      look: { skin: 0x8d5a3b, shirt: 0xd9a441, pants: 0x3a3a44, apron: 0x3c5a7a, hair: 0x211612, bun: true },
      lines: ["Centre first. Everything else follows.", "Slow hands, fast wheel.", "Wet your hands again. Trust me."],
      collapseLine: "Ha. Collapsed. Again! Third time today.",
    },
    {
      name: "Lena",
      pose: "seated",
      action: "glaze",
      at: [2.95, -1.6],
      rot: -Math.PI / 2,
      look: { skin: 0xe0b89a, shirt: 0xd98f8f, pants: 0x2f3a4a, apron: 0x4a4a4a, hair: 0x7a3b22, bun: true },
      lines: ["Nobody’s first bowl is round.", "Glaze day is the best day.", "Dip, count to three, lift."],
    },
  ],
  pet: { name: "Biscuit", at: [-0.2, 2.0], rot: -0.6, color: 0xc9803f, dark: 0x8f5326, line: "(Biscuit the cat is asleep. Purring.)" },
  greeting: ["Meera", "Oh hi! Grab a stool, the wheel’s warm."],
  sounds: { bed: ["wheel"] },
};
