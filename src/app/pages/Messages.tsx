import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Handshake, MessageCircle, MessagesSquare, Send } from "lucide-react";
import { useSocial, Participation } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { usePeopleSearch, profilePath } from "../lib/people";
import { messageTabFor } from "../lib/messageTabs";
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
 * startDirectMessage() — the "Message" button on a profile, and this page's
 * own "New message" picker, open to anyone found by name). A thread can also
 * arrive already selected via `?thread=`, e.g. from a "Message" tap on
 * someone's profile.
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

export function Messages() {
  const social = useSocial();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<string>(() => (searchParams.get("tab") === "requests" ? "requests" : "chats"));
  // Set once, from whatever ?thread= arrived with (a "Message" tap on a
  // profile navigates here with the new-or-reused thread's id already known)
  // — never re-read after that, so picking a different thread in the list
  // below isn't fought by the URL on every render.
  const [activeId, setActiveId] = useState<string | number | null>(() => searchParams.get("thread"));
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const { people, loading } = usePeopleSearch(query);
  const results = people.filter((p) => p.id !== user?.id && !social.blockedIds.includes(p.id));

  useEffect(() => {
    const interval = setInterval(() => {
      social.refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [social.refresh]);

  // Accepted threads of any kind, plus your own direct_message requests
  // still waiting on the other person (pending, or declined — a decline
  // doesn't free you to open a second one; see startDirectMessage).
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

  const active = chatThreads.find((t) => String(t.id) === String(activeId)) ?? chatThreads[0];
  const messages = active ? social.messagesFor(active.id) : [];
  // My own request the other person hasn't accepted yet — pending or
  // declined either way looks the same from here: nothing to do but wait.
  const isWaiting = !!active && active.kind === "direct_message" && active.fromUser === user?.id && active.status !== "accepted";
  const otherId = active && user ? (active.fromUser === user.id ? active.toUser : active.fromUser) : undefined;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, active?.id]);

  const otherName =
    active && user
      ? active.fromUser === user.id
        ? active.toName ?? "Them"
        : active.fromName
      : active
        ? active.toName ?? active.fromName
        : "";

  const send = async () => {
    if (!active || !draft.trim() || isWaiting) return;
    setSendError(null);
    const { error } = await social.sendMessage(active.id, draft);
    if (error) {
      setSendError("Couldn't send that. Try again later.");
      return;
    }
    setDraft("");
  };

  const openPicker = () => {
    setStartError(null);
    setQuery("");
    setPickerOpen(true);
  };

  const startThreadWith = async (person: { id: string; name: string }) => {
    setStartError(null);
    const result = await social.startDirectMessage(person.id, person.name);
    if (result.id) {
      setTab("chats");
      setActiveId(result.id);
      setPickerOpen(false);
    } else if (result.error === "self") {
      setStartError("That's your own account.");
    } else {
      // Same wording whatever the actual cause — a block, a rate limit, a
      // network error — so this can never reveal that a block exists.
      setStartError("Couldn't start that conversation. Try again.");
    }
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
            {chatThreads.length === 0 ? (
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
                    const on = String(t.id) === String(active?.id);
                    const waiting = t.kind === "direct_message" && t.fromUser === user?.id && t.status !== "accepted";
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(t.id)}
                          className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                            on ? "border-[var(--coral-deep)] bg-card" : "border-border bg-card hover:border-[var(--foreground)]/30"
                          }`}
                        >
                          <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-[10px]">{initials(name ?? "?")}</AvatarFallback>
                          </Avatar>
                          <span className="min-w-0">
                            <span className="block truncate text-sm">{name}</span>
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
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {active && (
                  <div className="flex min-h-[26rem] flex-col rounded-2xl border border-border bg-card">
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                          {otherName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {active.kind === "make_together"
                            ? `Making together · ${active.intent}`
                            : active.kind === "explore_together"
                              ? `Exploring together · ${active.intent}`
                              : "Direct message"}
                        </div>
                      </div>
                      {otherId && <PersonActionsMenu personId={otherId} personName={otherName} />}
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                      {isWaiting && (
                        <p className="mb-2 rounded-xl bg-surface-muted px-3.5 py-2.5 text-center text-xs text-muted-foreground">
                          Waiting for {otherName} to accept.
                        </p>
                      )}
                      {messages.length === 0 ? (
                        <p className="py-8 text-center text-xs text-muted-foreground">
                          Nothing yet. You both agreed to “{active.intent}”, this is where
                          that happens.
                        </p>
                      ) : (
                        messages.map((m) => {
                          const mine = m.fromUser === (user?.id ?? "local-user");
                          return (
                            <div
                              key={m.id}
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${
                                mine
                                  ? "ml-auto text-white [background-color:var(--coral-deep)]"
                                  : "bg-surface-muted"
                              }`}
                            >
                              {m.body}
                            </div>
                          );
                        })
                      )}
                      <div ref={endRef} />
                    </div>

                    <div className="flex gap-2 border-t border-[var(--hairline)] p-3">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            send();
                          }
                        }}
                        disabled={isWaiting}
                        placeholder={isWaiting ? `Waiting for ${otherName} to accept` : `Message ${otherName}`}
                        className="flex-1"
                      />
                      <Button variant="coral" size="icon" onClick={send} aria-label="Send" disabled={isWaiting}>
                        <Send className="size-4" />
                      </Button>
                    </div>
                    {sendError && (
                      <p className="border-t border-[var(--hairline)] px-4 py-2 text-xs text-[var(--coral-text)]">
                        {sendError}
                      </p>
                    )}
                  </div>
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
