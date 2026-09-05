import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";
import { ParticipationKind } from "../data/participation";

/**
 * Everything between two people: following a hobby, asking to take part,
 * thoughts on a moment, notifications, and the messages an accepted request
 * unlocks.
 *
 * All of it is Supabase-backed, because the other person is on another device
 * — a request that lives in your own browser is not a request. When Supabase
 * isn't configured (a local build, a preview with no keys) everything falls
 * back to this browser so the interface still works and still tells the truth
 * about what it is: `isShared` is false, and the UI says so.
 */

export interface Participation {
  id: number | string;
  kind: Exclude<ParticipationKind, "keep_exploring">;
  fromUser: string;
  fromName: string;
  toUser?: string;
  toName?: string;
  postId?: number;
  hobbyKey?: string;
  intent?: string;
  note?: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
}

export interface Thought {
  id: number | string;
  postId: number;
  userId: string;
  authorName: string;
  authorAvatar?: string;
  prompt?: string;
  body: string;
  createdAt: number;
}

export interface Notification {
  id: number | string;
  kind: string;
  body: string;
  href?: string;
  actorName?: string;
  read: boolean;
  createdAt: number;
}

export interface Message {
  id: number | string;
  participationId: number | string;
  fromUser: string;
  body: string;
  createdAt: number;
}

interface SocialContextType {
  /** True when this is really shared with other people rather than local-only. */
  isShared: boolean;

  followedHobbies: string[];
  isFollowingHobby: (key: string) => boolean;
  toggleHobbyFollow: (key: string, label: string) => Promise<void>;

  participations: Participation[];
  /** Everyone going to a given activity post. */
  goingCount: (postId: number) => number;
  isGoing: (postId: number) => boolean;
  joinIn: (postId: number, title: string, ownerId?: string) => Promise<void>;
  leaveActivity: (postId: number) => Promise<void>;
  /** Ask someone to make or explore together. */
  /**
   * Ask someone to make or explore something together. Returns why it was
   * refused, so the UI can say so rather than silently doing nothing:
   * "self" — you can't ask yourself; "no-recipient" — nobody to ask.
   */
  requestTogether: (input: {
    kind: "make_together" | "explore_together";
    toUser?: string;
    toName: string;
    hobbyKey?: string;
    postId?: number;
    intent: string;
    note?: string;
  }) => Promise<{ error: "self" | "no-recipient" | null }>;
  respond: (id: number | string, accept: boolean) => Promise<void>;
  /** The accepted request between you and this person, if any. */
  /** Keyed by user id — display names are not unique. */
  threadWith: (personId: string) => Participation | undefined;
  canMessage: (personId: string) => boolean;

  thoughtsFor: (postId: number) => Thought[];
  addThought: (postId: number, body: string, prompt: string | undefined, postOwnerId?: string, postOwnerName?: string) => Promise<void>;
  removeThought: (id: number | string) => Promise<void>;

  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;

  messagesFor: (participationId: number | string) => Message[];
  sendMessage: (participationId: number | string, body: string) => Promise<void>;

  refresh: () => Promise<void>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

/* ── Local fallback store ──────────────────────────────────────────────── */

const KEY = "nospace.social.v1";

interface LocalState {
  followedHobbies: string[];
  participations: Participation[];
  thoughts: Thought[];
  notifications: Notification[];
  messages: Message[];
}

const EMPTY: LocalState = {
  followedHobbies: [],
  participations: [],
  thoughts: [],
  notifications: [],
  messages: [],
};

function loadLocal(): LocalState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveLocal(state: LocalState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // best effort
  }
}

const localId = () => `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Signing out empties the browser's copy of all of this. */
function clearLocal() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing stored to clear
  }
}

export function SocialProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const shared = !!supabase && !!user;

  const [local, setLocal] = useState<LocalState>(loadLocal);

  // Sign-out wipes the browser's stores; drop the in-memory copy too, so the
  // last account's requests and thoughts don't linger on screen.
  useEffect(() => {
    const onCleared = () => setLocal(EMPTY);
    window.addEventListener(LOCAL_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(LOCAL_CLEARED_EVENT, onCleared);
  }, []);
  const [remote, setRemote] = useState<LocalState>(EMPTY);
  const state = shared ? remote : local;

  const myName = profile?.display_name || "You";
  const myId = user?.id ?? "local-user";

  const setState = (next: LocalState) => {
    if (shared) setRemote(next);
    else {
      setLocal(next);
      saveLocal(next);
    }
  };

  /* ── Reading ────────────────────────────────────────────────────────── */

  const refresh = useCallback(async () => {
    if (!supabase || !user) return;

    const [follows, parts, thoughts, notes] = await Promise.all([
      supabase.from("hobby_follows").select("hobby_key").eq("user_id", user.id),
      supabase
        .from("participations")
        .select("*")
        .or(`from_user.eq.${user.id},to_user.eq.${user.id},to_user.is.null`)
        .order("created_at", { ascending: false }),
      supabase.from("thoughts").select("*").order("created_at", { ascending: false }).limit(400),
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
    ]);

    // Names for everyone involved, in one go.
    const ids = new Set<string>();
    for (const p of parts.data ?? []) {
      if (p.from_user) ids.add(p.from_user);
      if (p.to_user) ids.add(p.to_user);
    }
    for (const t of thoughts.data ?? []) ids.add(t.user_id);
    const { data: people } = ids.size
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...ids])
      : { data: [] as any[] };
    const byId = new Map((people ?? []).map((p: any) => [p.id, p]));
    const nameOf = (id?: string) => (id ? byId.get(id)?.display_name ?? "Someone" : undefined);

    const participations: Participation[] = (parts.data ?? []).map((p: any) => ({
      id: p.id,
      kind: p.kind,
      fromUser: p.from_user,
      fromName: nameOf(p.from_user) ?? "Someone",
      toUser: p.to_user ?? undefined,
      toName: nameOf(p.to_user),
      postId: p.post_id ?? undefined,
      hobbyKey: p.hobby_key ?? undefined,
      intent: p.intent ?? undefined,
      note: p.note ?? undefined,
      status: p.status,
      createdAt: new Date(p.created_at).getTime(),
    }));

    // Messages for the threads that are actually open.
    const acceptedIds = participations
      .filter((p) => p.status === "accepted" && p.kind !== "join_in")
      .map((p) => p.id);
    const { data: msgs } = acceptedIds.length
      ? await supabase
          .from("messages")
          .select("*")
          .in("participation_id", acceptedIds as number[])
          .order("created_at", { ascending: true })
      : { data: [] as any[] };

    setRemote({
      followedHobbies: (follows.data ?? []).map((f: any) => f.hobby_key),
      participations,
      thoughts: (thoughts.data ?? []).map((t: any) => ({
        id: t.id,
        postId: t.post_id,
        userId: t.user_id,
        authorName: nameOf(t.user_id) ?? "Someone",
        authorAvatar: byId.get(t.user_id)?.avatar_url ?? undefined,
        prompt: t.prompt ?? undefined,
        body: t.body,
        createdAt: new Date(t.created_at).getTime(),
      })),
      notifications: (notes.data ?? []).map((n: any) => ({
        id: n.id,
        kind: n.kind,
        body: n.body,
        href: n.href ?? undefined,
        actorName: n.actor_name ?? undefined,
        read: n.read,
        createdAt: new Date(n.created_at).getTime(),
      })),
      messages: (msgs ?? []).map((m: any) => ({
        id: m.id,
        participationId: m.participation_id,
        fromUser: m.from_user,
        body: m.body,
        createdAt: new Date(m.created_at).getTime(),
      })),
    });
  }, [user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /* ── Notifying ──────────────────────────────────────────────────────── */

  const notify = async (toUser: string | undefined, kind: string, body: string, href?: string) => {
    if (!toUser) return;
    if (supabase && user) {
      await supabase
        .from("notifications")
        .insert({ user_id: toUser, kind, body, href, actor_name: myName });
      if (toUser === user.id) refresh();
      return;
    }
    // Local mode: there's only one person here, so a notification to someone
    // else has nowhere to go. Only self-notifications are kept.
    if (toUser === myId) {
      setState({
        ...state,
        notifications: [
          { id: localId(), kind, body, href, actorName: myName, read: false, createdAt: Date.now() },
          ...state.notifications,
        ],
      });
    }
  };

  /* ── Hobby follows ──────────────────────────────────────────────────── */

  const isFollowingHobby = (key: string) => state.followedHobbies.includes(key);

  const toggleHobbyFollow = async (key: string, label: string) => {
    const following = isFollowingHobby(key);
    if (supabase && user) {
      if (following) {
        await supabase.from("hobby_follows").delete().eq("user_id", user.id).eq("hobby_key", key);
      } else {
        await supabase.from("hobby_follows").insert({ user_id: user.id, hobby_key: key });
        await notify(user.id, "hobby_follow", `You're exploring ${label}. New work shows up in My Space.`, "/my-space");
      }
      refresh();
      return;
    }
    setState({
      ...state,
      followedHobbies: following
        ? state.followedHobbies.filter((k) => k !== key)
        : [key, ...state.followedHobbies],
    });
  };

  /* ── Participation ──────────────────────────────────────────────────── */

  const goingCount = (postId: number) =>
    state.participations.filter((p) => p.kind === "join_in" && p.postId === postId).length;

  const isGoing = (postId: number) =>
    state.participations.some(
      (p) => p.kind === "join_in" && p.postId === postId && p.fromUser === myId,
    );

  const joinIn = async (postId: number, title: string, ownerId?: string) => {
    if (isGoing(postId)) return;
    if (supabase && user) {
      await supabase.from("participations").insert({
        kind: "join_in",
        from_user: user.id,
        to_user: ownerId ?? null,
        post_id: postId,
        status: "accepted",
      });
      await notify(ownerId, "joined", `${myName} joined ${title}.`, "/my-space");
      refresh();
      return;
    }
    setState({
      ...state,
      participations: [
        {
          id: localId(),
          kind: "join_in",
          fromUser: myId,
          fromName: myName,
          postId,
          status: "accepted",
          createdAt: Date.now(),
        },
        ...state.participations,
      ],
    });
  };

  const leaveActivity = async (postId: number) => {
    const mine = state.participations.find(
      (p) => p.kind === "join_in" && p.postId === postId && p.fromUser === myId,
    );
    if (!mine) return;
    if (supabase && user) {
      await supabase.from("participations").delete().eq("id", mine.id);
      refresh();
      return;
    }
    setState({
      ...state,
      participations: state.participations.filter((p) => p.id !== mine.id),
    });
  };

  const requestTogether: SocialContextType["requestTogether"] = async (input) => {
    const label = input.kind === "make_together" ? "Make together" : "Explore together";

    // A request needs someone on the other end. Without a recipient it can
    // never be notified, accepted, or withdrawn — it just sits pending
    // forever, and (because two unknown recipients compare equal) makes
    // unrelated profiles claim you had already asked them.
    if (!input.toUser) return { error: "no-recipient" as const };
    if (user && input.toUser === user.id) return { error: "self" as const };

    if (supabase && user) {
      await supabase.from("participations").insert({
        kind: input.kind,
        from_user: user.id,
        to_user: input.toUser,
        post_id: input.postId ?? null,
        hobby_key: input.hobbyKey ?? null,
        intent: input.intent,
        note: input.note ?? null,
        status: "pending",
      });
      await notify(
        input.toUser,
        input.kind,
        `${myName} asked to ${label.toLowerCase()}: ${input.intent}.`,
        "/you",
      );
      refresh();
      return { error: null };
    }
    setState({
      ...state,
      participations: [
        {
          id: localId(),
          kind: input.kind,
          fromUser: myId,
          fromName: myName,
          // Kept in both paths. It used to be saved only when signed in, so
          // the same feature read a different field depending on auth state.
          toUser: input.toUser,
          toName: input.toName,
          postId: input.postId,
          hobbyKey: input.hobbyKey,
          intent: input.intent,
          note: input.note,
          status: "pending",
          createdAt: Date.now(),
        },
        ...state.participations,
      ],
    });
    return { error: null };
  };

  const respond = async (id: number | string, accept: boolean) => {
    const target = state.participations.find((p) => p.id === id);
    if (!target) return;
    // Only the person who was asked gets to answer. The sender withdrawing is
    // a different action (leaveActivity / delete), not an accept.
    if (user && target.toUser && target.toUser !== user.id) return;
    const label = target.kind === "make_together" ? "Make together" : "Explore together";

    if (supabase && user) {
      await supabase
        .from("participations")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", id);
      if (accept) {
        await notify(
          target.fromUser,
          "accepted",
          `${myName} accepted your ${label} request. You can now message each other.`,
          "/messages",
        );
      }
      refresh();
      return;
    }
    setState({
      ...state,
      participations: state.participations.map((p) =>
        p.id === id ? { ...p, status: accept ? "accepted" : "declined" } : p,
      ),
    });
  };

  // Matched by user id: two people can share a display name, and picking the
  // wrong thread would show one person's messages under another's name.
  const threadWith = (personId: string) =>
    state.participations.find(
      (p) =>
        p.status === "accepted" &&
        (p.kind === "make_together" || p.kind === "explore_together") &&
        (p.toUser === personId || p.fromUser === personId),
    );

  const canMessage = (name: string) => !!threadWith(name);

  /* ── Thoughts ───────────────────────────────────────────────────────── */

  const thoughtsFor = (postId: number) =>
    state.thoughts
      .filter((t) => t.postId === postId)
      .sort((a, b) => b.createdAt - a.createdAt);

  const addThought: SocialContextType["addThought"] = async (
    postId,
    body,
    prompt,
    postOwnerId,
    postOwnerName,
  ) => {
    if (!body.trim()) return;
    if (supabase && user) {
      await supabase
        .from("thoughts")
        .insert({ post_id: postId, user_id: user.id, prompt: prompt ?? null, body: body.trim() });
      if (postOwnerId && postOwnerId !== user.id) {
        await notify(postOwnerId, "thought", `${myName} left a thought on your moment.`, "/you");
      }
      refresh();
      return;
    }
    setState({
      ...state,
      thoughts: [
        {
          id: localId(),
          postId,
          userId: myId,
          authorName: myName,
          prompt,
          body: body.trim(),
          createdAt: Date.now(),
        },
        ...state.thoughts,
      ],
    });
    if (postOwnerName) {
      // Nothing to notify locally — there's only one person in this browser.
    }
  };

  const removeThought = async (id: number | string) => {
    if (supabase && user) {
      await supabase.from("thoughts").delete().eq("id", id);
      refresh();
      return;
    }
    setState({ ...state, thoughts: state.thoughts.filter((t) => t.id !== id) });
  };

  /* ── Notifications ──────────────────────────────────────────────────── */

  const unreadCount = state.notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (supabase && user) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
      refresh();
      return;
    }
    setState({
      ...state,
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    });
  };

  /* ── Messages ───────────────────────────────────────────────────────── */

  const messagesFor = (participationId: number | string) =>
    state.messages
      .filter((m) => String(m.participationId) === String(participationId))
      .sort((a, b) => a.createdAt - b.createdAt);

  const sendMessage = async (participationId: number | string, body: string) => {
    if (!body.trim()) return;
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    // Belt and braces: the database enforces this too, but the UI should never
    // be the thing that tries.
    if (!thread || thread.status !== "accepted" || thread.kind === "join_in") return;

    if (supabase && user) {
      await supabase
        .from("messages")
        .insert({ participation_id: participationId, from_user: user.id, body: body.trim() });
      const other = thread.fromUser === user.id ? thread.toUser : thread.fromUser;
      await notify(other, "message", `${myName} sent you a message.`, "/messages");
      refresh();
      return;
    }
    setState({
      ...state,
      messages: [
        ...state.messages,
        { id: localId(), participationId, fromUser: myId, body: body.trim(), createdAt: Date.now() },
      ],
    });
  };

  return (
    <SocialContext.Provider
      value={{
        isShared: shared,
        followedHobbies: state.followedHobbies,
        isFollowingHobby,
        toggleHobbyFollow,
        participations: state.participations,
        goingCount,
        isGoing,
        joinIn,
        leaveActivity,
        requestTogether,
        respond,
        threadWith,
        canMessage,
        thoughtsFor,
        addThought,
        removeThought,
        notifications: state.notifications,
        unreadCount,
        markAllRead,
        messagesFor,
        sendMessage,
        refresh,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const ctx = useContext(SocialContext);
  if (!ctx) throw new Error("useSocial must be used within a SocialProvider");
  return ctx;
}
