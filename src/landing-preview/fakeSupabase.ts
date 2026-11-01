/**
 * An in-memory stand-in for the Supabase client, used ONLY in
 * `--mode landing-preview` (see vite.config.ts), so the app's real components
 * can be rendered with example data for the landing-page screenshots.
 *
 * It has no network code at all: nothing here can read or write a real
 * database. Tables not listed in `tables` answer with an empty result, and
 * every write succeeds without storing anything.
 */
import { TERMS_VERSION } from "../app/config";
import { MAYA, cornerActivity, cornerRows, notifications, ownPrivate, posts, profileFollows, profiles, pursuits } from "./fixtures";

type Row = Record<string, any>;

/** The signed-in example person. */
const ME = MAYA;

const tables: Record<string, Row[]> = {
  profiles,
  posts,
  corners: cornerRows,
  pursuits,
  notifications,
  profile_follows: profileFollows,
  // Maya has accepted the current Terms, so no gate dialog covers the screens.
  terms_acceptances: [{ user_id: ME, terms_version: TERMS_VERSION, accepted_at: new Date().toISOString() }],
};

const session = {
  access_token: "preview",
  refresh_token: "preview",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: {
    id: ME,
    aud: "authenticated",
    role: "authenticated",
    email: "preview-account@preview.invalid",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  },
};

const cmp = (a: any, b: any) => (a < b ? -1 : a > b ? 1 : 0);

class Query implements PromiseLike<{ data: any; error: null; count?: number }> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: { col: string; asc: boolean }[] = [];
  private max: number | null = null;
  private mode: "many" | "maybe" | "single" = "many";
  private head = false;
  private writing = false;

  constructor(private rows: Row[]) {}

  select(_cols?: string, opts?: { head?: boolean }) {
    if (opts?.head) this.head = true;
    return this;
  }
  insert(_v?: unknown) { this.writing = true; return this; }
  upsert(_v?: unknown, _o?: unknown) { this.writing = true; return this; }
  update(_v?: unknown) { this.writing = true; return this; }
  delete() { this.writing = true; return this; }

  eq(col: string, v: any) { this.filters.push((r) => r[col] === v); return this; }
  neq(col: string, v: any) { this.filters.push((r) => r[col] !== v); return this; }
  in(col: string, vs: any[]) { this.filters.push((r) => vs.includes(r[col])); return this; }
  is(col: string, v: any) { this.filters.push((r) => (v === null ? r[col] == null : r[col] === v)); return this; }
  not(col: string, op: string, v: any) {
    if (op === "is") this.filters.push((r) => (v === null ? r[col] != null : r[col] !== v));
    return this;
  }
  gt(col: string, v: any) { this.filters.push((r) => cmp(r[col], v) > 0); return this; }
  gte(col: string, v: any) { this.filters.push((r) => cmp(r[col], v) >= 0); return this; }
  lt(col: string, v: any) { this.filters.push((r) => cmp(r[col], v) < 0); return this; }
  lte(col: string, v: any) { this.filters.push((r) => cmp(r[col], v) <= 0); return this; }
  ilike(col: string, pattern: string) {
    const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$", "i");
    this.filters.push((r) => re.test(String(r[col] ?? "")));
    return this;
  }
  like(col: string, pattern: string) { return this.ilike(col, pattern); }
  or(_expr: string) { return this; }
  contains(_c: string, _v: unknown) { return this; }
  overlaps(_c: string, _v: unknown) { return this; }
  match(obj: Row) { for (const [k, v] of Object.entries(obj)) this.eq(k, v); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orders.push({ col, asc: opts?.ascending !== false }); return this; }
  limit(n: number) { this.max = n; return this; }
  range(from: number, to: number) { this.max = to - from + 1; return this; }
  abortSignal() { return this; }
  maybeSingle() { this.mode = "maybe"; return this; }
  single() { this.mode = "single"; return this; }

  private run() {
    if (this.writing) return { data: null, error: null };
    let out = this.rows.filter((r) => this.filters.every((f) => f(r)));
    for (const o of [...this.orders].reverse()) {
      out = [...out].sort((a, b) => (o.asc ? 1 : -1) * cmp(a[o.col], b[o.col]));
    }
    if (this.max != null) out = out.slice(0, this.max);
    const count = out.length;
    if (this.head) return { data: null, error: null, count };
    if (this.mode === "many") return { data: out, error: null, count };
    return { data: out[0] ?? null, error: null, count };
  }

  then<R1 = any, R2 = never>(
    onfulfilled?: ((v: { data: any; error: null; count?: number }) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null,
  ) {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }
}

const mayaPosts = () => posts.filter((p) => p.user_id === ME);

/** Which kind of viewer the profile page is shown to (localStorage "preview-profile-role"); the owner by default. */
const previewRole = (): string => {
  try {
    return localStorage.getItem("preview-profile-role") ?? "owner";
  } catch {
    return "owner";
  }
};

/** Preview-only switches (localStorage): "preview-empty" empties the three tabs, "preview-planning" = "filled" fills Your planning, "preview-plan" = "none" leaves no shared times, "preview-signed-out" = "1" removes the session. */
const flag = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const identity = { id: ME, username: "maya", displayName: "Maya Lin", avatarUrl: null, followState: "none" };
const open = {
  ...identity,
  private: false,
  neighborhood: "Greenpoint, Brooklyn",
  bio: "Half marathon in the spring. Sourdough on Sundays.",
  stubCount: 8,
  pursuitCount: 3,
  friendCount: 2,
  level: { index: 4, name: "Weekend Regular" },
};
const previewProfile = (): unknown => {
  switch (previewRole()) {
    case "friend":
      return { ...open, role: "friend", followState: "accepted", followsYou: true, planningPaused: false, mutualFriendCount: 3, sharedCategories: ["Running", "Baking"], mutualFriends: [{ id: "m1", name: "Sam R.", avatarUrl: null }, { id: "m2", name: "Jo K.", avatarUrl: null }, { id: "m3", name: "Ana P.", avatarUrl: null }] };
    case "follower":
      return { ...open, role: "follower", followState: "accepted", followsYou: false, mutualFriendCount: 1 };
    case "public":
      return { ...open, role: "public", followsYou: false };
    case "private":
      return { ...identity, role: "public", private: true, levelName: "Weekend Regular" };
    case "blocked":
      return null;
    case "new":
      return { ...open, role: "owner", neighborhood: null, bio: null, stubCount: 0, pursuitCount: 0, friendCount: 0, level: { index: 1, name: "Just Getting Started" }, stubsToNext: 1, planningPaused: false, isPrivate: false };
    default:
      return { ...open, role: "owner", stubsToNext: 2, planningPaused: false, isPrivate: false };
  }
};
const previewMoments = () => {
  const role = previewRole();
  if (role === "new" || flag("preview-empty") === "1") return { total: 0, items: [] };
  const rows = mayaPosts();
  return {
    total: rows.length,
    items: rows.map((p) =>
      role === "owner"
        ? { id: p.id, photoUrl: p.media_url, caption: p.caption, category: p.corner, occurredAt: p.created_at ?? new Date().toISOString(), placeName: "Domino Park", neighborhood: "Williamsburg", visibleAt: null }
        : { id: p.id, photoUrl: p.media_url, caption: p.caption, category: p.corner, date: String(p.created_at ?? new Date().toISOString()).slice(0, 10), neighborhood: "Williamsburg" },
    ),
  };
};
const previewPursuits = () => {
  const role = previewRole();
  if (role === "new" || flag("preview-empty") === "1") return [];
  const own = role === "owner";
  return [
    { id: "pu1", category: "Running", goal: "Half marathon", target: 5, momentCount: 2, stubCount: 2, finished: false, archived: false, lastMomentDate: own ? "2026-10-24T19:00:00Z" : null, finishedAt: null, sharedWithYou: role === "friend" },
    { id: "pu2", category: "Baking", goal: "Sourdough, 10 loaves", target: null, momentCount: 10, stubCount: 1, finished: true, archived: false, lastMomentDate: null, finishedAt: own ? "2026-10-12" : "2026-10", sharedWithYou: role === "friend" },
  ];
};
const previewStubs = () =>
  previewRole() === "new" || flag("preview-empty") === "1" ? [] : [{ id: 1, kind: "finish", cornerKey: "sports-fitness/running", day: "2026-10-24", pinned: false, title: "Eleven miles along the river", ...(previewRole() === "owner" ? { serial: 1 } : {}) }];

const rpcResults: Record<string, (args: any) => any> = {
  my_profile_private: () => [ownPrivate(ME)],
  get_profile: () => previewProfile(),
  get_profile_moments: () => previewMoments(),
  get_profile_stubs: () => previewStubs(),
  get_profile_pursuits: () => previewPursuits(),
  get_my_planning: () =>
    flag("preview-planning") === "filled"
      ? {
          availability: [{ day: "thu", part: "evening" }, { day: "sat", part: "morning" }, { day: "sat", part: "afternoon" }, { day: "sun", part: "morning" }, { day: "sun", part: "afternoon" }],
          freeHoursPerWeek: 9,
          monthlyBudgetCents: 10000,
          memberships: [{ name: "Brooklyn Boulders", monthly_cost_cents: 9000 }, { name: "Greenpoint Pottery Studio", monthly_cost_cents: 12000 }],
          shareMembershipsWithFriends: true,
          calendarConnected: false,
          planningPaused: false,
        }
      : {
          availability: [],
          freeHoursPerWeek: null,
          monthlyBudgetCents: null,
          memberships: [],
          shareMembershipsWithFriends: true,
          calendarConnected: false,
          planningPaused: false,
        },
  suggest_plan: () =>
    flag("preview-plan") === "none"
      ? { status: "ok", slots: [], categories: ["Something new"] }
      : {
    status: "ok",
    slots: [{ date: "2026-11-07", part: "afternoon" }, { date: "2026-11-08", part: "evening" }],
    categories: ["Running", "Baking", "Something new"],
    place: { name: "Brooklyn Boulders", note: "You both have memberships here" },
  },
  corner_activity_30d: () => cornerActivity,
};

const channel = () => {
  const c: any = { on: () => c, subscribe: () => c, unsubscribe: () => {}, send: () => {} };
  return c;
};

export const isSupabaseConfigured = true;

export const supabase: any = {
  from: (table: string) => new Query(tables[table] ?? []),
  rpc: (name: string, args: any) => {
    const fn = rpcResults[name];
    return Promise.resolve({ data: fn ? fn(args) : [], error: null });
  },
  auth: {
    getSession: async () => ({ data: { session: flag("preview-signed-out") === "1" ? null : session }, error: null }),
    getUser: async () => ({ data: { user: flag("preview-signed-out") === "1" ? null : session.user }, error: null }),
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      setTimeout(() => cb("INITIAL_SESSION", flag("preview-signed-out") === "1" ? null : session), 0);
      return { data: { subscription: { unsubscribe() {} } } };
    },
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: session.user }, error: null }),
  },
  storage: {
    from: () => ({
      getPublicUrl: (p: string) => ({ data: { publicUrl: p } }),
      createSignedUrl: async (p: string) => ({ data: { signedUrl: p }, error: null }),
      createSignedUrls: async (ps: string[]) => ({ data: ps.map((p) => ({ path: p, signedUrl: p, error: null })), error: null }),
      upload: async () => ({ data: { path: "preview" }, error: null }),
      remove: async () => ({ data: [], error: null }),
      list: async () => ({ data: [], error: null }),
    }),
  },
  channel,
  removeChannel: async () => "ok",
};
