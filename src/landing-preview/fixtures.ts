/**
 * Example people and Moments for the landing-page screenshots. Nothing here is
 * a real account: three made-up people with initials avatars, and photos of
 * activities only (landing-preview/photos, see public/landing/README.md).
 * Only loaded in `--mode landing-preview`; see vite.config.ts.
 */

export const MAYA = "a0000000-0000-4000-8000-00000000a001";
export const NICK = "a0000000-0000-4000-8000-00000000a002";
export const THEO = "a0000000-0000-4000-8000-00000000a003";

const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
/** Post media must be an absolute http(s) URL to count as a real photo. */
export const photo = (name: string) => `${origin()}/landing-photos/${name}`;

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number, hours = 0) => new Date(Date.now() - days * DAY - hours * 60 * 60 * 1000).toISOString();

export const profiles = [
  { id: MAYA, username: "maya", display_name: "Maya", avatar_url: null, tagline: "Running, baking, film photography", bio: "Half marathon in the spring. Sourdough on Sundays. A roll of film in every coat pocket.", cover_title: null, cover_tagline: null, cover_post_id: null },
  { id: NICK, username: "nick", display_name: "Nick", avatar_url: null, tagline: "Bouldering, guitar, woodworking", bio: "Climbs on weeknights, builds things on weekends.", cover_title: null, cover_tagline: null, cover_post_id: null },
  { id: THEO, username: "theo", display_name: "Theo", avatar_url: null, tagline: "Pottery, cooking, sketching", bio: "Learning the wheel. Cooking everything from scratch.", cover_title: null, cover_tagline: null, cover_post_id: null },
];

/** What the signed-in session sees about itself: an active, onboarded member. */
export const ownPrivate = (id: string) => ({
  access: "active",
  invited_by: null,
  invite_allowance: 3,
  onboarding_completed: true,
  onboarding_completed_at: ago(40),
  theme_preference: "light",
  is_admin: false,
  discoverable: true,
  show_this_corner: true,
});

type PostRow = Record<string, unknown>;
const post = (p: PostRow): PostRow => ({
  type: "photo",
  media_urls: null,
  media_paths: null,
  likes: 0,
  love_count: 0,
  in_count: 0,
  visibility: "public",
  tags: [],
  pinned: false,
  thoughts_private: false,
  interest: null,
  starts_at: null,
  location_name: null,
  location_privacy: null,
  pursuit_id: null,
  sub_hobby: null,
  ...p,
});

export const posts: PostRow[] = [
  // Maya
  post({ id: 9001, user_id: MAYA, hobby_slug: "food-cooking", corner: "Baking", caption: "Sourdough, loaf #10", media_url: photo("maya-sourdough.jpg"), love_count: 7, in_count: 14, created_at: ago(9), pursuit_id: "p-sourdough" }),
  post({ id: 9002, user_id: MAYA, hobby_slug: "sports-fitness", corner: "Running", caption: "Eleven miles along the river", media_url: photo("maya-running.jpg"), love_count: 5, in_count: 2, created_at: ago(3), pursuit_id: "p-halfmarathon" }),
  post({ id: 9003, user_id: MAYA, hobby_slug: "photography-film", corner: "Film photography", caption: "First roll of film, back from the lab", media_url: photo("maya-film.jpg"), love_count: 9, in_count: 1, created_at: ago(12), pursuit_id: "p-film" }),
  post({ id: 9004, user_id: MAYA, hobby_slug: "sports-fitness", corner: "Bouldering", caption: "Day one on the V2 wall", media_url: photo("maya-bouldering.jpg"), love_count: 3, in_count: 1, created_at: ago(6), pursuit_id: "p-v2" }),
  // Nick
  post({ id: 9101, user_id: NICK, hobby_slug: "sports-fitness", corner: "Bouldering", caption: "First V3!", media_url: photo("nick-bouldering.jpg"), love_count: 12, in_count: 4, created_at: ago(1) }),
  post({ id: 9102, user_id: NICK, hobby_slug: "crafts-making", corner: "Woodworking", caption: "Walnut cutting board", media_url: photo("nick-cutting-board.jpg"), love_count: 8, in_count: 3, created_at: ago(5) }),
  post({ id: 9103, user_id: NICK, hobby_slug: "music", corner: "Guitar", caption: "Blackbird, bars one to eight", media_url: photo("nick-guitar.jpg"), love_count: 4, in_count: 2, created_at: ago(8), pursuit_id: "p-blackbird" }),
  // Theo
  post({ id: 9201, user_id: THEO, hobby_slug: "crafts-making", corner: "Pottery", caption: "Wheel class Saturday", media_url: photo("theo-wheel.jpg"), love_count: 11, in_count: 6, created_at: ago(2) }),
  post({ id: 9202, user_id: THEO, hobby_slug: "food-cooking", corner: "Cooking", caption: "Ramen from scratch", media_url: photo("theo-ramen.jpg"), love_count: 14, in_count: 5, created_at: ago(4) }),
  post({ id: 9203, user_id: THEO, hobby_slug: "art-creative", corner: "Sketching", caption: "Café number seven", media_url: photo("theo-sketchbook.jpg"), love_count: 6, in_count: 1, created_at: ago(7), pursuit_id: "p-cafes" }),
];

/** Who each person follows, so the app sees them as connected. */
export const profileFollows = [
  { follower_id: MAYA, followee_id: NICK, status: "accepted" },
  { follower_id: MAYA, followee_id: THEO, status: "accepted" },
  { follower_id: NICK, followee_id: MAYA, status: "accepted" },
  { follower_id: THEO, followee_id: MAYA, status: "accepted" },
];

const pursuitRow = (r: Record<string, unknown>) => ({
  shared: true,
  paused_at: null,
  check_in_days: null,
  ending_note: null,
  measure: null,
  mode: null,
  let_go_at: null,
  cover_image_path: null,
  cover_image_preference: null,
  interest: null,
  custom_space: null,
  inspired_by_post_id: null,
  goal_shape: null,
  goal_label: null,
  goal_target_number: null,
  goal_unit: null,
  goal_current: null,
  goal_verb: null,
  goal_target_date: null,
  goal_reached_at: null,
  finished_at: null,
  sub_hobby: null,
  ...r,
});

/** The shared Pursuits other people see on a Shelf. */
export const pursuits = [
  pursuitRow({ id: "p-sourdough", user_id: MAYA, title: "Sourdough, 10 loaves", hobby_slug: "food-cooking", interest: "Baking", started_at: ago(60), finished_at: ago(9), goal_shape: "number", goal_label: "10 loaves", goal_target_number: 10, goal_unit: "loaves", goal_current: 10, goal_reached_at: ago(9) }),
  pursuitRow({ id: "p-halfmarathon", user_id: MAYA, title: "Half marathon", hobby_slug: "sports-fitness", interest: "Running", started_at: ago(45), goal_shape: "number", goal_label: "13.1 miles", goal_target_number: 13.1, goal_unit: "miles", goal_current: 11 }),
  pursuitRow({ id: "p-film", user_id: MAYA, title: "First roll of film", hobby_slug: "photography-film", interest: "Film photography", started_at: ago(30), finished_at: ago(12) }),
  pursuitRow({ id: "p-v2", user_id: MAYA, title: "Climb my first V2", hobby_slug: "sports-fitness", interest: "Bouldering", started_at: ago(10) }),
  pursuitRow({ id: "p-blackbird", user_id: NICK, title: "Learn Blackbird", hobby_slug: "music", interest: "Guitar", started_at: ago(20) }),
  pursuitRow({ id: "p-cafes", user_id: THEO, title: "Sketch 30 cafés", hobby_slug: "art-creative", interest: "Sketching", started_at: ago(25), goal_shape: "number", goal_label: "30 cafés", goal_target_number: 30, goal_unit: "cafés", goal_current: 7 }),
];

/** Maya's bell. The first row is exactly what the database would write for 14
 * people saving "Sourdough, loaf #10": see public.save_notification_body. */
export const notifications = [
  { id: 1, user_id: MAYA, kind: "save", body: "14 people want to try “Sourdough, loaf #10”.", href: "/moment/9001", actor_name: null, actor_id: null, read: false, created_at: ago(0, 0.2), target_post_id: 9001 },
  { id: 2, user_id: MAYA, kind: "love", body: "Nick loved your moment.", href: "/moment/9002", actor_name: "Nick", actor_id: NICK, read: false, created_at: ago(0, 5), target_post_id: 9002 },
  { id: 3, user_id: MAYA, kind: "thought", body: "Theo left a thought on your moment.", href: "/moment/9003", actor_name: "Theo", actor_id: THEO, read: true, created_at: ago(1, 3), target_post_id: 9003 },
];
