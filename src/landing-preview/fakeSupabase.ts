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
const rpcResults: Record<string, (args: any) => any> = {
  my_profile_private: () => [ownPrivate(ME)],
  get_profile: () => ({
    role: "owner",
    id: ME,
    username: "maya",
    displayName: "Maya",
    avatarUrl: null,
    followState: "none",
    private: false,
    neighborhood: "Greenpoint, Brooklyn",
    bio: "Half marathon in the spring. Sourdough on Sundays.",
    stubCount: 8,
    pursuitCount: 3,
    friendCount: 2,
    level: { index: 4, name: "Weekend Regular" },
    stubsToNext: 2,
    planningPaused: false,
    isPrivate: false,
  }),
  get_profile_moments: () => ({
    total: mayaPosts().length,
    items: mayaPosts().map((p) => ({
      id: p.id,
      photoUrl: p.media_url,
      caption: p.caption,
      category: p.corner,
      occurredAt: p.created_at ?? new Date().toISOString(),
      placeName: null,
      neighborhood: null,
      visibleAt: null,
    })),
  }),
  get_profile_stubs: () => [],
  get_profile_pursuits: () => [],
  get_my_planning: () => ({
    availability: [],
    freeHoursPerWeek: null,
    monthlyBudgetCents: null,
    memberships: [],
    shareMembershipsWithFriends: true,
    calendarConnected: false,
    planningPaused: false,
  }),
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
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: session.user }, error: null }),
    onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
      setTimeout(() => cb("INITIAL_SESSION", session), 0);
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
