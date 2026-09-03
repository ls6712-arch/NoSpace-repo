export interface Circle {
  id: number;
  hobbySlug: string;
  name: string;
  /** Undefined = global circle. Set = a geographic sub-layer within the hobby. */
  location?: string;
  description: string;
  memberCount: number;
}

export const circles: Circle[] = [
  // Crafting
  { id: 1, hobbySlug: "crafting", name: "Crafting Beginners", description: "Just starting out with any tactile craft — questions welcome.", memberCount: 1284 },
  { id: 2, hobbySlug: "crafting", name: "NYC Pottery Beginners", location: "New York City", description: "Wheel-throwing and hand-building meetups around NYC.", memberCount: 96 },

  // Mysticism
  { id: 3, hobbySlug: "mysticism", name: "Tarot & Astrology Circle", description: "Daily pulls, chart questions, and beginner-friendly discussion.", memberCount: 2031 },
  { id: 4, hobbySlug: "mysticism", name: "Bay Area Full Moon Circle", location: "San Francisco Bay Area", description: "In-person full moon rituals, monthly.", memberCount: 58 },

  // Sports
  { id: 5, hobbySlug: "sports", name: "Pickleball & Padel Regulars", description: "Find a match, share drills, compare paddles.", memberCount: 3402 },
  { id: 6, hobbySlug: "sports", name: "Austin Weekend Pickleball", location: "Austin", description: "Sunday morning games at Pease Park courts.", memberCount: 74 },

  // Recreation
  { id: 7, hobbySlug: "recreation", name: "Home Barista Club", description: "Latte art, grind settings, and gear talk for the home setup.", memberCount: 1875 },
  { id: 8, hobbySlug: "recreation", name: "Portland Coffee Corners", location: "Portland", description: "Show off your home café setup, swap beans.", memberCount: 41 },

  // Collecting
  { id: 9, hobbySlug: "collecting", name: "Nostalgic Collectors", description: "Trading cards, thrifted finds, and visible mending.", memberCount: 1560 },
  { id: 10, hobbySlug: "collecting", name: "Chicago Thrift & Trade", location: "Chicago", description: "Meetups to trade cards and secondhand finds in person.", memberCount: 63 },
];

export function circlesByHobby(slug: string) {
  return circles.filter((c) => c.hobbySlug === slug);
}

export function getCircle(id: number) {
  return circles.find((c) => c.id === id);
}
