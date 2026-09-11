import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { useContent } from "./ContentContext";
import {
  Circle,
  circles as seedCircles,
  getCircle as getSeedCircle,
  circlesByHobby as seedCirclesByHobby,
} from "../data/circles";

/**
 * Real, Supabase-backed Circles (sql/circles.sql) — a name, an owner, and a
 * roster other accounts can actually see, on top of the hand-written seed
 * Circles in data/circles.ts, which this never touches.
 *
 * Real circle ids get offset by 1,000,000 so they can share one `Circle[]`
 * list with the seed circles (ids 1–10-ish) without colliding — every id
 * this context ever hands back out to the rest of the app is already
 * offset; the raw database id only exists inside this file, right at the
 * two places (insert/select against `circles`/`circle_members`) that need
 * it. Don't "fix" this by renumbering the seed data or dropping the offset
 * — that's what keeps a bookmarked `/circles/3` (a seed Circle) and a real
 * Circle whose database id also happens to be 3 from ever pointing at the
 * same page.
 */

const REAL_CIRCLE_ID_OFFSET = 1_000_000;

export interface CircleMember {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  role: "owner" | "member";
  joinedAt: number;
}

export interface NewCircleInput {
  hobbySlug: string;
  name: string;
  location?: string;
  purpose: string;
  prompt: string;
  visibility: "Open to read" | "Members only";
}

interface RealCircleRow {
  id: number;
  owner: string;
  hobby_slug: string;
  name: string;
  location: string | null;
  description: string;
  purpose: string;
  prompt: string;
  rules: string[] | null;
  visibility: "Open to read" | "Members only";
}

interface CirclesContextType {
  /** Seed circles and real circles together, real ones already offset. */
  circles: Circle[];
  getCircle: (id: number) => Circle | undefined;
  circlesByHobby: (slug: string) => Circle[];
  isRealCircle: (id: number) => boolean;
  /** Ids (offset) of every real Circle the signed-in user has actually joined. */
  myRealCircleIds: number[];
  isMemberOfReal: (id: number) => boolean;
  /** On-demand — only the roster's own select policy (member or owner)
   * ever returns real rows; anyone else gets an empty list back. */
  fetchRoster: (id: number) => Promise<CircleMember[]>;
  createCircle: (input: NewCircleInput) => Promise<{ circle: Circle | null; error: string | null }>;
  joinRealCircle: (id: number) => Promise<{ error: string | null }>;
  leaveRealCircle: (id: number) => Promise<{ error: string | null }>;
  loading: boolean;
}

const CirclesContext = createContext<CirclesContextType | undefined>(undefined);

export function CirclesProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { circleFeed } = useContent();

  const [rows, setRows] = useState<RealCircleRow[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [ownerNames, setOwnerNames] = useState<Record<string, string>>({});
  const [myRealCircleIds, setMyRealCircleIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [circlesRes, countsRes] = await Promise.all([
      supabase.from("circles").select("*").order("created_at", { ascending: false }),
      supabase.rpc("real_circle_member_counts"),
    ]);

    const circleRows = (circlesRes.data ?? []) as RealCircleRow[];
    setRows(circleRows);

    const nextCounts: Record<number, number> = {};
    for (const row of (countsRes.data ?? []) as any[]) {
      nextCounts[row.circle_id] = Number(row.member_count) || 0;
    }
    setCounts(nextCounts);

    const ownerIds = [...new Set(circleRows.map((r) => r.owner))];
    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", ownerIds);
      const names: Record<string, string> = {};
      for (const p of (profiles ?? []) as any[]) names[p.id] = p.display_name?.trim() || "Someone";
      setOwnerNames(names);
    }

    if (user) {
      const { data: mine } = await supabase
        .from("circle_members")
        .select("circle_id")
        .eq("user_id", user.id);
      setMyRealCircleIds(((mine ?? []) as any[]).map((m) => m.circle_id + REAL_CIRCLE_ID_OFFSET));
    } else {
      setMyRealCircleIds([]);
    }

    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activityFor = (offsetId: number): Circle["activity"] => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = circleFeed(offsetId).filter((p) => p.createdAt >= weekAgo).length;
    if (recent === 0) return "Quiet";
    if (recent < 5) return "Steady";
    return "Busy";
  };

  const realCircles: Circle[] = rows.map((row) => {
    const offsetId = row.id + REAL_CIRCLE_ID_OFFSET;
    return {
      id: offsetId,
      hobbySlug: row.hobby_slug,
      name: row.name,
      location: row.location ?? undefined,
      description: row.description,
      memberCount: counts[row.id] ?? 0,
      purpose: row.purpose,
      activity: activityFor(offsetId),
      prompt: row.prompt,
      rules: row.rules ?? [],
      moderators: [ownerNames[row.owner] ?? "Someone"],
      visibility: row.visibility,
      ownerId: row.owner,
    };
  });

  const circles = [...seedCircles, ...realCircles];

  const isRealCircle = (id: number) => id >= REAL_CIRCLE_ID_OFFSET;

  const getCircle = (id: number) =>
    isRealCircle(id) ? realCircles.find((c) => c.id === id) : getSeedCircle(id);

  const circlesByHobby = (slug: string) => [
    ...seedCirclesByHobby(slug),
    ...realCircles.filter((c) => c.hobbySlug === slug),
  ];

  const isMemberOfReal = (id: number) => myRealCircleIds.includes(id);

  const fetchRoster = useCallback(async (id: number): Promise<CircleMember[]> => {
    if (!supabase || !isRealCircle(id)) return [];
    const rawId = id - REAL_CIRCLE_ID_OFFSET;
    const { data } = await supabase
      .from("circle_members")
      .select("user_id, role, joined_at")
      .eq("circle_id", rawId)
      .order("joined_at", { ascending: true });
    const memberRows = (data ?? []) as any[];
    if (memberRows.length === 0) return [];

    const ids = memberRows.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", ids);
    const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return memberRows.map((m) => ({
      userId: m.user_id,
      displayName: byId.get(m.user_id)?.display_name?.trim() || "Someone",
      avatarUrl: byId.get(m.user_id)?.avatar_url ?? undefined,
      role: m.role,
      joinedAt: new Date(m.joined_at).getTime(),
    }));
  }, []);

  const createCircle = async (
    input: NewCircleInput,
  ): Promise<{ circle: Circle | null; error: string | null }> => {
    if (!supabase || !user) return { circle: null, error: "Sign in to create a Circle." };

    const { data, error } = await supabase
      .from("circles")
      .insert({
        owner: user.id,
        hobby_slug: input.hobbySlug,
        name: input.name.trim(),
        location: input.location?.trim() || null,
        description: input.purpose.trim(),
        purpose: input.purpose.trim(),
        prompt: input.prompt.trim() || "What are you working on this week?",
        visibility: input.visibility,
      })
      .select()
      .single();

    if (error || !data) {
      return {
        circle: null,
        error: /recursion/i.test(error?.message ?? "")
          ? "The database is rejecting Circle queries. Run sql/circles.sql in Supabase."
          : (error?.message ?? "Couldn't create that Circle."),
      };
    }

    // The owner is a member too, same two-row pattern createSpace uses —
    // one rule (is_circle_member/owns_circle) covers both from here on.
    await supabase.from("circle_members").insert({
      circle_id: data.id,
      user_id: user.id,
      role: "owner",
    });

    await refresh();
    return {
      circle: {
        id: data.id + REAL_CIRCLE_ID_OFFSET,
        hobbySlug: data.hobby_slug,
        name: data.name,
        location: data.location ?? undefined,
        description: data.description,
        memberCount: 1,
        purpose: data.purpose,
        activity: "Quiet",
        prompt: data.prompt,
        rules: data.rules ?? [],
        moderators: [profile?.display_name?.trim() || "You"],
        visibility: data.visibility,
        ownerId: data.owner,
      },
      error: null,
    };
  };

  const joinRealCircle = async (id: number): Promise<{ error: string | null }> => {
    if (!supabase || !user) return { error: "Sign in to join a Circle." };
    const rawId = id - REAL_CIRCLE_ID_OFFSET;
    const { error } = await supabase
      .from("circle_members")
      .insert({ circle_id: rawId, user_id: user.id, role: "member" });
    if (error) {
      return {
        error: /duplicate|unique/i.test(error.message) ? "You're already in this Circle." : error.message,
      };
    }
    await refresh();
    return { error: null };
  };

  const leaveRealCircle = async (id: number): Promise<{ error: string | null }> => {
    if (!supabase || !user) return { error: "Sign in first." };
    const rawId = id - REAL_CIRCLE_ID_OFFSET;
    const { error } = await supabase
      .from("circle_members")
      .delete()
      .eq("circle_id", rawId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  };

  return (
    <CirclesContext.Provider
      value={{
        circles,
        getCircle,
        circlesByHobby,
        isRealCircle,
        myRealCircleIds,
        isMemberOfReal,
        fetchRoster,
        createCircle,
        joinRealCircle,
        leaveRealCircle,
        loading,
      }}
    >
      {children}
    </CirclesContext.Provider>
  );
}

export function useCircles() {
  const ctx = useContext(CirclesContext);
  if (!ctx) throw new Error("useCircles must be used within a CirclesProvider");
  return ctx;
}
