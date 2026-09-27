import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "./AuthContext";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";
import { ParticipationKind } from "../data/participation";
import {
  applyParticipationDelete,
  canAttachInto,
  canSendInto,
  isRelevantParticipationEvent,
  messageTabFor,
  upsertParticipation,
  visibleParticipations,
} from "../lib/messageTabs";
import {
  applyMessageUpdate,
  combineHistoryAndPending,
  countUnreadThreads,
  markPendingFailed,
  mergeMessage,
  MessageKind,
  patchSummaryOnMessageUpdate,
  patchSummaryWithNewMessage,
  PendingMessage,
  prependOlderPage,
  reconcilePendingAfterIncoming,
  removePendingByClientId,
  ThreadSummary,
} from "../lib/messageSync";
import { convertHeicIfNeeded } from "../lib/heicConversion";
import { deleteMessagePhoto, uploadMessagePhoto } from "../lib/messageMedia";

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
  /** Phase 4: 'text' for every message before this phase and for an
   * ordinary typed message since. A photo/moment/pursuit share carries its
   * content in the matching field below instead of (or alongside) body. */
  kind: MessageKind;
  mediaPath?: string | null;
  sharedPostId?: number | null;
  sharedPursuitId?: string | null;
  /** Set once the sender has unsent this message — body/mediaPath/
   * sharedPostId/sharedPursuitId are all cleared at the same time (see
   * unsend_message() in the database), so this is the one field that says
   * "there used to be content here" once everything else has gone null/''. */
  deletedAt?: number | null;
  /** Only set for a not-yet-confirmed local send (Phase 2) — never present
   * on a message actually loaded from the database. "sending" while the
   * insert is in flight; "failed" if it came back with an error, with
   * clientId identifying it for a retry that reuses the same text instead
   * of creating a second row. */
  status?: "sending" | "failed";
  clientId?: string;
  /** Phase 4, a still-uploading photo only — see PendingMessage. */
  localPreviewUrl?: string;
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
  /** Marks exactly these notifications read — what opening one bell GROUP
   * does (every row folded into that line), as distinct from markAllRead's
   * everything-at-once. */
  markNotificationsRead: (ids: Array<number | string>) => Promise<void>;

  /**
   * For the currently open conversation (see openConversation below), the
   * real, paginated history plus anything still pending. For any other
   * thread, a lightweight one-message preview built from its summary (or,
   * if participation_message_summaries() isn't available yet, from the
   * Phase 1 full-history fallback) — enough for message_count/first-message
   * checks without ever having fetched that thread's full history.
   */
  messagesFor: (participationId: number | string) => Message[];
  /** Returns "failed" for any rejection — a block, a duplicate, a rate
   * limit — so the UI can show one neutral line and never the database's
   * own message (which could otherwise reveal a block exists). A sent
   * message appears immediately (status "sending") via messagesFor while
   * this is in flight; on failure it stays in place as "failed" for
   * retryMessage rather than disappearing. */
  sendMessage: (participationId: number | string, body: string) => Promise<{ error: "failed" | null }>;
  /** Retries a specific failed pending message, reusing its exact text and
   * never creating a second request row. No-ops if that pending entry is
   * gone (e.g. already retried successfully from another render). */
  retryMessage: (participationId: number | string, clientId: string) => Promise<void>;
  /** Sends a photo — HEIC-converted by the caller (Messages.tsx uses the
   * same convertHeicIfNeeded() every Moment upload does) or already a plain
   * image. Accepted threads only (canAttachInto); fails quietly (never
   * throws) if the thread isn't accepted, the upload fails, or the insert
   * itself is rejected (e.g. the migration this depends on isn't applied
   * live yet — the same "failed" any other rejection gets). Appears
   * immediately as a "sending" bubble showing the picked photo, same
   * retry-in-place behavior as a failed text send. */
  sendPhotoMessage: (participationId: number | string, file: File) => Promise<{ error: "failed" | null }>;
  /** Shares a Moment into a chat. Accepted threads only. The database's own
   * INSERT policy is the actual gate on "can I share this" (a plain EXISTS
   * against posts, under MY OWN RLS) — this never re-checks visibility
   * client-side, since that check would just be re-deriving what the
   * server is about to enforce anyway. */
  shareMoment: (participationId: number | string, postId: number | string) => Promise<{ error: "failed" | null }>;
  /** Shares a Pursuit into a chat — same shape as shareMoment. */
  sharePursuit: (participationId: number | string, pursuitId: string) => Promise<{ error: "failed" | null }>;
  /** Deletes your own message for both of you — clears its content and
   * marks it deleted (never a hard delete; see unsend_message() in the
   * database), and best-effort removes its storage object if it was a
   * photo. Rejected server-side for anyone but the original sender; the UI
   * should only ever offer this on your own messages. */
  unsendMessage: (participationId: number | string, messageId: number | string) => Promise<{ error: "failed" | null }>;

  /**
   * Marks a thread as "the one currently on screen": messagesFor(id) then
   * returns its real, paginated history (latest 50, kept live by Realtime)
   * instead of the lightweight preview every other thread gets. Call with
   * null/closeConversation() when leaving it, so a background thread stops
   * paying for a full history load.
   */
  openConversation: (participationId: number | string) => void;
  closeConversation: () => void;
  hasMoreOlderMessages: boolean;
  loadingOlderMessages: boolean;
  /** Loads the next-older page of 50 (keyset on created_at, id) and
   * prepends it, in order, ahead of what's already loaded. No-ops if
   * there's nothing more or a load is already in flight. */
  loadOlderMessages: () => Promise<void>;

  /** Messages from the other person, newer than my own last_read_at, for
   * this thread — 0 once summariesAvailable is false (the Phase 2
   * fallback never tracked reads, so there's nothing to count). */
  unreadCountFor: (participationId: number | string) => number;
  /** How many of my accepted "chats" threads have something unread — the
   * Chats-tab half of the header/tab-bar badge (the other half is
   * messageRequests.length). */
  chatsUnreadCount: number;
  /** Marks the given (accepted) thread read as of now. Silently does
   * nothing for a pending thread or one you're not in — the database
   * enforces that; the UI should just never call it in those cases. */
  markThreadRead: (participationId: number | string) => Promise<void>;
  /** The OTHER party's last read time for the currently open conversation
   * (openConversation), or null if they haven't read it, the thread isn't
   * accepted, either side has read_receipts off, or you're blocked-between
   * — thread_seen_at() collapses all of those to the same null on purpose.
   * Always null for any thread that isn't the open one. */
  seenAt: number | null;
  /** Re-fetches seenAt for the open conversation. Call on open, after you
   * send, on tab focus, and (only while your last message isn't yet seen)
   * every 15 seconds — no other polling. */
  refreshSeenAt: () => Promise<void>;

  refresh: () => Promise<void>;
  /** Re-fetches participations/summaries and the open conversation, without
   * the rest of refresh()'s work — the safety net Messages.tsx runs on a
   * 60-second interval while it's open, and on regaining focus. */
  refreshMessagesSafetyNet: () => Promise<void>;
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
  /** Local (signed-out) mode's full message store, and the Phase 1
   * fallback used when participation_message_summaries() isn't available
   * (migration not applied yet) — every message of every messageable
   * thread, same as before Phase 2. Ignored by messagesFor whenever
   * summariesAvailable is true; summaries is the source of truth then. */
  messages: Message[];
  /** One row per thread from participation_message_summaries() — empty and
   * unused in local mode or while summariesAvailable is false. */
  summaries: ThreadSummary[];
  /** False only when the RPC itself failed (migration not applied, or some
   * other error) — triggers the full-history fallback above instead of an
   * empty Messages page. Starts true (nothing to fall back from yet, and
   * nothing has failed either). */
  summariesAvailable: boolean;
}

const EMPTY: LocalState = {
  followedHobbies: [],
  participations: [],
  thoughts: [],
  notifications: [],
  messages: [],
  summaries: [],
  summariesAvailable: true,
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

function mapMessageRow(m: any): Message {
  return {
    id: m.id,
    participationId: m.participation_id,
    fromUser: m.from_user,
    body: m.body,
    createdAt: new Date(m.created_at).getTime(),
    // Absent on a database this old migration hasn't reached yet — same
    // "reads as the pre-Phase-4 shape" default the column itself uses.
    kind: (m.kind ?? "text") as MessageKind,
    mediaPath: m.media_path ?? null,
    sharedPostId: m.shared_post_id ?? null,
    sharedPursuitId: m.shared_pursuit_id ?? null,
    deletedAt: m.deleted_at ? new Date(m.deleted_at).getTime() : null,
  };
}

/** How many pages of history to fetch at once, everywhere — the latest
 * page on opening a conversation, and each older page on scroll-up. */
const MESSAGE_PAGE_SIZE = 50;

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

  /* ── Phase 2: the one open conversation's real, paginated history ─────
   * Only the thread on screen ever gets its full history loaded — every
   * other thread relies on state.summaries (or, as a fallback,
   * state.messages) for its one-message preview. openThreadIdRef mirrors
   * openThreadId synchronously (state updates are async) so an in-flight
   * fetch for a thread the user has since navigated away from can detect
   * it's stale and drop its result instead of clobbering the new thread's.
   */
  const [openThreadId, setOpenThreadId] = useState<number | string | null>(null);
  const openThreadIdRef = useRef<number | string | null>(null);
  const [openMessages, setOpenMessages] = useState<Message[]>([]);
  const [hasMoreOlderMessages, setHasMoreOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  // Failed/in-flight sends, keyed by participation id (stringified) — kept
  // here rather than per-conversation-component state so they survive a
  // thread switch, per the "keep failed messages across a thread switch"
  // requirement.
  const [pendingByThread, setPendingByThread] = useState<Record<string, PendingMessage[]>>({});

  // Phase 3: the OTHER party's last read time for the open conversation
  // only — reset on every open/close, refetched (not merged/patched) since
  // it's a single value with no local pending state of its own.
  const [seenAt, setSeenAt] = useState<number | null>(null);

  // Mirrors state.participations synchronously for the Realtime handlers
  // below (a stale closure over `state` would miss anything since the
  // channel effect was set up) — read-only, "is this id already something
  // I'm looking at" check for isRelevantParticipationEvent.
  const participationsRef = useRef<Participation[]>([]);

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
      // Phase 3: a "message" notification is never created anymore (Seen
      // + unread cover that job), but 16 pre-Phase-3 ones still exist live
      // — excluded here rather than deleted, so the bell's list and count
      // both quietly stop counting them without touching the rows. Phase 5
      // does the same for "hobby_follow": every one of those is a note to
      // yourself about your own action (toggleHobbyFollow below no longer
      // creates them), so old ones are hidden the same way rather than
      // deleted.
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .neq("kind", "message")
        .neq("kind", "hobby_follow")
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
    const { data: people, error: peopleError } = ids.size
      ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", [...ids])
      : { data: [] as any[], error: null };
    const byId = new Map((people ?? []).map((p: any) => [p.id, p]));
    const nameOf = (id?: string) => (id ? byId.get(id)?.display_name ?? "Someone" : undefined);

    setBlockedPeople(
      (blocks.data ?? []).map((b: any) => ({
        id: b.blocked_id,
        displayName: byId.get(b.blocked_id)?.display_name?.trim() || "Someone",
        avatarUrl: byId.get(b.blocked_id)?.avatar_url ?? undefined,
      })),
    );

    const mappedParticipations: Participation[] = (parts.data ?? []).map((p: any) => ({
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
    // A participation whose other party's profile didn't resolve — blocked
    // and hidden by is_visible_profile(), deleted, or paused, all look
    // identical here — is dropped before it ever reaches state. There's no
    // one there to show or to message, and showing it anyway (a "Someone"
    // thread with an open composer, as happened live) would both be
    // useless and risk revealing that a block is the reason.
    //
    // But only when the profiles lookup itself actually succeeded — on its
    // own failure, byId (and so resolvedProfileIds) is empty for a reason
    // that has nothing to do with any of these other parties, which looks
    // identical to "everyone got blocked": filtering on it would wipe every
    // chat out of state and then have startAndSendDirectMessage hit the
    // unique index trying to "start" a thread that already exists.
    const resolvedProfileIds = new Set(byId.keys());
    const participations = visibleParticipations(mappedParticipations, user.id, resolvedProfileIds, !peopleError);

    // Phase 2: one row per thread (count + latest message) feeds the
    // conversation list preview, the Message requests preview, and the
    // composer's one-message-while-pending rule, without loading every
    // thread's full history on every refresh. Falls back quietly to Phase
    // 1's own behavior — fetching full history for every messageable
    // thread — if the migration that adds this function isn't applied yet
    // in whatever environment this is running in (never a blank page).
    const { data: summaryRows, error: summaryError } = await supabase.rpc("participation_message_summaries");

    let summaries: ThreadSummary[] = [];
    let summariesAvailable = false;
    let fallbackMessages: Message[] = [];

    if (!summaryError && summaryRows) {
      summariesAvailable = true;
      summaries = (summaryRows as any[]).map((s) => ({
        participationId: s.participation_id,
        messageCount: s.message_count,
        lastMessageId: s.last_message_id,
        lastMessageFromUser: s.last_message_from_user,
        lastMessageBody: s.last_message_body,
        lastMessageCreatedAt: s.last_message_created_at ? new Date(s.last_message_created_at).getTime() : null,
        // Absent (an older migration) reads as 0 — no unread tracking
        // rather than a crash; Phase 3's own migration always includes it.
        unreadCount: s.unread_count ?? 0,
      }));
    } else {
      // Same subset and shape as before Phase 2: any accepted thread, plus
      // a pending or declined direct_message I'm party to (the recipient
      // needs to preview a pending request; the sender still sees their
      // own message in one that got declined).
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
      fallbackMessages = (msgs ?? []).map(mapMessageRow);
    }

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
      messages: fallbackMessages,
      summaries,
      summariesAvailable,
    });
  }, [user?.id]);

  /** Re-fetches just the open conversation's latest page and merges it in
   * (dedup by id) without disturbing already-loaded older pages or
   * pagination state — the safety net for reconnects/focus/the 60s
   * interval, cheaper than a full re-open. */
  const reloadOpenConversation = useCallback(async () => {
    if (!supabase || !user || openThreadIdRef.current == null) return;
    const id = openThreadIdRef.current;
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("participation_id", id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);
    if (openThreadIdRef.current !== id || error || !data) return;
    const rows = data.slice().reverse().map(mapMessageRow);
    setOpenMessages((prev) => {
      let next = prev;
      for (const row of rows) next = mergeMessage(next, row);
      return next;
    });
  }, [user?.id]);

  /** Re-fetches Seen for the open conversation only — a stale result (the
   * user switched or closed the thread mid-flight) is dropped the same way
   * every other open-thread fetch here is. */
  const refreshSeenAt = useCallback(async () => {
    if (!supabase || !user || openThreadIdRef.current == null) {
      setSeenAt(null);
      return;
    }
    const forThread = openThreadIdRef.current;
    const { data, error } = await supabase.rpc("thread_seen_at", { pid: forThread });
    if (openThreadIdRef.current !== forThread) return;
    if (error) return;
    setSeenAt(data ? new Date(data).getTime() : null);
  }, [user?.id]);

  const openConversation = useCallback(
    (participationId: number | string) => {
      openThreadIdRef.current = participationId;
      setOpenThreadId(participationId);
      setOpenMessages([]);
      setHasMoreOlderMessages(false);
      setSeenAt(null);
      if (!supabase || !user) return;
      (async () => {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("participation_id", participationId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(MESSAGE_PAGE_SIZE + 1);
        // The user may have switched threads (or left Messages) while this
        // was in flight — a stale result must never clobber the thread
        // that's actually open now.
        if (openThreadIdRef.current !== participationId || error || !data) return;
        const page = data.slice(0, MESSAGE_PAGE_SIZE).reverse().map(mapMessageRow);
        setOpenMessages(page);
        setHasMoreOlderMessages(data.length > MESSAGE_PAGE_SIZE);
      })();
      refreshSeenAt();
    },
    [user?.id, refreshSeenAt],
  );

  const closeConversation = useCallback(() => {
    openThreadIdRef.current = null;
    setOpenThreadId(null);
    setOpenMessages([]);
    setHasMoreOlderMessages(false);
    setLoadingOlderMessages(false);
    setSeenAt(null);
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!supabase || !user || openThreadId == null || !hasMoreOlderMessages || loadingOlderMessages) return;
    const oldest = openMessages[0];
    if (!oldest) return;
    setLoadingOlderMessages(true);
    const cursorIso = new Date(oldest.createdAt).toISOString();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("participation_id", openThreadId)
      .or(`created_at.lt.${cursorIso},and(created_at.eq.${cursorIso},id.lt.${oldest.id})`)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(MESSAGE_PAGE_SIZE + 1);
    if (openThreadIdRef.current !== openThreadId) {
      setLoadingOlderMessages(false);
      return;
    }
    if (error || !data) {
      setLoadingOlderMessages(false);
      return;
    }
    const page = data.slice(0, MESSAGE_PAGE_SIZE).reverse().map(mapMessageRow);
    setOpenMessages((prev) => prependOlderPage(prev, page));
    setHasMoreOlderMessages(data.length > MESSAGE_PAGE_SIZE);
    setLoadingOlderMessages(false);
  }, [openThreadId, hasMoreOlderMessages, loadingOlderMessages, openMessages, user?.id]);

  const refreshMessagesSafetyNet = useCallback(async () => {
    await refresh();
    await reloadOpenConversation();
  }, [refresh, reloadOpenConversation]);

  // Mirrors state.participations for the Realtime handlers below, which
  // are set up once per user and would otherwise close over a stale list.
  useEffect(() => {
    participationsRef.current = state.participations;
  }, [state.participations]);

  /* ── Phase 2/3: one Realtime channel per signed-in user ─────────────────
   * Created once per user, torn down automatically (this effect's own
   * cleanup) on sign-out or when the user changes. Every table here is
   * still governed by its own RLS — see the migrations' own comments — so
   * this never widens who receives what.
   */
  useEffect(() => {
    if (!supabase || !user) return;
    const client = supabase;
    const myUserId = user.id;

    const channel = client
      .channel(`social-updates-${myUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        const row = mapMessageRow(payload.new);
        setRemote((prev) => ({ ...prev, summaries: patchSummaryWithNewMessage(prev.summaries, row, myUserId) }));
        if (openThreadIdRef.current != null && String(openThreadIdRef.current) === String(row.participationId)) {
          setOpenMessages((prev) => mergeMessage(prev, row));
        }
        const key = String(row.participationId);
        setPendingByThread((prev) => {
          const list = prev[key];
          if (!list || list.length === 0) return prev;
          const next = reconcilePendingAfterIncoming(list, row);
          return next === list ? prev : { ...prev, [key]: next };
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (payload: any) => {
        // Phase 4: the only thing that ever updates a message is unsend —
        // lands here for BOTH parties (and my own other devices), so
        // "Message deleted" shows up live without either side reloading.
        const row = mapMessageRow(payload.new);
        if (openThreadIdRef.current != null && String(openThreadIdRef.current) === String(row.participationId)) {
          setOpenMessages((prev) => applyMessageUpdate(prev, row));
        }
        setRemote((prev) => ({ ...prev, summaries: patchSummaryOnMessageUpdate(prev.summaries, row) }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participations" }, (payload: any) => {
        // Narrowed (Phase 2 follow-up): a stranger's public join_in used to
        // trigger a full refresh() for everyone. Only refresh when the row
        // is actually mine, or already sitting in local state.
        const knownIds = new Set(participationsRef.current.map((p) => String(p.id)));
        if (isRelevantParticipationEvent("INSERT", payload.new, myUserId, knownIds)) refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "participations" }, (payload: any) => {
        const knownIds = new Set(participationsRef.current.map((p) => String(p.id)));
        if (isRelevantParticipationEvent("UPDATE", payload.new, myUserId, knownIds)) refresh();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "participations" }, (payload: any) => {
        // Postgres's default replica identity sends only the deleted row's
        // id on a DELETE — e.g. someone else's join_in leave, broadcast to
        // every other subscriber who could see that public row.
        const deletedId = payload.old?.id;
        if (deletedId == null) return;
        const knownIds = new Set(participationsRef.current.map((p) => String(p.id)));
        if (!isRelevantParticipationEvent("DELETE", { id: deletedId }, myUserId, knownIds)) return;
        setRemote((prev) => ({ ...prev, participations: applyParticipationDelete(prev.participations, deletedId) }));
        refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => {
        // Live bell — RLS already limits this to my own notifications.
        refresh();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "notifications" }, () => {
        // e.g. markAllRead from another of my own open tabs/devices.
        refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_reads" }, () => {
        // RLS limits this to my own rows only — another of my devices
        // marking a thread read updates my unread badge here too, without
        // needing that thread open. Never fires for someone else's read
        // (that's thread_seen_at()'s job, on its own explicit triggers).
        refresh();
      })
      .subscribe((status: string) => {
        // Fires on the initial connect and again after any reconnect —
        // the safety net for whatever happened while disconnected.
        if (status === "SUBSCRIBED") {
          refresh();
          reloadOpenConversation();
        }
      });

    return () => {
      client.removeChannel(channel);
    };
  }, [user?.id, refresh, reloadOpenConversation]);

  // Tab-visibility safety net — the other trigger alongside reconnects and
  // Messages.tsx's own 60-second interval. Also one of Seen's own explicit
  // refresh triggers ("on tab focus").
  useEffect(() => {
    if (!supabase || !user) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
        reloadOpenConversation();
        refreshSeenAt();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [user?.id, refresh, reloadOpenConversation, refreshSeenAt]);

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
        // Phase 5: retired — every hobby_follow notification was just a
        // note to yourself about your own action (recipient === actor,
        // always), so it never belonged in the bell. See the fetch filter
        // above for how old rows are hidden rather than deleted.
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
  const messagesFor = (participationId: number | string): Message[] => {
    // The one open conversation: its real, paginated history plus
    // whatever's still pending for it, oldest first.
    if (shared && openThreadId != null && String(participationId) === String(openThreadId)) {
      const pending = pendingByThread[String(participationId)] ?? [];
      return combineHistoryAndPending(openMessages, pending);
    }
    // Every other thread, once summaries are available: a one-message
    // preview synthesized from its summary row — never a full history
    // fetch just to answer "does it have a message" or "what was it".
    if (shared && state.summariesAvailable) {
      const s = state.summaries.find((s) => String(s.participationId) === String(participationId));
      if (!s || s.messageCount <= 0 || s.lastMessageId == null) return [];
      return [
        {
          id: s.lastMessageId,
          participationId,
          fromUser: s.lastMessageFromUser ?? "",
          // Already the server's own kind-aware preview text ("Photo",
          // "Message deleted", …) — rendered as plain text here, so `kind`
          // is always 'text' regardless of what the real message's kind is.
          body: s.lastMessageBody ?? "",
          kind: "text",
          createdAt: s.lastMessageCreatedAt ?? 0,
        },
      ];
    }
    // Local (signed-out) mode, or the Phase 1 fallback when
    // participation_message_summaries() isn't available yet.
    return state.messages
      .filter((m) => String(m.participationId) === String(participationId))
      .sort((a, b) => a.createdAt - b.createdAt);
  };

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

  /** Messages from the other person, newer than my own last_read_at, for
   * this one thread — bolds it in the list and feeds the Chats badge. */
  const unreadCountFor = (participationId: number | string): number => {
    const s = state.summaries.find((s) => String(s.participationId) === String(participationId));
    return s?.unreadCount ?? 0;
  };

  /** How many accepted "chats" threads have something unread — the
   * Chats-tab half of the header/tab-bar badge. Mirrors Messages.tsx's own
   * chatThreads filter (accepted, plus my own still-waiting outgoing
   * requests) rather than importing that page's component logic here. */
  const chatsUnreadCount = countUnreadThreads(
    state.participations
      .filter((p) => {
        if (messageTabFor(p, myId) !== "chats") return false;
        const otherId = p.fromUser === myId ? p.toUser : p.fromUser;
        return !isBlocked(otherId);
      })
      .map((p) => p.id),
    state.summaries,
  );

  /** Marks the given thread read as of now. The database enforces
   * accepted-only and party-only; a rejection here (a pending thread, a
   * stale id) is quietly ignored rather than surfaced — the UI simply
   * shouldn't have called this for a case where it can't succeed. */
  const markThreadRead = async (participationId: number | string) => {
    if (!supabase || !user) return;
    const { error } = await supabase.rpc("mark_conversation_read", { pid: participationId });
    if (error) return;
    setRemote((prev) => ({
      ...prev,
      summaries: prev.summaries.map((s) =>
        String(s.participationId) === String(participationId) ? { ...s, unreadCount: 0 } : s,
      ),
    }));
  };

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
      const { error: msgError } = await rawInsertMessage(
        newThread,
        "text",
        { body: body.trim() },
        newThread.status === "pending",
      );
      // Either way, this is a brand-new thread — refresh() once to bring
      // it (and its summary) into state, rather than the per-message
      // optimistic patching sendMessage does for an existing conversation.
      await refresh();
      if (msgError) {
        // The participation row is real even though its message failed —
        // pick it up so a retry lands in the same thread instead of
        // forking a second, unreachable one.
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
      messages: [...state.messages, { id: localId(), participationId: entry.id, fromUser: myId, body: body.trim(), kind: "text", createdAt: Date.now() }],
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
    // 23505 (unique_violation) here means the one-open-report-per-target
    // index rejected it: this exact report is already open. That's not a
    // failure from the reporter's point of view — it's already been told —
    // so it gets the same success response as a fresh insert, never a
    // "couldn't send that" that would prompt a retry into the same wall.
    if (error && error.code !== "23505") return { error: "failed" };
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
        // Phase 5: links to the specific Moment, not the generic /you, so
        // repeated Thoughts on different Moments can be told apart (and,
        // for the bell's own grouping, only ever merge with another
        // Thought on this SAME Moment). Never rewrites old rows' hrefs.
        await notify(postOwnerId, "thought", `${myName} left a thought on your moment.`, `/moment/${postId}`);
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

  /** Phase 5: marks a specific set of notifications read together — what
   * opening one bell GROUP does (every row folded into that line, not
   * just the newest one). `.eq("user_id", ...)` is belt-and-braces on top
   * of the existing "you update your own" RLS policy, same as every other
   * update in this file. */
  const markNotificationsRead = async (ids: Array<number | string>) => {
    if (ids.length === 0) return;
    if (supabase && user) {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).in("id", ids);
      refresh();
      return;
    }
    const idSet = new Set(ids.map(String));
    setState({
      ...state,
      notifications: state.notifications.map((n) => (idSet.has(String(n.id)) ? { ...n, read: true } : n)),
    });
  };

  /* ── Messages ───────────────────────────────────────────────────────── */
  // (messagesFor itself is declared up near isBlocked — messageRequests
  // needs it already defined by the time this component body reaches it.)

  // Shared by sendMessage (an existing thread) and startAndSendDirectMessage
  // (a thread just now inserted, before it's even in `state` yet) — both
  // just need somewhere to put a message and notify the other person, once
  // the caller has already decided the send is allowed. Unlike Phase 1's
  // insertMessage, this never refreshes — callers own updating local state
  // (optimistically, in sendMessage's case) so a send doesn't cost a full
  // reload of everything Messages doesn't even show.
  //
  // Phase 4: generalized from "body: string" to any of the four kinds — a
  // photo/moment/pursuit share is body: "" plus the one field that matches
  // its kind (see the database's own messages_kind_shape constraint).
  const rawInsertMessage = async (
    thread: Participation,
    kind: MessageKind,
    payload: { body: string; mediaPath?: string; sharedPostId?: number | string; sharedPursuitId?: string },
    isFirstPendingDm: boolean,
  ): Promise<{ data: any; error: "failed" | null }> => {
    if (!supabase || !user) return { data: null, error: null };
    const { data, error } = await supabase
      .from("messages")
      .insert({
        participation_id: thread.id,
        from_user: user.id,
        kind,
        body: payload.body,
        media_path: payload.mediaPath ?? null,
        shared_post_id: payload.sharedPostId ?? null,
        shared_pursuit_id: payload.sharedPursuitId ?? null,
      })
      .select()
      .single();
    // A block, a duplicate, a rate limit, a migration this depends on not
    // being applied yet — whatever the database's own reason, the caller
    // gets the same "failed" back either way. See SocialContextType.
    // sendMessage's own comment for why.
    if (error || !data) return { data: null, error: "failed" as const };
    // Phase 3: a bell notification for every message is exactly the noise
    // the quieter-bell goal is about — Seen and unread now do that job.
    // The message_request notification (once per request, not per message)
    // stays, same as follow requests. Only ever true for a plain-text
    // send anyway — a pending thread can't carry a photo/share at all.
    if (isFirstPendingDm) {
      const other = thread.fromUser === user.id ? thread.toUser : thread.fromUser;
      await notify(other, "message_request", `${myName} wants to message you.`, "/messages?tab=requests");
    }
    return { data, error: null };
  };

  /** The shared tail of every send (and every retry): insert, then either
   * mark the pending entry failed or fold the real row into state. Callers
   * are responsible for the pending entry already existing under `clientId`
   * before this runs (and, for a photo, for its upload having already
   * succeeded — see ensureUploaded). */
  const settleSend = async (
    thread: Participation,
    clientId: string,
    kind: MessageKind,
    payload: { body: string; mediaPath?: string; sharedPostId?: number | string; sharedPursuitId?: string },
    isFirstPendingDm: boolean,
  ): Promise<{ error: "failed" | null }> => {
    const key = String(thread.id);
    const { data, error } = await rawInsertMessage(thread, kind, payload, isFirstPendingDm);
    if (error || !data) {
      // Left in place as "failed" rather than removed — retryMessage reuses
      // this exact clientId (and, for a photo, its already-uploaded path),
      // so a retry can never create a second request row or a second copy
      // of the same photo.
      setPendingByThread((prev) => ({ ...prev, [key]: markPendingFailed(prev[key] ?? [], clientId) }));
      return { error: "failed" as const };
    }

    const real = mapMessageRow(data);
    setPendingByThread((prev) => {
      const list = prev[key] ?? [];
      const stale = list.find((p) => p.clientId === clientId);
      if (stale?.localPreviewUrl) URL.revokeObjectURL(stale.localPreviewUrl);
      return { ...prev, [key]: removePendingByClientId(list, clientId) };
    });
    // Dedupes by id against the Realtime echo, whichever arrives first.
    if (openThreadIdRef.current != null && String(openThreadIdRef.current) === key) {
      setOpenMessages((prev) => mergeMessage(prev, real));
    }
    setRemote((prev) => ({ ...prev, summaries: patchSummaryWithNewMessage(prev.summaries, real, myId) }));
    refreshSeenAt();
    return { error: null };
  };

  /** Uploads a photo pending entry's file, unless it already has a path
   * from an earlier attempt (a retry after the INSERT itself failed skips
   * re-uploading). Marks the entry failed and returns null on an upload
   * failure — the caller has nothing left to do at that point. */
  const ensureUploaded = async (
    thread: Participation,
    clientId: string,
    file: File,
    existingPath?: string,
  ): Promise<string | null> => {
    if (existingPath) return existingPath;
    const key = String(thread.id);
    const { path, error } = await uploadMessagePhoto(thread.id, file);
    if (error || !path) {
      setPendingByThread((prev) => ({ ...prev, [key]: markPendingFailed(prev[key] ?? [], clientId) }));
      return null;
    }
    setPendingByThread((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((p) => (p.clientId === clientId ? { ...p, uploadedPath: path } : p)),
    }));
    return path;
  };

  const sendMessage: SocialContextType["sendMessage"] = async (participationId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return { error: null };
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
      // Reflect the reopen locally right away — the participations
      // Realtime event (or the next refresh) confirms it, but the composer
      // shouldn't sit "waiting" for a round trip it just caused itself.
      setRemote((prev) => ({
        ...prev,
        participations: upsertParticipation(prev.participations, { ...thread, status: "accepted" }),
      }));
    }

    const isFirstPendingDm =
      thread.kind === "direct_message" && thread.status === "pending" && thread.fromUser === myId && !hasMessages;

    if (!supabase || !user) {
      setState({
        ...state,
        messages: [
          ...state.messages,
          { id: localId(), participationId: thread.id, fromUser: myId, body: trimmed, kind: "text", createdAt: Date.now() },
        ],
      });
      return { error: null };
    }

    // Appears immediately, marked "sending" — combineHistoryAndPending (via
    // messagesFor) puts it straight into the open conversation. Kept in
    // pendingByThread (not openMessages) so it survives a thread switch and
    // is never mistaken for confirmed history.
    const clientId = localId();
    const key = String(thread.id);
    setPendingByThread((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        {
          id: clientId,
          clientId,
          participationId: thread.id,
          fromUser: myId,
          body: trimmed,
          kind: "text" as const,
          createdAt: Date.now(),
          status: "sending" as const,
        },
      ],
    }));

    return settleSend(thread, clientId, "text", { body: trimmed }, isFirstPendingDm);
  };

  const sendPhotoMessage: SocialContextType["sendPhotoMessage"] = async (participationId, file) => {
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    if (!thread || !supabase || !user) return { error: "failed" as const };
    if (!canAttachInto(thread)) return { error: "failed" as const };

    const converted = await convertHeicIfNeeded(file);
    const clientId = localId();
    const key = String(thread.id);
    // The picked photo itself, shown immediately while it uploads — there's
    // no signed URL yet (nothing's been uploaded), so a local blob URL is
    // the only thing there is to show. Revoked once this entry is removed
    // (settleSend, on success) — see also closeConversation/unmount, which
    // don't need to revoke anything since pendingByThread outlives them.
    const localPreviewUrl = URL.createObjectURL(converted);
    setPendingByThread((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        {
          id: clientId,
          clientId,
          participationId: thread.id,
          fromUser: myId,
          body: "",
          kind: "photo" as const,
          createdAt: Date.now(),
          status: "sending" as const,
          file: converted,
          localPreviewUrl,
        },
      ],
    }));

    const path = await ensureUploaded(thread, clientId, converted);
    if (!path) return { error: "failed" as const };
    return settleSend(thread, clientId, "photo", { body: "", mediaPath: path }, false);
  };

  const shareMoment: SocialContextType["shareMoment"] = async (participationId, postId) => {
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    if (!thread || !supabase || !user) return { error: "failed" as const };
    if (!canAttachInto(thread)) return { error: "failed" as const };

    const clientId = localId();
    const key = String(thread.id);
    setPendingByThread((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        {
          id: clientId,
          clientId,
          participationId: thread.id,
          fromUser: myId,
          body: "",
          kind: "moment" as const,
          sharedPostId: typeof postId === "string" ? Number(postId) : postId,
          createdAt: Date.now(),
          status: "sending" as const,
        },
      ],
    }));
    return settleSend(thread, clientId, "moment", { body: "", sharedPostId: postId }, false);
  };

  const sharePursuit: SocialContextType["sharePursuit"] = async (participationId, pursuitId) => {
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    if (!thread || !supabase || !user) return { error: "failed" as const };
    if (!canAttachInto(thread)) return { error: "failed" as const };

    const clientId = localId();
    const key = String(thread.id);
    setPendingByThread((prev) => ({
      ...prev,
      [key]: [
        ...(prev[key] ?? []),
        {
          id: clientId,
          clientId,
          participationId: thread.id,
          fromUser: myId,
          body: "",
          kind: "pursuit" as const,
          sharedPursuitId: pursuitId,
          createdAt: Date.now(),
          status: "sending" as const,
        },
      ],
    }));
    return settleSend(thread, clientId, "pursuit", { body: "", sharedPursuitId: pursuitId }, false);
  };

  const retryMessage: SocialContextType["retryMessage"] = async (participationId, clientId) => {
    if (!supabase || !user) return;
    const key = String(participationId);
    const entry = (pendingByThread[key] ?? []).find((p) => p.clientId === clientId);
    if (!entry) return; // already resolved elsewhere — nothing to retry
    const thread = state.participations.find((p) => String(p.id) === String(participationId));
    if (!thread) return;

    setPendingByThread((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).map((p) => (p.clientId === clientId ? { ...p, status: "sending" as const } : p)),
    }));

    if (entry.kind === "photo") {
      if (!entry.file) return; // a photo pending entry always carries its file
      const path = await ensureUploaded(thread, clientId, entry.file, entry.uploadedPath);
      if (!path) return;
      await settleSend(thread, clientId, "photo", { body: "", mediaPath: path }, false);
      return;
    }
    if (entry.kind === "moment") {
      if (entry.sharedPostId == null) return;
      await settleSend(thread, clientId, "moment", { body: "", sharedPostId: entry.sharedPostId }, false);
      return;
    }
    if (entry.kind === "pursuit") {
      if (entry.sharedPursuitId == null) return;
      await settleSend(thread, clientId, "pursuit", { body: "", sharedPursuitId: entry.sharedPursuitId }, false);
      return;
    }

    // Whether this was the thread's very first message, for which
    // notification to send — based on confirmed history alone (excluding
    // the very entry being retried, which would otherwise always count
    // itself as "already has a message").
    const hasConfirmedMessages = messagesFor(participationId).some((m) => m.clientId !== clientId);
    const isFirstPendingDm =
      thread.kind === "direct_message" &&
      thread.status === "pending" &&
      thread.fromUser === myId &&
      !hasConfirmedMessages;
    await settleSend(thread, clientId, "text", { body: entry.body }, isFirstPendingDm);
  };

  /** Deletes your own message for both of you (Phase 4) — clears its
   * content and marks it deleted, never a hard delete (see unsend_message()
   * in the database, which is also the ONLY place that enforces "only the
   * sender"; this function doesn't re-check that itself). Only ever called
   * from the UI on the currently open conversation, so `messagesFor` here
   * is that thread's real, loaded history — including mediaPath, which the
   * one-message summary preview other threads get never carries. */
  const unsendMessage: SocialContextType["unsendMessage"] = async (participationId, messageId) => {
    if (!supabase || !user) return { error: "failed" as const };
    const existing = messagesFor(participationId).find((m) => String(m.id) === String(messageId));
    const { error } = await supabase.rpc("unsend_message", { message_id: messageId });
    if (error) return { error: "failed" as const };

    const updated: Message = {
      id: messageId,
      participationId,
      fromUser: existing?.fromUser ?? myId,
      body: "",
      kind: existing?.kind ?? "text",
      mediaPath: null,
      sharedPostId: null,
      sharedPursuitId: null,
      deletedAt: Date.now(),
      createdAt: existing?.createdAt ?? Date.now(),
    };
    // Optimistic — the Realtime UPDATE (or the other party's own fetch)
    // confirms it, but no need to wait on a round trip this call just caused.
    setOpenMessages((prev) => applyMessageUpdate(prev, updated));
    setRemote((prev) => ({ ...prev, summaries: patchSummaryOnMessageUpdate(prev.summaries, updated) }));
    if (existing?.mediaPath) {
      // Best-effort: the message row is already cleared (that's the real
      // security boundary) — a failure here just leaves an orphaned object
      // nobody but the two former parties could ever have read anyway.
      deleteMessagePhoto(existing.mediaPath).catch(() => {});
    }
    return { error: null };
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
        markNotificationsRead,
        messagesFor,
        sendMessage,
        retryMessage,
        sendPhotoMessage,
        shareMoment,
        sharePursuit,
        unsendMessage,
        openConversation,
        closeConversation,
        hasMoreOlderMessages,
        loadingOlderMessages,
        loadOlderMessages,
        unreadCountFor,
        chatsUnreadCount,
        markThreadRead,
        seenAt,
        refreshSeenAt,
        refresh,
        refreshMessagesSafetyNet,
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
