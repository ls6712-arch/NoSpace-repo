import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";
import { ParticipationKind } from "../data/participation";
import { canSendInto, messageTabFor } from "../lib/messageTabs";

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
  /** A photo or video riding along with the reply — opt-in per call site
   * via Thoughts' allowMedia prop (a circle thread reply, not a Moment's
   * ordinary thoughts). */
  media?: string;
  createdAt: number;
}

export interface Notification {
  id: number | string;
  kind: string;
  body: string;
  href?: string;
  actorName?: string;
  /** Who actually triggered it (server-set — see the notifications
   * hardening in supabase/migrations/20260925020000_communication_phase1_
   * safety.sql). Used only to filter out a blocked person's older
   * notifications client-side; new ones from them are already refused at
   * insert time. */
  actorId?: string;
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

export interface BlockedPerson {
  id: string;
  displayName: string;
  avatarUrl?: string;
}

export type ReportTargetKind = "profile" | "message" | "moment" | "thought";
export type ReportReason = "spam" | "harassment" | "inappropriate" | "other";

interface SocialContextType {
  /** True when this is really shared with other people rather than local-only. */
  isShared: boolean;

  /**
   * TODO(social graph): Discover's "Following" tab currently reads this list
   * — posts in hobbies you follow — because there is no person-to-person
   * follow relationship yet. That's an honest stand-in, not the real thing:
   * once people can follow people, "Following" on Discover should switch to
   * that instead of (or alongside) hobby follows.
   */
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
  }) => Promise<{ error: "self" | "no-recipient" | "failed" | null }>;
  respond: (id: number | string, accept: boolean) => Promise<void>;
  /** The accepted request between you and this person, if any. */
  /** Keyed by user id — display names are not unique. */
  threadWith: (personId: string) => Participation | undefined;
  canMessage: (personId: string) => boolean;
  /**
   * Any thread already open with this person — of any kind, and for a
   * direct_message any status (accepted, pending, or declined), since the
   * database only ever allows one direct_message row per pair. Read-only:
   * unlike the old startDirectMessage, this never creates anything, so the
   * "Message" button on a profile can check for a thread to jump back into
   * without ever inserting an empty one first.
   */
  findExistingThread: (personId: string) => Participation | undefined;
  /**
   * Opens a direct-message thread with someone AND sends its first message
   * in the same call — no participation row is ever created without a
   * message riding along with it, so nobody can end up with an empty
   * request to accept or ignore. Reuses whatever thread already exists with
   * this person (see findExistingThread) rather than forking a second one;
   * the database decides the new row's status server-side (accepted
   * immediately if the recipient already follows the sender, pending
   * otherwise; rejected, with the same "failed" wording as any other error,
   * if the two are blocked-between). If the participation insert succeeds
   * but the message insert fails, the id is still returned (a real, if
   * empty, thread now exists to retry into) alongside "failed".
   */
  startAndSendDirectMessage: (
    personId: string,
    personName: string,
    body: string,
  ) => Promise<{ id: number | string | null; error: "self" | "failed" | null }>;

  /** Pending direct_message requests waiting on you to accept or ignore. */
  messageRequests: Participation[];
  /** Your own outgoing direct_message requests still waiting on the other
   * person — pending, or declined (a decline doesn't free you to open a
   * second thread; this is the same one, still waiting). */
  myPendingRequests: Participation[];
  acceptRequest: (id: number | string) => Promise<void>;
  ignoreRequest: (id: number | string) => Promise<void>;

  /** Full block: enforced by the database (see supabase/migrations/
   * 20260925020000_communication_phase1_safety.sql); this list is only
   * for showing/filtering blocked people in the UI. */
  blockedIds: string[];
  blockedPeople: BlockedPerson[];
  block: (personId: string) => Promise<{ error: string | null }>;
  unblock: (personId: string) => Promise<{ error: string | null }>;
  report: (input: {
    targetUserId: string;
    targetKind: ReportTargetKind;
    targetId?: number | string;
    reason: ReportReason;
    note?: string;
  }) => Promise<{ error: string | null }>;

  thoughtsFor: (postId: number) => Thought[];
  addThought: (
    postId: number,
    body: string,
    prompt: string | undefined,
    postOwnerId?: string,
    postOwnerName?: string,
    media?: File,
  ) => Promise<void>;
  removeThought: (id: number | string) => Promise<void>;

  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;

  messagesFor: (participationId: number | string) => Message[];
  /** Returns "failed" for any rejection — a block, a duplicate, a rate
   * limit — so the UI can show one neutral line and never the database's
   * own message (which could otherwise reveal a block exists). */
  sendMessage: (participationId: number | string, body: string) => Promise<{ error: "failed" | null }>;

  refresh: () => Promise<void>;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

/* ── Local fallback store ──────────────────────────────────────────────── */

// Exported so ContentContext.tsx can read the signed-out fallback's
// followedHobbies directly (for activeHobbySlugs) without calling useSocial()
// — SocialProvider sits below ContentProvider in App.tsx's provider tree, so
// that hook isn't available there. A plain constant import has no such
// ordering problem.
export const SOCIAL_STORAGE_KEY = "sushii.social.v1";
const KEY = SOCIAL_STORAGE_KEY;

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

  // Blocking has no meaning in local (signed-out, no Supabase) mode — one
  // person, one browser, nobody else to block. Kept outside `state`/
  // `LocalState` since it never has a local-fallback shape to fall back to.
  const [blockedPeople, setBlockedPeople] = useState<BlockedPerson[]>([]);

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

    const [follows, parts, thoughts, notes, blocks] = await Promise.all([
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
      // Degrades to "no one blocked" if the table isn't there yet — the
      // Phase 1 migration may not be applied in every environment this
      // runs in.
      supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
    ]);

    // Names for everyone involved, in one go.
    const ids = new Set<string>();
    for (const p of parts.data ?? []) {
      if (p.from_user) ids.add(p.from_user);
      if (p.to_user) ids.add(p.to_user);
    }
    for (const t of thoughts.data ?? []) ids.add(t.user_id);
    for (const b of blocks.data ?? []) ids.add(b.blocked_id);
    const { data: people } = ids.size
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...ids])
      : { data: [] as any[] };
    const byId = new Map((people ?? []).map((p: any) => [p.id, p]));
    const nameOf = (id?: string) => (id ? byId.get(id)?.display_name ?? "Someone" : undefined);

    setBlockedPeople(
      (blocks.data ?? []).map((b: any) => ({
        id: b.blocked_id,
        displayName: byId.get(b.blocked_id)?.display_name?.trim() || "Someone",
        avatarUrl: byId.get(b.blocked_id)?.avatar_url ?? undefined,
      })),
    );

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

    // Messages for the threads that are actually open, plus any pending or
    // declined direct_message thread I'm party to — the recipient needs to
    // preview a pending request, and the sender still sees their own
    // message in one that got declined. (The database's own SELECT policy
    // enforces exactly who sees what here; this just widens which
    // participations are worth asking about at all.)
    const messageableIds = participations
      .filter(
        (p) =>
          (p.status === "accepted" && p.kind !== "join_in") ||
          (p.kind === "direct_message" && (p.status === "pending" || p.status === "declined")),
      )
      .map((p) => p.id);
    const { data: msgs } = messageableIds.length
      ? await supabase
          .from("messages")
          .select("*")
          .in("participation_id", messageableIds as number[])
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
        media: t.media_url ?? undefined,
        createdAt: new Date(t.created_at).getTime(),
      })),
      notifications: (notes.data ?? []).map((n: any) => ({
        id: n.id,
        kind: n.kind,
        body: n.body,
        href: n.href ?? undefined,
        actorName: n.actor_name ?? undefined,
        actorId: n.actor_id ?? undefined,
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
      // sql/fixes.sql's participations_one_pending_ask unique index rejects
      // a second pending ask to the same person while the first is still
      // unanswered — the insert's error was previously discarded, so a
      // repeat tap (e.g. before the first request's own refresh() had
      // updated local state to reflect it) still sent a duplicate
      // notification and told the sender it worked, for a row that was
      // never actually created.
      const { error } = await supabase.from("participations").insert({
        kind: input.kind,
        from_user: user.id,
        to_user: input.toUser,
        post_id: input.postId ?? null,
        hobby_key: input.hobbyKey ?? null,
        intent: input.intent,
        note: input.note ?? null,
        status: "pending",
      });
      if (error) return { error: "failed" as const };
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

    if (supabase && user) {
      await supabase
        .from("participations")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", id);
      // A message request accepted/ignored gets no "accepted" notification
      // of its own — the sender simply finds the conversation open (or
      // doesn't) next time they check Messages. That notification is for
      // Make together / Explore together, where accepting is the news.
      if (accept && target.kind !== "direct_message") {
        const label = target.kind === "make_together" ? "Make together" : "Explore together";
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

  // A blocked person's older participations/notifications can still be
  // sitting in already-fetched state (blocking doesn't retroactively wipe
  // them) — filtered out here rather than trusting every call site to
  // remember to check blockedIds itself.
  const isBlocked = (id?: string) => !!id && blockedPeople.some((b) => b.id === id);

  // Declared here (rather than down in the Messages section below) because
  // messageRequests, just below, needs it already defined — everything in
  // this component body runs once per render, top to bottom.
  const messagesFor = (participationId: number | string) =>
    state.messages
      .filter((m) => String(m.participationId) === String(participationId))
      .sort((a, b) => a.createdAt - b.createdAt);

  /** Message requests waiting on me to accept or ignore — never one with no
   * message in it yet (a legacy row from before startAndSendDirectMessage
   * always inserted the two together, or one where the message half of
   * that insert failed): there's nothing yet to accept or ignore. */
  const messageRequests = state.participations.filter(
    (p) => messageTabFor(p, myId) === "requests" && !isBlocked(p.fromUser) && messagesFor(p.id).length > 0,
  );
  /** My own outgoing requests still waiting — pending, or declined (which
   * doesn't free me to open a second thread; see startAndSendDirectMessage). */
  const myPendingRequests = state.participations.filter(
    (p) =>
      p.kind === "direct_message" &&
      p.status !== "accepted" &&
      messageTabFor(p, myId) === "chats" &&
      !isBlocked(p.toUser),
  );
  const acceptRequest = (id: number | string) => respond(id, true);
  const ignoreRequest = (id: number | string) => respond(id, false);

  // Matched by user id: two people can share a display name, and picking the
  // wrong thread would show one person's messages under another's name.
  const threadWith = (personId: string) =>
    state.participations.find(
      (p) =>
        p.status === "accepted" &&
        (p.kind === "make_together" || p.kind === "explore_together" || p.kind === "direct_message") &&
        (p.toUser === personId || p.fromUser === personId),
    );

  const canMessage = (name: string) => !!threadWith(name);

  // Any thread already open with this person, of any kind — an accepted one
  // of any kind, or a direct_message of ANY status (the database allows only
  // one per pair, ever, so a pending or declined one must be reused rather
  // than re-inserted). Read-only: never creates anything.
  const findExistingThread = (personId: string): Participation | undefined => {
    const accepted = threadWith(personId);
    if (accepted) return accepted;
    return state.participations.find(
      (p) => p.kind === "direct_message" && (p.toUser === personId || p.fromUser === personId),
    );
  };

  const startAndSendDirectMessage: SocialContextType["startAndSendDirectMessage"] = async (
    personId,
    personName,
    body,
  ) => {
    if (!body.trim()) return { id: null, error: "failed" as const };
    if (user && personId === user.id) return { id: null, error: "self" as const };

    const existing = findExistingThread(personId);
    if (existing) {
      const { error } = await sendMessage(existing.id, body);
      return { id: existing.id, error };
    }

    if (supabase && user) {
      // No status sent — the database decides: accepted immediately if
      // personId already follows me back, pending otherwise, or rejected
      // (same "failed" as any other error, never revealing a block) if
      // we're blocked-between.
      const { data, error } = await supabase
        .from("participations")
        .insert({ kind: "direct_message", from_user: user.id, to_user: personId })
        .select()
        .single();
      if (error || !data) return { id: null, error: "failed" as const };

      const newThread: Participation = {
        id: data.id,
        kind: "direct_message",
        fromUser: data.from_user,
        fromName: myName,
        toUser: data.to_user ?? undefined,
        toName: personName,
        status: data.status,
        createdAt: new Date(data.created_at).getTime(),
      };
      const { error: msgError } = await insertMessage(newThread, body, newThread.status === "pending");
      if (msgError) {
        // The participation row is real even though its message failed —
        // pick it up so a retry lands in the same thread instead of
        // forking a second, unreachable one.
        await refresh();
        return { id: newThread.id, error: "failed" as const };
      }
      return { id: newThread.id, error: null };
    }

    // Local (signed-out) mode: no server to decide a status, and no one
    // else in this browser to ask — same as before, pre-accepted, with its
    // one message riding along in the same update.
    const entry: Participation = {
      id: localId(),
      kind: "direct_message",
      fromUser: myId,
      fromName: myName,
      toUser: personId,
      toName: personName,
      status: "accepted",
      createdAt: Date.now(),
    };
    setState({
      ...state,
      participations: [entry, ...state.participations],
      messages: [...state.messages, { id: localId(), participationId: entry.id, fromUser: myId, body: body.trim(), createdAt: Date.now() }],
    });
    return { id: entry.id, error: null };
  };

  /* ── Blocking and reporting ────────────────────────────────────────────
   * No local-mode fallback: blocking and reporting only mean something
   * once there's a real account and a real other person on the other end.
   */

  const blockedIds = blockedPeople.map((p) => p.id);

  const block = async (personId: string): Promise<{ error: string | null }> => {
    if (!supabase || !user) return { error: "failed" };
    const { error } = await supabase.from("blocks").insert({ blocker_id: user.id, blocked_id: personId });
    if (error) return { error: "failed" };
    await refresh();
    return { error: null };
  };

  const unblock = async (personId: string): Promise<{ error: string | null }> => {
    if (!supabase || !user) return { error: "failed" };
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", personId);
    if (error) return { error: "failed" };
    await refresh();
    return { error: null };
  };

  const report: SocialContextType["report"] = async (input) => {
    if (!supabase || !user) return { error: "failed" };
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_user_id: input.targetUserId,
      target_kind: input.targetKind,
      target_id: input.targetKind === "profile" ? null : (input.targetId ?? null),
      reason: input.reason,
      note: input.note?.trim() || null,
    });
    if (error) return { error: "failed" };
    return { error: null };
  };

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
    media,
  ) => {
    if (!body.trim()) return;
    if (supabase && user) {
      // Same bucket and per-user-folder convention as ContentContext's own
      // post photos — reuses the storage policies that already exist for
      // it (sql/security-hardening.sql section 8) rather than needing new
      // ones for a second bucket.
      let mediaUrl: string | undefined;
      if (media) {
        const dot = media.name.lastIndexOf(".");
        const ext = (dot > -1 ? media.name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext ? `.${ext}` : ""}`;
        const { error: uploadError } = await supabase.storage
          .from("post-media")
          .upload(path, media, { contentType: media.type || undefined, upsert: false });
        if (uploadError) {
          console.error("[SocialContext] thought media upload failed:", uploadError);
        } else {
          mediaUrl = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
        }
      }

      await supabase.from("thoughts").insert({
        post_id: postId,
        user_id: user.id,
        prompt: prompt ?? null,
        body: body.trim(),
        media_url: mediaUrl ?? null,
      });
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
          media: media ? URL.createObjectURL(media) : undefined,
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

  // A blocked person's older notifications stay out of both the count and
  // the list below — new ones from them are already refused at insert
  // time, but blocking doesn't retroactively erase what's already here.
  const visibleNotifications = state.notifications.filter((n) => !isBlocked(n.actorId));
  const unreadCount = visibleNotifications.filter((n) => !n.read).length;

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
  // (messagesFor itself is declared up near isBlocked — messageRequests
  // needs it already defined by the time this component body reaches it.)

  // Shared by sendMessage (an existing thread) and startAndSendDirectMessage
  // (a thread just now inserted, before it's even in `state` yet) — both
  // just need somewhere to put a message and notify the other person, once
  // the caller has already decided the send is allowed.
  const insertMessage = async (
    thread: Participation,
    body: string,
    isFirstPendingDm: boolean,
  ): Promise<{ error: "failed" | null }> => {
    if (supabase && user) {
      const { error } = await supabase
        .from("messages")
        .insert({ participation_id: thread.id, from_user: user.id, body: body.trim() });
      // A block, a duplicate, a rate limit — whatever the database's own
      // reason, the caller gets the same "failed" back either way. See
      // SocialContextType.sendMessage's own comment for why.
      if (error) return { error: "failed" as const };
      const other = thread.fromUser === user.id ? thread.toUser : thread.fromUser;
      if (isFirstPendingDm) {
        await notify(other, "message_request", `${myName} wants to message you.`, "/messages?tab=requests");
      } else {
        await notify(other, "message", `${myName} sent you a message.`, "/messages");
      }
      // Awaited so the sent message (and, for a brand-new thread, the
      // thread itself) is already in state by the time the caller updates
      // the screen — otherwise Messages.tsx would flash "No open threads"
      // for the moment this is still in flight.
      await refresh();
      return { error: null };
    }
    setState({
      ...state,
      messages: [
        ...state.messages,
        { id: localId(), participationId: thread.id, fromUser: myId, body: body.trim(), createdAt: Date.now() },
      ],
    });
    return { error: null };
  };

  const sendMessage: SocialContextType["sendMessage"] = async (participationId, body) => {
    if (!body.trim()) return { error: null };
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    if (!thread || thread.kind === "join_in") return { error: "failed" as const };

    const hasMessages = messagesFor(participationId).length > 0;
    // Belt and braces: the database enforces the exact rule (including the
    // one-message limit and exactly who may send into what), but the UI
    // should never be the thing that tries something already known to fail.
    if (!canSendInto(thread, myId, hasMessages)) return { error: "failed" as const };

    // I'm the recipient of a direct_message I earlier declined, messaging
    // them again — the database only lets the recipient move declined ->
    // accepted (the same move Accept makes on a still-pending one), so
    // flip it before sending rather than leaving a live conversation
    // sitting under a "declined" row. The sender has no such move;
    // canSendInto already keeps them locked out above.
    if (supabase && user && thread.kind === "direct_message" && thread.status === "declined" && thread.toUser === myId) {
      const { error } = await supabase
        .from("participations")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", thread.id);
      if (error) return { error: "failed" as const };
    }

    const isFirstPendingDm =
      thread.kind === "direct_message" && thread.status === "pending" && thread.fromUser === myId && !hasMessages;
    return insertMessage(thread, body, isFirstPendingDm);
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
        findExistingThread,
        startAndSendDirectMessage,
        messageRequests,
        myPendingRequests,
        acceptRequest,
        ignoreRequest,
        blockedIds,
        blockedPeople,
        block,
        unblock,
        report,
        thoughtsFor,
        addThought,
        removeThought,
        notifications: visibleNotifications,
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
