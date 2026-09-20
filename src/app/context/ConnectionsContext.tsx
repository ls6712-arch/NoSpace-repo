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
import { getCircle } from "../data/circles";

/**
 * Real, cross-account Circle membership — invite and accept, backed by
 * sql/circle-invites.sql.
 *
 * This context used to also cover person-to-person connections, user-made
 * Spaces, and the direct messaging both unlocked (PersonActions' Explore/
 * Connect/Invite). All three were retired together: connections and
 * messaging had no other caller once PersonActions went away, and the
 * person-level relationship Follow now needs (sql/profile-follows.sql,
 * src/app/lib/profileFollows.ts) is a separate, accept-based follow, not a
 * revival of the old mutual connection. Circle invites survive here because
 * Circles.tsx, CirclesJoined.tsx, and CircleBoard.tsx all read real
 * membership from this context independently of PersonActions.
 */
export interface CircleMembership {
  id: number | string;
  circleId: number;
  userId: string;
  status: "invited" | "joined" | "declined";
  invitedBy?: string;
  invitedByName?: string;
  note?: string;
  createdAt: number;
}

export interface Person {
  id: string;
  displayName: string;
  username?: string | null;
  avatarUrl?: string;
}

interface ConnectionsContextType {
  ready: boolean;
  /** True when there's a real account behind this — otherwise everything is read-only. */
  live: boolean;

  /** Circle ids you've really joined — via an invitation you accepted, not
   * the local-only direct Join button (ContentContext's isCircleJoined). */
  myCircleIds: number[];
  circleInvitations: CircleMembership[];
  inviteToCircle: (
    circleId: number,
    personId: string,
    note?: string,
  ) => Promise<{ error: string | null }>;
  respondToCircleInvitation: (circleId: number, accept: boolean) => Promise<void>;
  /** Leaves a Circle you joined via a real, accepted invitation. The
   * purely local direct-join path has its own leaveCircle in ContentContext
   * and never touches this table, so there's nothing to reconcile here. */
  leaveCircleInvite: (circleId: number) => Promise<void>;

  refresh: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const live = !!supabase && !!user;

  const [ready, setReady] = useState(false);
  const [circleMembers, setCircleMembers] = useState<CircleMembership[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});

  /* ── Reading ────────────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setCircleMembers([]);
      setReady(true);
      return;
    }

    try {
      // RLS already scopes this to rows where I'm the invitee or the
      // inviter — no need to filter client-side too.
      const { data: circleRows } = await supabase.from("circle_invites").select("*");
      const circleMemberRows = (circleRows ?? []) as any[];

      // Names and faces for everyone who invited me.
      const ids = new Set<string>();
      for (const c of circleMemberRows) if (c.invited_by) ids.add(c.invited_by);
      ids.delete(user.id);

      let byId: Record<string, Person> = {};
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", [...ids]);
        for (const p of (profs ?? []) as any[]) {
          byId[p.id] = {
            id: p.id,
            displayName: p.display_name?.trim() || "A member who's away",
            username: p.username,
            avatarUrl: p.avatar_url ?? undefined,
          };
        }
      }
      setPeople(byId);

      setCircleMembers(
        circleMemberRows.map((c) => ({
          id: c.id,
          circleId: c.circle_id,
          userId: c.user_id,
          status: c.status,
          invitedBy: c.invited_by ?? undefined,
          invitedByName: c.invited_by ? byId[c.invited_by]?.displayName : undefined,
          note: c.note ?? undefined,
          createdAt: new Date(c.created_at).getTime(),
        })),
      );
    } catch {
      // Offline or misconfigured. Everything below reads as "nothing yet"
      // rather than hanging, and a later refresh picks it up.
    }
    setReady(true);
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── Circles ────────────────────────────────────────────────────────── */
  //
  // Circles (data/circles.ts) are static seed data with no owner and no
  // creation flow of their own — unlike a Space, there's nothing here to
  // "make." Only invite-and-accept membership lives in this context; the
  // Circle's own name, purpose, and static baseline member count still come
  // straight from that file wherever they're rendered.

  const myCircleIds = circleMembers
    .filter((c) => c.userId === user?.id && c.status === "joined")
    .map((c) => c.circleId);
  const circleInvitations = circleMembers.filter(
    (c) => c.userId === user?.id && c.status === "invited",
  );

  const inviteToCircle = async (circleId: number, personId: string, note?: string) => {
    if (!supabase || !user) return { error: "Sign in to invite people." };
    if (personId === user.id) return { error: "You're already in it." };

    const { error } = await supabase.from("circle_invites").insert({
      circle_id: circleId,
      user_id: personId,
      status: "invited",
      invited_by: user.id,
      note: note?.trim() ? note.trim().slice(0, 200) : null,
    });
    if (error) {
      return {
        error: /duplicate|unique/i.test(error.message)
          ? "They've already been invited."
          : error.message,
      };
    }

    const circle = getCircle(circleId);
    const me = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    await supabase.from("notifications").insert({
      user_id: personId,
      kind: "circle_invite",
      actor_name: (me.data as any)?.display_name?.trim() || "Someone",
      body: `invited you to ${circle?.name ?? "a Circle"}.`,
      href: "/inbox",
    });
    await refresh();
    return { error: null };
  };

  const respondToCircleInvitation = async (circleId: number, accept: boolean) => {
    if (!supabase || !user) return;
    await supabase
      .from("circle_invites")
      .update({ status: accept ? "joined" : "declined" })
      .eq("circle_id", circleId)
      .eq("user_id", user.id);
    await refresh();
  };

  const leaveCircleInvite = async (circleId: number) => {
    if (!supabase || !user) return;
    await supabase
      .from("circle_invites")
      .delete()
      .eq("circle_id", circleId)
      .eq("user_id", user.id);
    await refresh();
  };

  return (
    <ConnectionsContext.Provider
      value={{
        ready,
        live,
        myCircleIds,
        circleInvitations,
        inviteToCircle,
        respondToCircleInvitation,
        leaveCircleInvite,
        refresh,
      }}
    >
      {children}
    </ConnectionsContext.Provider>
  );
}

export function useConnections() {
  const ctx = useContext(ConnectionsContext);
  if (!ctx) throw new Error("useConnections must be used inside ConnectionsProvider");
  return ctx;
}
