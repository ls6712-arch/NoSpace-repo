import type { CornerWorldConfig } from "../config";

/**
 * The Gardening Corner's room: a greenhouse open onto a garden. Rosa, Kofi, Noor, Ade and Pip are characters,
 * not people. Every word here is in docs/glossary.md under "Corner rooms: Gardening, Reading and Board games".
 */
export const gardening: CornerWorldConfig = {
  key: "home-garden/gardening",
  slug: "gardening",
  name: "Gardening",
  setting: "garden",
  pieceKind: "plant",
  copy: {
    intro: "The greenhouse doors are open to the vegetable patch, someone’s watering the big fern, and the seedling stand is full. Come grow something, sprouted or not.",
    stageLabel: "The Gardening Corner as a 3D room. Drag to look around. Everything in it is also in the Walls panel.",
    walls: {
      still: { label: "Still growing", sub: "growing" },
      made: { label: "Made it", sub: "in bloom or picked" },
    },
    yoursEmpty: "Nothing yet. Log a Moment and your plant appears in the Corner: on the seedling stand while it’s growing, on your shelf once it blooms or you pick something.",
    yoursNote: "Plants that made it sit on your shelf. Ones still growing wait on the stand.",
    hint: "Tap a sign to see who’s still growing, who made it, and your own shelf.",
  },
  characters: [
    {
      name: "Rosa",
      pose: "standing",
      action: "water",
      at: [2.75, -1.55],
      rot: -Math.PI / 2,
      look: { skin: 0xb07a55, shirt: 0xe0b24a, pants: 0x3f5a4c, apron: 0x7a8a5a, hair: 0x2a1d18, bun: true },
      lines: ["Water the soil, not the leaves.", "Most plants want less water than you think.", "Talk to them. It can’t hurt."],
    },
    {
      name: "Kofi",
      pose: "standing",
      action: "press",
      at: [-1.6, -0.3],
      rot: 0,
      look: { skin: 0x5a3a28, shirt: 0x3f6b8a, pants: 0x4a3b30, apron: 0xa58a6a, hair: 0x141010 },
      lines: ["Firm the soil, don’t pack it.", "Hold them by the leaf, never the stem.", "Every gardener kills a few. Keep going."],
    },
    {
      name: "Noor",
      pose: "kneel",
      action: "dig",
      at: [0.15, 0.75],
      rot: Math.PI / 2,
      look: { skin: 0xd9a882, shirt: 0xc0453a, pants: 0x4a5a6a, hair: 0x3a2418 },
      lines: ["Look, the first tomato is turning red.", "Weeding is basically meditation.", "Plant a few extra. Snails eat some."],
    },
    {
      name: "Ade",
      pose: "kneel",
      action: "dig",
      at: [-5.55, 1.9],
      rot: -Math.PI / 2,
      look: { skin: 0x6b4430, shirt: 0xe0b24a, pants: 0x3f5a4c, hair: 0x141010 },
      lines: ["Sun on your back, hands in the soil. Best feeling.", "The sunflowers were one seed each. One!", "Outside beds forgive a lot. Just start."],
    },
  ],
  pet: { name: "Pip", at: [-0.7, 2.1], rot: -0.4, color: 0x3a3a3a, dark: 0x1f1f1f, line: "(Pip is asleep in a patch of sun.)" },
  greeting: ["Rosa", "Hi! Mind the hose, everything else is fair game."],
  sounds: { bed: ["birds", "wind"] },
};
