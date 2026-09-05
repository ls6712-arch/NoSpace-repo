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

/**
 * Connections, Spaces people make, and the messages both of them unlock.
 *
 * One rule holds the whole thing together: nothing private happens between
 * two people until both have said yes. A profile is a public portfolio and a
 * private place to be reached — anyone can look at the work, nobody can write
 * to you uninvited. Messaging is a consequence of an accepted connection or a
 * joined Space, never a thing you can do to a stranger.
 *
 * That's also why this is a separate context from SocialContext, which
 * handles the hobby-shaped things: exploring a hobby, joining an activity,
 * leaving a thought. Those need no permission from anyone. These do.
 */
export type ConnectionStatus = "none" | "pending_out" | "pending_in" | "connected" | "declined";

export interface Connection {
  id: number | string;
  requester: string;
  addressee: string;
  requesterName?: string;
  addresseeName?: string;
  requesterAvatar?: string;
  addresseeAvatar?: string;
  note?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface Space {
  id: number | string;
  owner: string;
  name: string;
  description?: string;
  hobbySlug?: string;
  interest?: string;
  visibility: "invite" | "open";
  /** Your own standing in it. */
  myStatus?: "invited" | "joined" | "declined" | "owner";
  invitedBy?: string;
  invitedByName?: string;
  note?: string;
  memberCount?: number;
}

export interface DirectMessage {
  id: number | string;
  fromUser: string;
  toUser?: string;
  spaceId?: number | string;
  body: string;
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

  connections: Connection[];
  /** Everyone you've accepted, as people. */
  connectedPeople: Person[];
  statusWith: (personId: string) => ConnectionStatus;
  connectionWith: (personId: string) => Connection | undefined;
  requestConnection: (
    personId: string,
    note?: string,
  ) => Promise<{ error: string | null }>;
  respondToConnection: (id: number | string, accept: boolean) => Promise<void>;
  withdrawConnection: (id: number | string) => Promise<void>;

  spaces: Space[];
  /** Spaces you've actually joined, so you can invite into them. */
  mySpaces: Space[];
  spaceInvitations: Space[];
  createSpace: (input: {
    name: string;
    description?: string;
    hobbySlug?: string;
    interest?: string;
  }) => Promise<Space | null>;
  inviteToSpace: (
    spaceId: number | string,
    personId: string,
    note?: string,
  ) => Promise<{ error: string | null }>;
  respondToInvitation: (spaceId: number | string, accept: boolean) => Promise<void>;

  messages: DirectMessage[];
  messagesWith: (personId: string) => DirectMessage[];
  canMessage: (personId: string) => boolean;
  sendMessage: (personId: string, body: string) => Promise<{ error: string | null }>;

  refresh: () => Promise<void>;
}

const ConnectionsContext = createContext<ConnectionsContextType | undefined>(undefined);

export function ConnectionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const live = !!supabase && !!user;

  const [ready, setReady] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});

  /* ── Reading ────────────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setConnections([]);
      setSpaces([]);
      setMessages([]);
      setReady(true);
      return;
    }

    try {
      const [conns, memberships, msgs] = await Promise.all([
        supabase
          .from("connections")
          .select("*")
          .or(`requester.eq.${user.id},addressee.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase.from("space_members").select("*").eq("user_id", user.id),
        supabase
          .from("messages")
          .select("*")
          .order("created_at", { ascending: true })
          .limit(500),
      ]);

      const connRows = (conns.data ?? []) as any[];
      const memberRows = (memberships.data ?? []) as any[];

      // Names and faces for everyone involved, in one query.
      const ids = new Set<string>();
      for (const c of connRows) {
        ids.add(c.requester);
        ids.add(c.addressee);
      }
      for (const m of memberRows) if (m.invited_by) ids.add(m.invited_by);
      for (const m of (msgs.data ?? []) as any[]) {
        ids.add(m.from_user);
        if (m.to_user) ids.add(m.to_user);
      }
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
            displayName: p.display_name?.trim() || "Someone",
            username: p.username,
            avatarUrl: p.avatar_url ?? undefined,
          };
        }
      }
      setPeople(byId);

      setConnections(
        connRows.map((c) => ({
          id: c.id,
          requester: c.requester,
          addressee: c.addressee,
          requesterName: byId[c.requester]?.displayName,
          addresseeName: byId[c.addressee]?.displayName,
          requesterAvatar: byId[c.requester]?.avatarUrl,
          addresseeAvatar: byId[c.addressee]?.avatarUrl,
          note: c.note ?? undefined,
          status: c.status,
          createdAt: new Date(c.created_at).getTime(),
        })),
      );

      // The Spaces behind those memberships.
      const spaceIds = memberRows.map((m) => m.space_id);
      let spaceRows: any[] = [];
      if (spaceIds.length > 0) {
        const { data } = await supabase.from("spaces").select("*").in("id", spaceIds);
        spaceRows = (data ?? []) as any[];
      }
      const { data: owned } = await supabase.from("spaces").select("*").eq("owner", user.id);
      for (const s of (owned ?? []) as any[]) {
        if (!spaceRows.some((r) => r.id === s.id)) spaceRows.push(s);
      }

      setSpaces(
        spaceRows.map((s) => {
          const mine = memberRows.find((m) => m.space_id === s.id);
          return {
            id: s.id,
            owner: s.owner,
            name: s.name,
            description: s.description ?? undefined,
            hobbySlug: s.hobby_slug ?? undefined,
            interest: s.interest ?? undefined,
            visibility: s.visibility,
            myStatus: s.owner === user.id ? "owner" : (mine?.status as Space["myStatus"]),
            invitedBy: mine?.invited_by ?? undefined,
            invitedByName: mine?.invited_by ? byId[mine.invited_by]?.displayName : undefined,
            note: mine?.note ?? undefined,
          };
        }),
      );

      setMessages(
        ((msgs.data ?? []) as any[]).map((m) => ({
          id: m.id,
          fromUser: m.from_user,
          toUser: m.to_user ?? undefined,
          spaceId: m.space_id ?? undefined,
          body: m.body,
          createdAt: new Date(m.created_at).getTime(),
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

  /* ── Connections ────────────────────────────────────────────────────── */

  const connectionWith = (personId: string) =>
    connections.find(
      (c) =>
        (c.requester === personId || c.addressee === personId) && c.status !== "declined",
    ) ??
    connections.find((c) => c.requester === personId || c.addressee === personId);

  const statusWith = (personId: string): ConnectionStatus => {
    if (!user || personId === user.id) return "none";
    const c = connectionWith(personId);
    if (!c) return "none";
    if (c.status === "accepted") return "connected";
    if (c.status === "declined") return "declined";
    return c.requester === user.id ? "pending_out" : "pending_in";
  };

  const connectedPeople: Person[] = connections
    .filter((c) => c.status === "accepted")
    .map((c) => {
      const otherId = c.requester === user?.id ? c.addressee : c.requester;
      return people[otherId] ?? { id: otherId, displayName: "Someone" };
    });

  const requestConnection = async (personId: string, note?: string) => {
    if (!supabase || !user) return { error: "Sign in to connect with people." };
    if (personId === user.id) return { error: "That's you." };
    const existing = statusWith(personId);
    if (existing === "connected") return { error: "You're already connected." };
    if (existing === "pending_out") return { error: "You've already asked." };

    const { error } = await supabase.from("connections").insert({
      requester: user.id,
      addressee: personId,
      note: note?.trim() ? note.trim().slice(0, 200) : null,
    });
    if (error) return { error: error.message };

    await supabase.from("notifications").insert({
      user_id: personId,
      kind: "connect_request",
      body: note?.trim()
        ? `wants to connect: "${note.trim().slice(0, 120)}"`
        : "wants to connect with you.",
      href: "/inbox",
    });
    await refresh();
    return { error: null };
  };

  const respondToConnection = async (id: number | string, accept: boolean) => {
    if (!supabase || !user) return;
    const target = connections.find((c) => c.id === id);
    // Only the person who was asked can answer — the database enforces this
    // too, but failing here gives a clearer result than a rejected write.
    if (!target || target.addressee !== user.id) return;

    await supabase
      .from("connections")
      .update({
        status: accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (accept) {
      await supabase.from("notifications").insert({
        user_id: target.requester,
        kind: "connect_accepted",
        body: "accepted your connection. You can message each other now.",
        href: "/inbox",
      });
    }
    await refresh();
  };

  const withdrawConnection = async (id: number | string) => {
    if (!supabase || !user) return;
    await supabase.from("connections").delete().eq("id", id);
    await refresh();
  };

  /* ── Spaces ─────────────────────────────────────────────────────────── */

  const mySpaces = spaces.filter((s) => s.myStatus === "joined" || s.myStatus === "owner");
  const spaceInvitations = spaces.filter((s) => s.myStatus === "invited");

  const createSpace: ConnectionsContextType["createSpace"] = async (input) => {
    if (!supabase || !user) return null;
    const { data, error } = await supabase
      .from("spaces")
      .insert({
        owner: user.id,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        hobby_slug: input.hobbySlug ?? null,
        interest: input.interest?.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return null;

    // The owner is a member too, so one rule covers who can post and invite.
    await supabase.from("space_members").insert({
      space_id: data.id,
      user_id: user.id,
      role: "owner",
      status: "joined",
      invited_by: user.id,
    });
    await refresh();
    return {
      id: data.id,
      owner: data.owner,
      name: data.name,
      description: data.description ?? undefined,
      hobbySlug: data.hobby_slug ?? undefined,
      interest: data.interest ?? undefined,
      visibility: data.visibility,
      myStatus: "owner",
    };
  };

  const inviteToSpace = async (
    spaceId: number | string,
    personId: string,
    note?: string,
  ) => {
    if (!supabase || !user) return { error: "Sign in to invite people." };
    if (personId === user.id) return { error: "You're already in it." };

    const { error } = await supabase.from("space_members").insert({
      space_id: spaceId,
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

    const space = spaces.find((s) => s.id === spaceId);
    await supabase.from("notifications").insert({
      user_id: personId,
      kind: "space_invite",
      body: `invited you to ${space?.name ?? "a Space"}.`,
      href: "/inbox",
    });
    await refresh();
    return { error: null };
  };

  const respondToInvitation = async (spaceId: number | string, accept: boolean) => {
    if (!supabase || !user) return;
    await supabase
      .from("space_members")
      .update({ status: accept ? "joined" : "declined" })
      .eq("space_id", spaceId)
      .eq("user_id", user.id);
    await refresh();
  };

  /* ── Messages ───────────────────────────────────────────────────────── */

  // The gate, stated once: you can write to someone you're connected to.
  // Nothing else opens this, which is what "no cold DMs" means in practice.
  const canMessage = (personId: string) => statusWith(personId) === "connected";

  const messagesWith = (personId: string) =>
    messages
      .filter(
        (m) =>
          (m.fromUser === personId && m.toUser === user?.id) ||
          (m.fromUser === user?.id && m.toUser === personId),
      )
      .sort((a, b) => a.createdAt - b.createdAt);

  const sendMessage = async (personId: string, body: string) => {
    if (!supabase || !user) return { error: "Sign in to send a message." };
    if (!canMessage(personId)) {
      return { error: "You can message people once you're connected." };
    }
    const { error } = await supabase.from("messages").insert({
      from_user: user.id,
      to_user: personId,
      body: body.trim().slice(0, 2000),
    });
    if (error) return { error: error.message };
    await refresh();
    return { error: null };
  };

  return (
    <ConnectionsContext.Provider
      value={{
        ready,
        live,
        connections,
        connectedPeople,
        statusWith,
        connectionWith,
        requestConnection,
        respondToConnection,
        withdrawConnection,
        spaces,
        mySpaces,
        spaceInvitations,
        createSpace,
        inviteToSpace,
        respondToInvitation,
        messages,
        messagesWith,
        canMessage,
        sendMessage,
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
