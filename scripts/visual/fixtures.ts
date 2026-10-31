// Fixture rows for the visual harness, typed against the generated schema
// (database.types.ts) — a missing or renamed column is a compile error here,
// not a silently empty screen. Times are relative to `now` so "starts in 3h"
// and "this week" stay true whenever the harness runs.
import fs from "node:fs";
import type { Fixtures, Row } from "./postgrest.ts";

export const ME = "11111111-1111-4111-8111-111111111111";
const THEO = "22222222-2222-4222-8222-222222222201";
const PRIYA = "22222222-2222-4222-8222-222222222202";
const SAM = "22222222-2222-4222-8222-222222222203";
const INES = "22222222-2222-4222-8222-222222222204";
export const PURSUIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
export const PURSUIT2_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
/** A finished group Pursuit, for the recap. */
export const PURSUIT3_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
export const SPACE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
export const SPACE_SLUG = "clay-hands";
export const MEDIA_ORIGIN = "https://fixture.supabase.co/storage/v1/object/public/moments";

const NY = "America/New_York";
const nyFmt = new Intl.DateTimeFormat("en-US", { timeZone: NY, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" });
const nyParts = (d: Date) => {
  const p: Record<string, number> = {};
  for (const x of nyFmt.formatToParts(d)) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, hour: p.hour % 24 };
};

/** The moment that is `hour`:`minute` in New York, `dayOffset` days after today there. The calendar QA data is laid out in New York time, whatever the clock. */
export function nyAt(now: Date, dayOffset: number, hour: number, minute = 0): Date {
  const t = nyParts(now);
  const guess = Date.UTC(t.y, t.m - 1, t.d + dayOffset, hour, 0, 0);
  let ms = guess;
  // Two passes settle the offset across a daylight saving change.
  for (let i = 0; i < 2; i++) {
    const p = nyParts(new Date(ms));
    ms += guess - Date.UTC(p.y, p.m - 1, p.d, p.hour, 0, 0);
  }
  return new Date(ms + minute * 60_000);
}

export interface FixtureOptions {
  /**
   * Adds the calendar QA person's week: every window free, a Pottery pick near Gowanus on $50 a month, one block,
   * four Pottery listings on one day (so Not this has somewhere to go) and a group that needs the host's approval.
   * Screenshots only: these rows exist nowhere but in this harness, never in a database.
   */
  calendarQa?: boolean;
}

export function buildFixtures(now = new Date(), opts: FixtureOptions = {}): Fixtures {
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
  }, {
    // Finished with two friends: the recap's grid, gold stub and Keep going.
    id: PURSUIT3_ID, user_id: ME, title: "Sourdough 10 times in 4 weeks", mode: "together", shared: true, hobby_slug: "food-cooking", sub_hobby: "sourdough",
    interest: null, custom_space: null, inspired_by_post_id: null, started_at: ago(30), finished_at: ago(4), paused_at: null, let_go_at: null,
    ending_note: null, cover_image_path: null, cover_image_preference: "first", check_in_days: 7, goal_shape: null, goal_label: null, goal_target_number: null, goal_unit: null,
    goal_verb: null, goal_target_date: null, goal_reached_at: null, goal_current: null, updated_at: ago(4),
    measure: { kind: "count", target: 10, unit: "times", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 },
  }];
  const pursuit_members: Row<"pursuit_members">[] = [
    { pursuit_id: PURSUIT2_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(12) },
    { pursuit_id: PURSUIT_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(30) },
    { pursuit_id: PURSUIT_ID, user_id: INES, role: "member", status: "joined", invited_by: ME, created_at: ago(28) },
    { pursuit_id: PURSUIT_ID, user_id: THEO, role: "member", status: "invited", invited_by: ME, created_at: ago(2) },
    { pursuit_id: PURSUIT3_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(30) },
    { pursuit_id: PURSUIT3_ID, user_id: PRIYA, role: "member", status: "joined", invited_by: ME, created_at: ago(29) },
    { pursuit_id: PURSUIT3_ID, user_id: SAM, role: "member", status: "joined", invited_by: ME, created_at: ago(28) },
  ];
  // Core loop v1, PR 5: a request to join a group you run, the group's next session you have not answered, and your Stubs.
  const PURSUIT4_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4";
  const open_pursuit = { id: PURSUIT4_ID, user_id: ME, title: "Hand-build a mug at home", mode: "group", shared: true, visibility: "open", capacity: 6, ends_at: ahead(24 * 20), hobby_slug: "crafts-making", sub_hobby: "pottery", interest: "Pottery", started_at: ago(3), finished_at: null, paused_at: null, let_go_at: null, cover_image_preference: "first", check_in_days: 7, measure: { kind: "count", target: 3, unit: "times", allowPartial: false, allowDecimals: false, defaultAmount: 1, startingAmount: 0 }, updated_at: ago(1) } as unknown as Row<"pursuits">;
  pursuits.push(open_pursuit);
  pursuit_members.push(
    { pursuit_id: PURSUIT4_ID, user_id: ME, role: "owner", status: "joined", invited_by: null, created_at: ago(3) },
    { pursuit_id: PURSUIT4_ID, user_id: PRIYA, role: "member", status: "requested", invited_by: null, created_at: ago(1) } as Row<"pursuit_members">,
  );
  const pursuit_sessions = [{ id: 1, pursuit_id: PURSUIT_ID, starts_at: ahead(50), place: "Riverside studio", note: null, created_by: ME, created_at: ago(1) }];
  const stubs = [
    { id: 1, user_id: ME, kind: "session", serial: 1, post_id: 2, pursuit_id: PURSUIT_ID, event_id: null, space_id: null, corner_id: null, issued_by: null, issued_at: ago(9) },
    { id: 2, user_id: ME, kind: "event", serial: 2, post_id: null, pursuit_id: null, event_id: 1, space_id: SPACE_ID, corner_id: null, issued_by: THEO, issued_at: ago(6) },
    { id: 3, user_id: ME, kind: "session", serial: 3, post_id: 3, pursuit_id: PURSUIT_ID, event_id: null, space_id: null, corner_id: null, issued_by: null, issued_at: ago(3) },
    { id: 4, user_id: ME, kind: "gold", serial: 4, post_id: null, pursuit_id: PURSUIT3_ID, event_id: null, space_id: null, corner_id: null, issued_by: null, issued_at: ago(4) },
  ];
  const pursuit_plans: Row<"pursuit_plans">[] = [
    { pursuit_id: PURSUIT_ID, user_id: ME, next_session_at: ahead(26), next_session_note: "Trim the three leather-hard bowls, then wedge the next batch", times_per_week: 3, updated_at: ago(1) },
  ];
  const pursuit_progress: Row<"pursuit_progress">[] = [
    ...[2, 3, 1, 5, 6].map((n, i) => ({
      id: `cccccccc-cccc-4ccc-8ccc-cccccccccc0${i}`, pursuit_id: PURSUIT_ID, user_id: ME, amount: i === 3 ? 2 : 1,
      note: ["Bowl number nine. The rim finally sits right.", "Glaze tiles", null, "Two bowls before dinner", "Trimmed and waiting"][i],
      image_url: i % 2 === 0 ? media(n) : null, post_id: n, created_at: ago(14 - i * 3),
    })),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: `cccccccc-cccc-4ccc-8ccc-cccccccccd${i}`, pursuit_id: PURSUIT3_ID, user_id: ME, amount: 1,
      note: null, image_url: media(1 + (i % 6)), post_id: null, created_at: ago(29 - i * 2.5),
    })),
  ];

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
    { id: 1, space_id: SPACE_ID, title: "Open studio night", description: "Bring a bisque piece to glaze. Tea provided.", starts_at: ahead(3), ends_at: ahead(5), timezone: "America/Los_Angeles", meets: "in_person", neighborhood: "Riverside", city: "Portland", featured: true, status: "scheduled", created_by: ME, created_at: ago(5), price: "Rs 1,200", capacity: 8, booking_url: "https://example.com/open-studio" } as Row<"space_events">,
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

  const emptyTables = ["blocks", "bookmarks", "connections", "conversation_reads", "hobby_follows", "post_likes", "post_reflections", "private_logs", "profile_links", "reactions", "reports", "thoughts", "moment_drafts", "pursuit_invite_links", "space_join_requests", "space_host_invites", "space_deletion_requests", "space_deletion_approvals", "event_private_details", "space_private_details", "space_corners", "corners", "category_suggestions", "invites", "waitlist"] as const;
  const empties = Object.fromEntries(emptyTables.map((t) => [t, []])) as Fixtures;
  // Maya follows four people, so Home shows a feed. (The empty Home screen blanks this out in its setup.)
  const profile_follows = [THEO, PRIYA, SAM, INES].map((followed_id) => ({ follower_id: ME, followed_id, status: "accepted", created_at: ago(30), responded_at: ago(30) }));
  const profile_settings: Row<"profile_settings">[] = [];
  const app_config: Row<"app_config">[] = [{ key: "corner_min_moments_30d", value: 3, updated_at: ago(30) }, { key: "trademark_blocklist", value: [], updated_at: ago(30) }];
  const categories: Row<"categories">[] = [{ slug: "crafts-making", name: "Crafts & Making", description: null, examples: null, keywords: null, prompt: null, active: true, sort_order: 1, created_at: ago(200), updated_at: ago(200) }];
  // Everyone in the fixture has accepted the current Terms version, so the
  // Terms prompt stays out of every other screen. The version is read from
  // config.ts (which can't be imported here: it reads import.meta.env).
  const termsVersion = fs.readFileSync(new URL("../../src/app/config.ts", import.meta.url), "utf8").match(/TERMS_VERSION = "([^"]+)"/)?.[1] ?? "";
  const terms_acceptances = profiles.map((p) => ({ user_id: p.id, terms_version: termsVersion, accepted_at: ago(119) }));
  const qa = opts.calendarQa ? calendarQaRows(now) : null;
  const base = {
    ...empties,
    ...({ pursuit_sessions, pursuit_session_rsvps: [], stubs, profile_private: [{ user_id: ME, city: "New York" }] } as unknown as Fixtures),
    profile_follows, terms_acceptances, profiles, posts, pursuits, pursuit_members, pursuit_plans, pursuit_progress, spaces, space_members, space_moments, space_events,
    event_rsvps, participations, messages, notifications, profile_settings, app_config, categories,
  } as unknown as Fixtures;
  if (!qa) return base;
  // The calendar QA person: no other plans in the way, and the rows Stubby's picks are made from.
  return {
    ...base,
    ...({ pursuit_sessions: [], profile_private: qa.profile_private, calendar_entries: qa.calendar_entries, corners: qa.corners, space_corners: qa.space_corners } as unknown as Fixtures),
    spaces: [...spaces, ...qa.spaces],
    space_events: [...space_events, ...qa.space_events],
  } as unknown as Fixtures;
}

/** The calendar QA person. Times are New York wall clock, a few days ahead of whenever the harness runs. */
export const QA_SPACE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2";
function calendarQaRows(now: Date) {
  const at = (day: number, hour: number, minute = 0) => nyAt(now, day, hour, minute);
  const iso = (d: Date) => d.toISOString();
  const ago = (days: number) => new Date(now.getTime() - days * 864e5).toISOString();
  const windows = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].flatMap((d) => [`${d}-day`, `${d}-eve`]);
  const event = (id: number, title: string, day: number, hour: number, minute: number, price: string | null) => ({
    id, space_id: QA_SPACE_ID, title, description: null, starts_at: iso(at(day, hour, minute)), ends_at: iso(at(day, hour + 2, minute)), timezone: "America/New_York",
    meets: "in_person", neighborhood: "Gowanus", city: "New York", featured: false, status: "scheduled", created_by: ME, created_at: ago(2), price, capacity: null, booking_url: null,
  });
  return {
    profile_private: [{ user_id: ME, city: "New York", area: "Gowanus", picks: ["crafts-making/pottery"], free_windows: windows, monthly_budget: 50 }],
    // One block tomorrow evening, with a note.
    calendar_entries: [{ id: 1, user_id: ME, kind: "block", starts_at: iso(at(1, 18)), ends_at: iso(at(1, 20)), repeat: "none", note: "Dentist", created_at: ago(1) }],
    corners: [{ id: 501, space_slug: "crafts-making", slug: "pottery", name: "Pottery" }],
    space_corners: [{ space_id: QA_SPACE_ID, corner_id: 501, is_primary: true }],
    spaces: [{
      id: QA_SPACE_ID, slug: "gowanus-clay", name: "Gowanus Clay", description: "A shared studio in Gowanus.", cover_image: null, category_slug: "crafts-making", meets: "in_person",
      neighborhood: "Gowanus", city: "New York", access: "open", join_questions: [], rules: null, member_cap: null, posting_mode: "immediate", events_created_by: "hosts",
      status: "active", created_by: ME, created_at: ago(90), host_handoff_started_at: null, studio_capacity: null, studio_hourly_rate: null, studio_hours: null,
    }] as Row<"spaces">[],
    // Four listings two days from now, all inside the budget, so Not this can swap three times; one over budget later in the week.
    space_events: [
      event(101, "Kiln open day", 2, 11, 0, "$15"),
      event(102, "Hand-building basics", 2, 14, 0, "$30"),
      event(103, "Wheel throwing night", 2, 18, 30, "$25"),
      event(104, "Glaze swap", 2, 20, 30, "Free"),
      event(105, "Raku firing", 4, 15, 0, "$80"),
    ] as Row<"space_events">[],
  };
}
