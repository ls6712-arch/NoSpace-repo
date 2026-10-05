// Fixture rows for the visual harness, typed against the generated schema
// (database.types.ts) — a missing or renamed column is a compile error here,
// not a silently empty screen. Times are relative to `now` so "starts in 3h"
// and "this week" stay true whenever the harness runs.
import type { Fixtures, Row } from "./postgrest.ts";

export const ME = "11111111-1111-4111-8111-111111111111";
const THEO = "22222222-2222-4222-8222-222222222201";
const PRIYA = "22222222-2222-4222-8222-222222222202";
const SAM = "22222222-2222-4222-8222-222222222203";
const INES = "22222222-2222-4222-8222-222222222204";
export const PURSUIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const PURSUIT2_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
export const SPACE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
export const SPACE_SLUG = "clay-hands";
export const MEDIA_ORIGIN = "https://fixture.supabase.co/storage/v1/object/public/moments";

export function buildFixtures(now = new Date()): Fixtures {
  const ago = (days: number, h = 0) => new Date(now.getTime() - days * 864e5 - h * 36e5).toISOString();
  const ahead = (hours: number) => new Date(now.getTime() + hours * 36e5).toISOString();
  const media = (n: number) => `${MEDIA_ORIGIN}/${n}.svg`;

  const person = (id: string, username: string, display_name: string, tagline: string | null): Row<"profiles"> => ({
    id, username, display_name, tagline, bio: null, avatar_url: null, access: "active", cover_post_id: null, cover_tagline: null,
    cover_title: null, created_at: ago(120), deletion_requested_at: null, discoverable: true, invite_allowance: 3, invited_by: null,
    is_admin: false, onboarding_completed: true, onboarding_completed_at: ago(119), paused_at: null, show_this_corner: true,
    theme_preference: "system",
  });
  const profiles: Row<"profiles">[] = [
    person(ME, "maya", "Maya Okafor", "Making things slowly, on purpose"),
    person(THEO, "theo", "Theo Reyes", "Espresso and bad puns"),
    person(PRIYA, "priya", "Priya Nair", "Embroidery, mostly"),
    person(SAM, "sam", "Sam Okafor", "Thrifting and mending"),
    person(INES, "ines", "Inès Moreau", "Ceramics, cats"),
  ];

  const post = (id: number, user_id: string, caption: string, o: Partial<Row<"posts">> = {}): Row<"posts"> => ({
    id, user_id, caption, hobby_slug: "crafts-making", sub_hobby: "pottery", corner: "Pottery", interest: "Pottery",
    type: "photo", media_url: media(id), media_urls: null, media_paths: [], created_at: ago(id / 3), likes: id % 7, love_count: id % 5, in_count: id % 3,
    location_name: null, location_privacy: null, pinned: false, pursuit_id: null, reflection: null, starts_at: null, tags: ["pottery"],
    thoughts_private: false, visibility: "public", ...o,
  });
  const posts: Row<"posts">[] = [
    post(1, ME, "Trimmed my first set of mugs tonight. Still wobbly, still proud."),
    post(2, ME, "Bowl number nine. The rim finally sits right.", { pursuit_id: PURSUIT_ID }),
    post(3, ME, "Glaze test tiles, fired and cooled. The celadon came out greener than I hoped.", { pursuit_id: PURSUIT_ID }),
    // Three photos: the carousel (swipe, dots, "Photo n of 3").
    post(91, ME, "Three shots from the kiln opening.", { media_urls: [media(71), media(72), media(73)] }),
    post(90, ME, "Morning sketch: the kettle, the window, the light.", { pursuit_id: PURSUIT2_ID, hobby_slug: "crafts-making", sub_hobby: null, corner: "Drawing", interest: "Drawing", tags: ["drawing"] }),
    // Text-only Moments (type "written", no media) — these render as colored tiles with a caption.
    post(4, ME, "Short note.", { type: "written", media_url: "" }),
    post(5, ME, "Wedging for ten minutes before throwing changed everything about how the clay behaves.", { type: "written", media_url: "" }),
    post(6, ME, "Spent the whole evening centering clay and not one pot survived, but my hands finally understand what 'centered' feels like, and I think that counts for something real.", { type: "written", media_url: "" }),
    post(7, THEO, "Dialled in the new grinder. Nine seconds of pre-infusion, finally.", { hobby_slug: "food-cooking", sub_hobby: "espresso", corner: "Espresso", interest: "Espresso" }),
    post(8, PRIYA, "Sashiko stitch walkthrough on a thrifted jacket.", { hobby_slug: "art-creative", sub_hobby: "embroidery", corner: "Embroidery", interest: "Embroidery" }),
    post(9, SAM, "Coffee corner finally has a home. This tray changed everything.", { hobby_slug: "home-garden", sub_hobby: "decor", corner: "Decor", interest: "Decor" }),
    post(10, INES, "Kiln opened. Two cracked, three perfect.", { created_at: ago(0.2) }),
    post(11, INES, "Tea bowl, tenmoku glaze.", { created_at: ago(0.5) }),
    post(12, THEO, "Pour-over practice, morning light.", { hobby_slug: "food-cooking", sub_hobby: "espresso", corner: "Espresso", interest: "Espresso" }),
  ];

  const pursuits: Row<"pursuits">[] = [{
    id: PURSUIT_ID, user_id: ME, title: "Throw 24 bowls by spring", mode: "together", shared: true, hobby_slug: "crafts-making", sub_hobby: "pottery",
    interest: "Pottery", custom_space: null, inspired_by_post_id: null, started_at: ago(30), finished_at: null, paused_at: null, let_go_at: null,
    ending_note: null, cover_image_path: `${ME}/pursuit-cover-1.jpg`, cover_image_preference: "last", check_in_days: 7, goal_shape: "number", goal_label: "24 bowls", goal_target_number: 24, goal_unit: "bowls", goal_current: 9,
    goal_verb: "throw", goal_target_date: ahead(24 * 60), goal_reached_at: null, updated_at: ago(1),
    measure: { kind: "count", target: 24, unit: "bowls", whatCounts: "A bowl that survives the bisque firing", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 },
  }, {
    // No custom cover: the card falls back to a photo from its own Moments.
    id: PURSUIT2_ID, user_id: ME, title: "Sketch something every morning", mode: "solo", shared: false, hobby_slug: "crafts-making", sub_hobby: null,
    interest: "Drawing", custom_space: null, inspired_by_post_id: null, started_at: ago(12), finished_at: null, paused_at: null, let_go_at: null,
    ending_note: null, cover_image_path: null, cover_image_preference: "first", check_in_days: 7, goal_shape: null, goal_label: null, goal_target_number: null, goal_unit: null,
    goal_verb: null, goal_target_date: null, goal_reached_at: null, goal_current: null, updated_at: ago(2), measure: null,
  }];
  const pursuit_members: Row<"pursuit_members">[] = [
    { pursuit_id: PURSUIT2_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(12) },
    { pursuit_id: PURSUIT_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(30) },
    { pursuit_id: PURSUIT_ID, user_id: INES, role: "member", status: "joined", invited_by: ME, created_at: ago(28) },
    { pursuit_id: PURSUIT_ID, user_id: THEO, role: "member", status: "invited", invited_by: ME, created_at: ago(2) },
  ];
  const pursuit_plans: Row<"pursuit_plans">[] = [
    { pursuit_id: PURSUIT_ID, user_id: ME, next_session_at: ahead(26), next_session_note: "Trim the three leather-hard bowls, then wedge the next batch", times_per_week: 3, updated_at: ago(1) },
  ];
  const pursuit_progress: Row<"pursuit_progress">[] = [2, 3, 1, 5, 6].map((n, i) => ({
    id: `cccccccc-cccc-4ccc-8ccc-cccccccccc0${i}`, pursuit_id: PURSUIT_ID, user_id: ME, amount: i === 3 ? 2 : 1,
    note: ["Bowl number nine. The rim finally sits right.", "Glaze tiles", null, "Two bowls before dinner", "Trimmed and waiting"][i],
    image_url: i % 2 === 0 ? media(n) : null, post_id: n, created_at: ago(14 - i * 3),
  }));

  const spaces: Row<"spaces">[] = [{
    id: SPACE_ID, slug: SPACE_SLUG, name: "Clay Hands", description: "Wheel-throwers, hand-builders and glaze nerds. Share the kiln results, the cracked ones too.",
    cover_image: media(10), category_slug: "crafts-making", meets: "both", neighborhood: "Riverside", city: "Portland", access: "open", join_questions: [],
    rules: "Be kind about the cracked ones. Credit the glaze recipe if it isn't yours.", member_cap: null, posting_mode: "immediate", events_created_by: "hosts",
    status: "active", created_by: ME, created_at: ago(90), host_handoff_started_at: null, studio_capacity: null, studio_hourly_rate: null, studio_hours: null,
  }];
  const sm = (user_id: string, role: "host" | "member", status: "active" | "pending" = "active"): Row<"space_members"> => ({ space_id: SPACE_ID, user_id, role, status, joined_at: ago(60), invited_by: null });
  const space_members: Row<"space_members">[] = [sm(ME, "host"), sm(THEO, "host"), sm(PRIYA, "member"), sm(SAM, "member"), sm(INES, "member"), sm("22222222-2222-4222-8222-222222222205", "member", "pending")];
  const space_moments: Row<"space_moments">[] = [1, 2, 3, 10, 11].map((post_id) => ({ space_id: SPACE_ID, post_id, status: "approved", featured: post_id === 10, removed_by_host: false, added_at: ago(post_id / 2) }));
  const space_events: Row<"space_events">[] = [
    { id: 1, space_id: SPACE_ID, title: "Open studio night", description: "Bring a bisque piece to glaze. Tea provided.", starts_at: ahead(3), ends_at: ahead(5), timezone: "America/Los_Angeles", meets: "in_person", neighborhood: "Riverside", city: "Portland", featured: true, status: "scheduled", created_by: ME, created_at: ago(5) },
    { id: 2, space_id: SPACE_ID, title: "Glaze swap", description: null, starts_at: ahead(48), ends_at: null, timezone: "America/Los_Angeles", meets: "both", neighborhood: null, city: null, featured: false, status: "scheduled", created_by: ME, created_at: ago(4) },
    { id: 3, space_id: SPACE_ID, title: "Kiln unloading and show-and-tell", description: null, starts_at: ahead(120), ends_at: null, timezone: "America/Los_Angeles", meets: "in_person", neighborhood: "Riverside", city: "Portland", featured: false, status: "scheduled", created_by: THEO, created_at: ago(3) },
  ];
  const event_rsvps: Row<"event_rsvps">[] = [{ event_id: 1, user_id: PRIYA, created_at: ago(1) }, { event_id: 1, user_id: SAM, created_at: ago(1) }];

  const participations: Row<"participations">[] = [
    { id: 1, from_user: THEO, to_user: ME, kind: "make_together", status: "accepted", note: "Want to pull shots together on Saturday?", hobby_key: "food-cooking", intent: null, post_id: null, created_at: ago(6), responded_at: ago(5) },
    { id: 2, from_user: ME, to_user: INES, kind: "explore_together", status: "accepted", note: null, hobby_key: "crafts-making", intent: null, post_id: 10, created_at: ago(4), responded_at: ago(3) },
    { id: 3, from_user: PRIYA, to_user: ME, kind: "join_in", status: "pending", note: "Your sashiko jacket thread made my week.", hobby_key: "art-creative", intent: null, post_id: null, created_at: ago(1), responded_at: null },
  ];
  const msg = (id: number, pid: number, from: string, to: string, body: string, h: number): Row<"messages"> => ({ id, participation_id: pid, from_user: from, to_user: to, body, kind: "text", created_at: ago(0, h), deleted_at: null, media_path: null, shared_post_id: null, shared_pursuit_id: null });
  const messages: Row<"messages">[] = [
    msg(1, 1, THEO, ME, "Want to pull shots together on Saturday?", 30), msg(2, 1, ME, THEO, "Yes. I'll bring the scale and the good cups.", 28),
    msg(3, 1, THEO, ME, "Perfect. Bring the cracked mug too, it makes a great espresso cup.", 2),
    msg(4, 2, ME, INES, "The tenmoku bowl is unreal.", 50), msg(5, 2, INES, ME, "Thank you! It took three firings to get that depth.", 20),
  ];
  const notifications: Row<"notifications">[] = [
    { id: 1, user_id: ME, kind: "participation_request", actor_id: PRIYA, actor_name: "Priya Nair", body: "Priya Nair wants to join in on Embroidery.", href: "/inbox", read: false, created_at: ago(1) },
  ];

  const emptyTables = ["blocks", "bookmarks", "connections", "conversation_reads", "hobby_follows", "post_likes", "post_reflections", "private_logs", "profile_follows", "profile_links", "reactions", "reports", "thoughts", "moment_drafts", "pursuit_invite_links", "space_join_requests", "space_host_invites", "space_deletion_requests", "space_deletion_approvals", "event_private_details", "space_private_details", "space_corners", "corners", "category_suggestions", "invites", "waitlist"] as const;
  const empties = Object.fromEntries(emptyTables.map((t) => [t, []])) as Fixtures;
  const profile_settings: Row<"profile_settings">[] = [];
  const app_config: Row<"app_config">[] = [{ key: "corner_min_moments_30d", value: 3, updated_at: ago(30) }, { key: "trademark_blocklist", value: [], updated_at: ago(30) }];
  const categories: Row<"categories">[] = [{ slug: "crafts-making", name: "Crafts & Making", description: null, examples: null, keywords: null, prompt: null, active: true, sort_order: 1, created_at: ago(200), updated_at: ago(200) }];
  return { ...empties, profiles, posts, pursuits, pursuit_members, pursuit_plans, pursuit_progress, spaces, space_members, space_moments, space_events, event_rsvps, participations, messages, notifications, profile_settings, app_config, categories };
}
