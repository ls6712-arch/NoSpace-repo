/** Editorial examples, never scheduled events, retrieved results or evidence of equipment ownership. */
export interface ActivityExample {
  id: string;
  interest: string;
  title: string;
  step: string;
  setting: "home" | "outside";
  social: string;
  art: "sketch" | "guitar" | "walk" | "cook" | "book" | "bird";
  tone: "orange" | "violet" | "lime" | "blue";
  /** A practice suggestion, not a verified duration or calendar slot. */
  minutes: number;
  /** Each inner array is a complete alternative bundle, not individually interchangeable items. */
  required: readonly (readonly string[])[];
  optional: readonly string[];
  corner: readonly [string, string];
  /** A draft only. Entering Stubby never submits it or writes a preference. */
  prompt: string;
}

export const ACTIVITY_EXAMPLES: readonly ActivityExample[] = [
  { id: "sketch", interest: "Drawing", title: "Sketch an object", step: "Pick an object nearby. Draw its outline.", setting: "home", social: "On your own", art: "sketch", tone: "orange", minutes: 10,
    required: [["Paper", "Pencil"], ["Tablet", "Drawing app"]], optional: ["Eraser"], corner: ["art-creative", "drawing"], prompt: "I’d like to try drawing at home." },
  { id: "guitar", interest: "Music", title: "Play a song you know", step: "Choose a song you used to play. Try its first few chords.", setting: "home", social: "On your own", art: "guitar", tone: "violet", minutes: 20,
    required: [["Acoustic guitar"], ["Electric guitar"]], optional: ["Amplifier", "Music stand"], corner: ["music", "guitar"], prompt: "I’d like to play guitar at home." },
  { id: "photo-walk", interest: "Photography", title: "Take a photo walk", step: "Choose a route. Photograph 3 things you notice.", setting: "outside", social: "Solo or together", art: "walk", tone: "lime", minutes: 30,
    required: [["Phone with a camera"], ["Camera"]], optional: ["Notebook"], corner: ["photography-film", "photography"], prompt: "I’d like to take a photo walk outside." },
  { id: "cook", interest: "Cooking", title: "Cook with a friend", step: "Choose a recipe together. Check the ingredients before you start.", setting: "home", social: "With someone", art: "cook", tone: "blue", minutes: 45,
    required: [["Recipe", "Ingredients", "Equipment the recipe needs"]], optional: ["Apron"], corner: ["food-cooking", "cooking"], prompt: "I’d like to cook at home with a friend." },
  { id: "read", interest: "Reading", title: "Read a chapter", step: "Choose a book you’ve been meaning to read. Start with a chapter.", setting: "home", social: "On your own", art: "book", tone: "violet", minutes: 20,
    required: [["Book"], ["E-reader", "Digital book"]], optional: ["Bookmark"], corner: ["books-writing", "books"], prompt: "I’d like to read at home." },
  { id: "birds", interest: "Birdwatching", title: "Listen for birds", step: "Choose somewhere you can stop safely. Listen and try to identify a bird.", setting: "outside", social: "Solo or together", art: "bird", tone: "blue", minutes: 15,
    required: [["Bird identification guide or app"]], optional: ["Binoculars"], corner: ["nature-outdoors", "birdwatching"], prompt: "I’d like to try birdwatching outside." },
];

export const FEATURED_EXAMPLES = ACTIVITY_EXAMPLES.slice(0, 4);

/** Only our fixed example ids can seed a draft. Never accept arbitrary history-state text. */
export function exampleFromEntry(state: unknown): ActivityExample | undefined {
  if (!state || typeof state !== "object" || !("landingExample" in state)) return;
  return ACTIVITY_EXAMPLES.find(e => e.id === state.landingExample);
}
