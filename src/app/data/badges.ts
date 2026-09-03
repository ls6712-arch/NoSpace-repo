import { hobbies } from "./hobbies";

export interface RewardStats {
  points: number;
  postsCreated: number;
  likesGiven: number;
  purchases: number;
  hobbiesVisited: string[];
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name, resolved in the UI
  test: (stats: RewardStats) => boolean;
}

export const badges: Badge[] = [
  {
    id: "first-spark",
    name: "First Spark",
    description: "Posted your first piece of content.",
    icon: "Sparkles",
    test: (s) => s.postsCreated >= 1,
  },
  {
    id: "storyteller",
    name: "Storyteller",
    description: "Shared 5 posts with the community.",
    icon: "BookOpen",
    test: (s) => s.postsCreated >= 5,
  },
  {
    id: "community-voice",
    name: "Community Voice",
    description: "Liked 25 other creators' posts.",
    icon: "Heart",
    test: (s) => s.likesGiven >= 25,
  },
  {
    id: "collector",
    name: "Collector",
    description: "Bought 3 items or courses from creators.",
    icon: "ShoppingBag",
    test: (s) => s.purchases >= 3,
  },
  {
    id: "explorer",
    name: "Hobbyist Explorer",
    description: `Checked out all ${hobbies.length} hobby spaces.`,
    icon: "Compass",
    test: (s) => s.hobbiesVisited.length >= hobbies.length,
  },
  {
    id: "rising-creator",
    name: "Rising Creator",
    description: "Earned 500 points.",
    icon: "TrendingUp",
    test: (s) => s.points >= 500,
  },
  {
    id: "legend",
    name: "NoSpace Legend",
    description: "Earned 2,000 points.",
    icon: "Crown",
    test: (s) => s.points >= 2000,
  },
];

export function levelForPoints(points: number) {
  return Math.floor(points / 200) + 1;
}

export function levelProgress(points: number) {
  const into = points % 200;
  return Math.round((into / 200) * 100);
}
