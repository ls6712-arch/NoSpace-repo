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
  // Workbench
  { id: 1, hobbySlug: "workbench", name: "Crafting Beginners", description: "Just starting out with any tactile craft — questions welcome.", memberCount: 1284 },
  { id: 2, hobbySlug: "workbench", name: "NYC Pottery Beginners", location: "New York City", description: "Wheel-throwing and hand-building meetups around NYC.", memberCount: 96 },

  // In Motion
  { id: 5, hobbySlug: "inmotion", name: "Pickleball & Padel Regulars", description: "Find a match, share drills, compare paddles.", memberCount: 3402 },
  { id: 6, hobbySlug: "inmotion", name: "Austin Weekend Pickleball", location: "Austin", description: "Sunday morning games at Pease Park courts.", memberCount: 74 },

  // Kitchen Table
  { id: 7, hobbySlug: "kitchentable", name: "Home Barista Club", description: "Latte art, grind settings, and gear talk for the home setup.", memberCount: 1875 },
  { id: 8, hobbySlug: "kitchentable", name: "Portland Coffee Corners", location: "Portland", description: "Show off your home café setup, swap beans.", memberCount: 41 },

  // Rabbit Hole
  { id: 9, hobbySlug: "rabbithole", name: "Nostalgic Collectors", description: "Trading cards, thrifted finds, and visible mending.", memberCount: 1560 },
  { id: 10, hobbySlug: "rabbithole", name: "Chicago Thrift & Trade", location: "Chicago", description: "Meetups to trade cards and secondhand finds in person.", memberCount: 63 },
];

export function circlesByHobby(slug: string) {
  return circles.filter((c) => c.hobbySlug === slug);
}

export function getCircle(id: number) {
  return circles.find((c) => c.id === id);
}
