import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Handshake, MessageCircle, MessagesSquare, Send } from "lucide-react";
import { useSocial, Participation, Message } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { usePeopleSearch, profilePath } from "../lib/people";
import { canSendInto, messageTabFor } from "../lib/messageTabs";
import { formatBadgeCount, isSeenByOther, shouldMarkThreadRead } from "../lib/messageSync";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { PersonActionsMenu } from "../components/PersonActionsMenu";
import { BlockConfirmDialog } from "../components/BlockConfirmDialog";
import { ReportDialog } from "../components/ReportDialog";

/**
 * Messages live inside an accepted Make together or Explore together, or a
 * direct message either side sent (see SocialContext.tsx's
 * startAndSendDirectMessage() — the "Message" button on a profile, and this
 * page's own "New message" picker, open to anyone found by name). Neither of
 * those ever creates a participation row on its own: opening a conversation
 * with someone new is a "draft" that exists only in this page's own state
 * (see `draftThread` below) until its first message is actually sent, so
 * nobody can end up with an empty request sitting in someone else's Message
 * requests tab. A thread can also arrive already selected via `?thread=`
 * (an existing thread) or as a draft via `?draftWith=&draftName=` (nothing
 * exists yet), e.g. from a "Message" tap on someone's profile.
 *
 * Two tabs: Chats (accepted threads, plus your own outgoing direct_message
 * requests still waiting — pending or declined) and Message requests
 * (pending direct_message requests from people you don't yet follow,
 * waiting on you to accept or ignore). Accepting one never creates a
 * follow; it just makes the thread a normal chat.
 */
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** The empty-conversation line above the composer. The "you both agreed to…"
 * quote only makes sense for a Make/Explore together request with an actual
 * intent on it — never for a direct message, and never rendered as an empty
 * pair of quotes when intent is missing. */
function emptyStateFor(active: Participation | null, otherName: string): string {
  if (active && (active.kind === "make_together" || active.kind === "explore_together") && active.intent) {
    return `You both agreed to "${active.intent}", this is where that happens.`;
  }
  return `Say hi to ${otherName}.`;
}

/** Same missing-intent guard as emptyStateFor, for the conversation header's
 * subtitle line — an intent-less Make/Explore together thread shouldn't say
 * "Making together · undefined". */
function subtitleFor(active: Participation): string {
  if (active.kind === "make_together") return active.intent ? `Making together · ${active.intent}` : "Making together";
  if (active.kind === "explore_together") return active.intent ? `Exploring together · ${active.intent}` : "Exploring together";
  return "Direct message";
}

function ConversationPanel({
  person,
  subtitle,
  messages,
  myId,
  emptyText,
  bannerText,
  composerDisabled,
  composerPlaceholder,
  draft,
  onDraftChange,
  onSend,
  sendError,
  hasMoreOlder,
  loadingOlder,
  onLoadOlder,
  onRetry,
  seenAt,
  onAtBottomChange,
}: {
  person: { id: string; name: string };
  subtitle: string;
  messages: Message[];
  myId: string | undefined;
  emptyText: string;
  bannerText: string | null;
  composerDisabled: boolean;
  composerPlaceholder: string;
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: () => void;
  sendError: string | null;
  hasMoreOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  onRetry: (clientId: string) => void;
  /** The other party's read time for this thread, or null — see
   * SocialContext's seenAt. Shows "Seen" under your own latest message
   * only, and only while it's genuinely the last message in the thread. */
  seenAt: number | null;
  /** Fires whenever "at the bottom" changes, so the parent can decide when
   * to mark the thread read (Phase 3) without duplicating scroll logic. */
  onAtBottomChange?: (atBottom: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottomState] = useState(true);
  const setAtBottom = (next: boolean) => {
    setAtBottomState((prev) => {
      if (prev !== next) onAtBottomChange?.(next);
      return next;
    });
  };
  const [newMessageCount, setNewMessageCount] = useState(0);
  const prevFirstIdRef = useRef<string | number | undefined>(undefined);
  const prevLastIdRef = useRef<string | number | undefined>(undefined);
  const prevScrollHeightRef = useRef<number | null>(null);

  // Switching to a different conversation entirely — snap to the bottom,
  // don't carry over the previous thread's "new messages" pill or scroll
  // memory.
  useLayoutEffect(() => {
    setAtBottom(true);
    setNewMessageCount(0);
    prevFirstIdRef.current = undefined;
    prevLastIdRef.current = undefined;
    prevScrollHeightRef.current = null;
    endRef.current?.scrollIntoView({ block: "end" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.id]);

  // Distinguishes an older page landing at the front (restore scroll
  // position so nothing visually jumps) from a new message landing at the
  // end (pin to bottom if already there, otherwise show the pill instead
  // of yanking the view down).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const firstId = messages[0]?.id;
    const lastId = messages[messages.length - 1]?.id;
    const firstChanged = firstId !== prevFirstIdRef.current;
    const lastChanged = lastId !== prevLastIdRef.current;

    if (el && firstChanged && prevScrollHeightRef.current != null) {
      el.scrollTop += el.scrollHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (lastChanged && prevLastIdRef.current !== undefined) {
      if (atBottom) {
        endRef.current?.scrollIntoView({ block: "end" });
      } else {
        setNewMessageCount((n) => n + 1);
      }
    }
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current = lastId;
  }, [messages, atBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAtBottom(nearBottom);
    if (nearBottom) setNewMessageCount(0);
    if (el.scrollTop < 80 && hasMoreOlder && !loadingOlder) {
      prevScrollHeightRef.current = el.scrollHeight;
      onLoadOlder();
    }
  };

  const scrollToBottom = () => {
    setNewMessageCount(0);
    setAtBottom(true);
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  };

  return (
    <div className="flex h-[26rem] flex-col rounded-2xl border border-border bg-card md:h-[36rem]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
            {person.name}
          </div>
          <div className="text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <PersonActionsMenu personId={person.id} personName={person.name} />
      </div>

      <div className="relative flex-1 min-h-0">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full space-y-2 overflow-y-auto px-4 py-4">
          {loadingOlder && (
            <p className="pb-1 text-center text-[11px] text-muted-foreground">Loading earlier messages…</p>
          )}
          {bannerText && (
            <p className="mb-2 rounded-xl bg-surface-muted px-3.5 py-2.5 text-center text-xs text-muted-foreground">
              {bannerText}
            </p>
          )}
          {messages.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{emptyText}</p>
          ) : (
            messages.map((m, i) => {
              const mine = m.fromUser === (myId ?? "local-user");
              // "Seen" only ever sits under your own latest message, and
              // only while it's genuinely the last one in the thread — once
              // they reply, that reply itself is proof enough.
              const isLastMessage = i === messages.length - 1;
              const showSeen =
                mine && isLastMessage && !m.status && isSeenByOther(m.createdAt, seenAt);
              return (
                <div key={m.id} className={mine ? "ml-auto max-w-[80%]" : "max-w-[80%]"}>
                  <div
                    className={`rounded-2xl px-3.5 py-2 text-sm ${
                      m.status === "failed"
                        ? "border border-dashed border-[var(--coral-text)] bg-surface-muted text-foreground"
                        : mine
                          ? `text-white [background-color:var(--coral-deep)] ${m.status === "sending" ? "opacity-60" : ""}`
                          : "bg-surface-muted"
                    }`}
                  >
                    {m.body}
                  </div>
                  {m.status === "failed" && m.clientId && (
                    <button
                      type="button"
                      onClick={() => onRetry(m.clientId!)}
                      className="mt-0.5 block text-[11px] text-[var(--coral-text)] underline-offset-2 hover:underline"
                    >
                      Not sent · Tap to retry
                    </button>
                  )}
                  {showSeen && <p className="mt-0.5 text-right text-[11px] text-muted-foreground">Seen</p>}
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
        {newMessageCount > 0 && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--coral-deep)] px-3.5 py-1.5 text-xs text-white shadow"
          >
            New message{newMessageCount > 1 ? "s" : ""}
          </button>
        )}
      </div>

      <div className="flex gap-2 border-t border-[var(--hairline)] p-3">
        <Input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          disabled={composerDisabled}
          placeholder={composerPlaceholder}
          className="flex-1"
        />
        <Button variant="coral" size="icon" onClick={onSend} aria-label="Send" disabled={composerDisabled}>
          <Send className="size-4" />
        </Button>
      </div>
      {sendError && (
        <p className="border-t border-[var(--hairline)] px-4 py-2 text-xs text-[var(--coral-text)]">
          {sendError}
        </p>
      )}
    </div>
  );
}

export function Messages() {
  const social = useSocial();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(() => (searchParams.get("tab") === "requests" ? "requests" : "chats"));
  // Set once, from whatever ?thread= arrived with (a "Message" tap on a
  // profile navigates here with an existing thread's id already known) —
  // never re-read after that, so picking a different thread in the list
  // below isn't fought by the URL on every render.
  const [activeId, setActiveId] = useState<string | number | null>(() => searchParams.get("thread"));
  // A conversation someone tapped "Message" into that has no participation
  // row yet — set once, from ?draftWith=&draftName=, or from the "New
  // message" picker below. Cleared the moment the real thread exists
  // (its first message sent, or it turns out one already existed after
  // all — see the effect below).
  const [draftThread, setDraftThread] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("draftWith");
    const name = searchParams.get("draftName");
    return id && name ? { id, name } : null;
  });
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const { people, loading } = usePeopleSearch(query);
  const results = people.filter((p) => p.id !== user?.id && !social.blockedIds.includes(p.id));

  // Live updates (Realtime, in SocialContext) replace polling for anything
  // actually happening while this page is open. This interval is only the
  // safety net: reconnects and tab-focus already trigger the same refresh,
  // this just guarantees it happens at least once a minute regardless.
  useEffect(() => {
    const interval = setInterval(() => {
      social.refreshMessagesSafetyNet();
    }, 60000);
    return () => clearInterval(interval);
  }, [social.refreshMessagesSafetyNet]);

  // A draft can turn out to already have a real, reachable thread behind
  // it — another tab sent the first message, or (defensively) this one
  // already did — in which case it isn't a draft any more. A request of
  // theirs I declined doesn't count: it exists, but it's hidden from Chats
  // until sending actually un-declines it (see startAndSendDirectMessage),
  // so the draft stays a draft until then.
  useEffect(() => {
    if (!draftThread) return;
    const existing = social.findExistingThread(draftThread.id);
    if (existing && messageTabFor(existing, user?.id ?? "") === "chats") {
      setActiveId(existing.id);
      setDraftThread(null);
      setTab("chats");
    }
  }, [draftThread, social]);

  // Accepted threads of any kind, plus your own direct_message requests
  // still waiting on the other person (pending, or declined — a decline
  // doesn't free you to open a second thread; see startAndSendDirectMessage).
  // A blocked person's older accepted thread can still be sitting in
  // already-fetched state — blocking doesn't retroactively delete it, only
  // stops new messages in it (enforced by the database either way; this is
  // just so it doesn't still show in the list).
  const otherPartyOf = (p: Participation) => (user && p.fromUser === user.id ? p.toUser : p.fromUser);
  const chatThreads = social.participations
    .filter(
      (p) =>
        messageTabFor(p, user?.id ?? "") === "chats" && !social.blockedIds.includes(otherPartyOf(p) ?? ""),
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  const requests = social.messageRequests;

  const active = draftThread ? undefined : chatThreads.find((t) => String(t.id) === String(activeId)) ?? chatThreads[0];

  // The one thread on screen gets its real, paginated history (see
  // SocialContext's openConversation) — everything else relies on its
  // summary alone. Closes on unmount too, so leaving Messages entirely
  // stops paying for a full history load.
  useEffect(() => {
    if (!active) {
      social.closeConversation();
      return;
    }
    social.openConversation(active.id);
  }, [active?.id]);
  useEffect(() => () => social.closeConversation(), []);

  const messages = active ? social.messagesFor(active.id) : [];
  const hasMessages = messages.length > 0;
  const handleRetry = (clientId: string) => {
    if (!active) return;
    social.retryMessage(active.id, clientId);
  };

  // Phase 3: mark-as-read needs "the tab is actually visible" and "you're
  // scrolled to the newest message" alongside "a thread is open" — the
  // latter two aren't things SocialContext can know on its own.
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const [atBottom, setAtBottom] = useState(true);
  useEffect(() => {
    const onVisibilityChange = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Debounced: fires ~1s after all three conditions hold, and again if a
  // new message arrives while they still do (messages.length in the deps).
  // Only ever for an accepted thread — mark_conversation_read rejects
  // anything else anyway, but there's nothing of the other person's to
  // read yet on my own still-pending outgoing request.
  useEffect(() => {
    if (!active || active.status !== "accepted") return;
    if (!shouldMarkThreadRead({ threadOpen: true, tabVisible, atBottom })) return;
    const timer = setTimeout(() => {
      social.markThreadRead(active.id);
    }, 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.status, tabVisible, atBottom, messages.length]);

  // Seen refresh: on open (SocialContext's own openConversation) and after
  // you send (sendMessage/retryMessage) are handled in SocialContext
  // itself; this covers "every 15 seconds while your last message isn't
  // yet seen" — and only then, so it stops polling the moment it's seen.
  useEffect(() => {
    if (!active || active.status !== "accepted") return;
    const myLastMessage = [...messages].reverse().find((m) => m.fromUser === user?.id && !m.status);
    if (!myLastMessage || isSeenByOther(myLastMessage.createdAt, social.seenAt)) return;
    const interval = setInterval(() => {
      social.refreshSeenAt();
    }, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.status, messages, social.seenAt]);
  const otherId = active && user ? (active.fromUser === user.id ? active.toUser : active.fromUser) : undefined;
  const otherName =
    active && user
      ? active.fromUser === user.id
        ? active.toName ?? "Them"
        : active.fromName
      : active
        ? active.toName ?? active.fromName
        : "";

  const composerDisabled = draftThread ? false : active ? !canSendInto(active, user?.id ?? "", hasMessages) : true;
  // Only worth announcing once there's actually a message sitting in the
  // thread the other person hasn't answered yet — a freshly (re-)created
  // pending row with nothing in it yet (a retry after a failed send) is
  // just an open composer, not something to wait on.
  const isWaiting =
    !!active &&
    active.kind === "direct_message" &&
    active.fromUser === user?.id &&
    active.status !== "accepted" &&
    hasMessages;

  const send = async () => {
    if (!draft.trim()) return;

    if (draftThread) {
      setSendError(null);
      const { id, error } = await social.startAndSendDirectMessage(draftThread.id, draftThread.name, draft);
      if (id != null) {
        // The participation row is real now even if the message failed to
        // land — drop into it as a normal (still-empty, still-sendable)
        // thread instead of staying stuck in draft mode, so a retry goes
        // through the ordinary send path below rather than trying to
        // insert a second row.
        setDraftThread(null);
        setTab("chats");
        setActiveId(id);
      }
      if (error) {
        setSendError("Couldn't send that. Try again later.");
        return;
      }
      setDraft("");
      return;
    }

    if (!active || composerDisabled) return;
    setSendError(null);
    // Clears right away regardless of outcome — the message itself now
    // appears immediately in the thread (see ConversationPanel), "sending"
    // or, on failure, "Not sent · Tap to retry" in place. There's nothing
    // left to redo from the composer; a retry taps the message itself.
    setDraft("");
    await social.sendMessage(active.id, draft);
  };

  const openPicker = () => {
    setStartError(null);
    setQuery("");
    setPickerOpen(true);
  };

  const startThreadWith = (person: { id: string; name: string }) => {
    setStartError(null);
    // Same rule as PublicProfile.tsx's "Message" button: only jump straight
    // into a thread that's actually reachable as a chat. A request of
    // theirs I declined is hidden from Chats but still reopenable — that
    // goes through a fresh draft instead, same as someone brand new.
    const existing = social.findExistingThread(person.id);
    if (existing && messageTabFor(existing, user?.id ?? "") === "chats") {
      setDraftThread(null);
      setTab("chats");
      setActiveId(existing.id);
    } else {
      setDraftThread({ id: person.id, name: person.name });
      setTab("chats");
      setActiveId(null);
    }
    setPickerOpen(false);
  };

  const newMessageDialog = (
    <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>New message</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people by name"
            autoFocus
          />
          {query.trim().length < 2 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Type a name to find someone.
            </p>
          ) : loading ? (
            <p className="py-6 text-center text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">No one found.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => startThreadWith({ id: person.id, name: person.displayName })}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                  >
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(person.displayName)}</AvatarFallback>
                    </Avatar>
                    {person.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {startError && <p className="text-xs text-[var(--coral-text)]">{startError}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );

  const requestCount = requests.length;

  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Messages
          </h1>
          <Button variant="coral" size="sm" onClick={openPicker}>
            New message
          </Button>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          People who accepted making or exploring something together, and anyone who's sent or
          received a direct message.
        </p>
        {newMessageDialog}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="chats">Chats</TabsTrigger>
            <TabsTrigger value="requests">
              Message requests{requestCount > 0 ? ` (${requestCount})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chats">
            {!draftThread && chatThreads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-14 text-center">
                <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-surface-muted text-foreground">
                  <MessagesSquare className="size-6" />
                </span>
                <h2 className="mb-2 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
                  No open threads
                </h2>
                <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  Nothing yet. A thread opens when someone accepts a Make together or Explore
                  together request, or when you send someone a direct message from their profile.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Link to="/discover">
                    <Button variant="outline">Find someone to make something with</Button>
                  </Link>
                  <Button variant="coral" onClick={openPicker}>
                    New message
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
                <ul className="space-y-2">
                  {chatThreads.map((t) => {
                    const name = user && t.fromUser === user.id ? t.toName ?? "Them" : t.fromName;
                    const on = !draftThread && String(t.id) === String(active?.id);
                    const waiting =
                      t.kind === "direct_message" &&
                      t.fromUser === user?.id &&
                      t.status !== "accepted" &&
                      social.messagesFor(t.id).length > 0;
                    const unread = social.unreadCountFor(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setDraftThread(null);
                            setActiveId(t.id);
                          }}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                            on ? "border-[var(--coral-deep)] bg-card" : "border-border bg-card hover:border-[var(--foreground)]/30"
                          }`}
                        >
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-[10px]">{initials(name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0 flex-1">
                            <span className={`block truncate text-sm ${unread > 0 ? "font-semibold" : ""}`}>
                              {name}
                            </span>
                            <span className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                              {t.kind === "make_together" ? (
                                <Handshake className="size-3" />
                              ) : t.kind === "explore_together" ? (
                                <MessagesSquare className="size-3" />
                              ) : (
                                <MessageCircle className="size-3" />
                              )}
                              {waiting ? "Waiting to accept" : t.kind === "direct_message" ? "Direct message" : t.intent}
                            </span>
                          </span>
                          {unread > 0 && (
                            <span
                              className="flex size-4 shrink-0 items-center justify-center rounded-full [background-color:var(--coral-deep)] text-[10px] text-white"
                              aria-label={`${unread} unread`}
                            >
                              {formatBadgeCount(unread)}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {draftThread ? (
                  <ConversationPanel
                    person={draftThread}
                    subtitle="Direct message"
                    messages={[]}
                    myId={user?.id}
                    emptyText={emptyStateFor(null, draftThread.name)}
                    bannerText={null}
                    composerDisabled={false}
                    composerPlaceholder={`Message ${draftThread.name}`}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={send}
                    sendError={sendError}
                    hasMoreOlder={false}
                    loadingOlder={false}
                    onLoadOlder={() => {}}
                    onRetry={handleRetry}
                    seenAt={null}
                  />
                ) : (
                  active && (
                    <ConversationPanel
                      person={{ id: otherId ?? "", name: otherName }}
                      subtitle={subtitleFor(active)}
                      messages={messages}
                      myId={user?.id}
                      emptyText={emptyStateFor(active, otherName)}
                      bannerText={isWaiting ? `Waiting for ${otherName} to accept.` : null}
                      composerDisabled={composerDisabled}
                      composerPlaceholder={composerDisabled ? `Waiting for ${otherName} to accept` : `Message ${otherName}`}
                      draft={draft}
                      onDraftChange={setDraft}
                      onSend={send}
                      sendError={sendError}
                      hasMoreOlder={social.hasMoreOlderMessages}
                      loadingOlder={social.loadingOlderMessages}
                      onLoadOlder={social.loadOlderMessages}
                      onRetry={handleRetry}
                      seenAt={active.status === "accepted" ? social.seenAt : null}
                      onAtBottomChange={setAtBottom}
                    />
                  )
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-5 py-14 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing waiting. A first message from someone you don't follow shows up here,
                  to accept or ignore.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {requests.map((r) => (
                  <RequestCard key={r.id} request={r} />
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function RequestCard({ request }: { request: Participation }) {
  const social = useSocial();
  const [busy, setBusy] = useState<"accept" | "ignore" | null>(null);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const message = social.messagesFor(request.id)[0];

  return (
    <li className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Link to={profilePath({ id: request.fromUser })} className="shrink-0">
          <Avatar className="size-9">
            <AvatarFallback className="text-[10px]">{initials(request.fromName)}</AvatarFallback>
          </Avatar>
        </Link>
        <Link to={profilePath({ id: request.fromUser })} className="min-w-0 flex-1">
          <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
            {request.fromName}
          </span>
        </Link>
      </div>
      {message && (
        <p className="mt-2.5 rounded-xl bg-surface-muted px-3.5 py-2.5 text-sm">{message.body}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="coral"
          size="sm"
          disabled={!!busy}
          onClick={async () => {
            setBusy("accept");
            await social.acceptRequest(request.id);
            setBusy(null);
          }}
        >
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={async () => {
            setBusy("ignore");
            await social.ignoreRequest(request.id);
            setBusy(null);
          }}
        >
          Ignore
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)}>
          Block
        </Button>
        <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
          Report
        </Button>
      </div>
      <BlockConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        personId={request.fromUser}
        personName={request.fromName}
      />
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetUserId={request.fromUser}
        targetKind="profile"
        personName={request.fromName}
      />
    </li>
  );
}
