import { useState } from "react";
import { Link } from "react-router";
import { Bell, Check, Inbox as InboxIcon, MessageSquare, Send, UserPlus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useConnections, type Person } from "../context/ConnectionsContext";
import { useSocial } from "../context/SocialContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

/**
 * Inbox: everything addressed to you, in one place.
 *
 *   Messages   only with people you've accepted, or Spaces you've joined
 *   Requests   connection requests and Space invitations, waiting on you
 *   Activity   everything else that happened — thoughts, accepts, invites
 *
 * There is no way to start a conversation from here with someone you aren't
 * connected to, which is the point: a cold message has no entry point in the
 * interface, and the database refuses it even if one were found.
 */
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ago(ts: number) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Empty({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-12 text-center">
      <Icon className="mx-auto mb-3 size-5 text-muted-foreground" />
      <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function Thread({ person }: { person: Person }) {
  const connections = useConnections();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const thread = connections.messagesWith(person.id);

  const send = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await connections.sendMessage(person.id, body);
      if (res.error) setError(res.error);
      else setBody("");
    } catch {
      setError("That didn't send. Your words are still here.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ul className="mb-3 max-h-[50vh] flex-1 space-y-2 overflow-y-auto">
        {thread.length === 0 ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            You're connected. Say something.
          </li>
        ) : (
          thread.map((m) => {
            const mine = m.fromUser === user?.id;
            return (
              <li key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
                <span
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    mine
                      ? "text-white [background-color:var(--forest)]"
                      : "border border-border bg-surface"
                  }`}
                >
                  {m.body}
                </span>
              </li>
            );
          })
        )}
      </ul>
      {error && <p className="mb-2 text-xs text-[var(--coral-text)]">{error}</p>}
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={`Message ${person.displayName}`}
          className="rounded-full"
        />
        <Button
          variant="coral"
          disabled={!body.trim() || sending}
          onClick={send}
          aria-label="Send"
        >
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function Inbox() {
  const { user, isConfigured } = useAuth();
  const connections = useConnections();
  const social = useSocial();
  const [openWith, setOpenWith] = useState<Person | null>(null);

  const incomingConnections = connections.connections.filter(
    (c) => c.status === "pending" && c.addressee === user?.id,
  );
  const outgoingConnections = connections.connections.filter(
    (c) => c.status === "pending" && c.requester === user?.id,
  );
  const invitations = connections.spaceInvitations;
  const requestCount = incomingConnections.length + invitations.length;

  if (isConfigured && !user) {
    return (
      <div className="min-h-screen bg-surface py-10">
        <div className="container mx-auto max-w-2xl px-4">
          <h1 className="mb-2 text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
            Inbox
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Messages, requests and activity live here once you have an account.
          </p>
          <Link to="/login?next=/inbox">
            <Button variant="coral">Sign in</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-8 sm:py-12">
      <div className="container mx-auto max-w-3xl px-4">
        <h1 className="text-4xl sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>
          Inbox
        </h1>
        <p className="mb-8 mt-2 text-sm text-muted-foreground">
          Everything addressed to you. Messaging opens once a connection is
          accepted — never before.
        </p>

        <Tabs defaultValue={requestCount > 0 ? "requests" : "messages"}>
          <TabsList className="mb-6">
            <TabsTrigger value="messages">Messages</TabsTrigger>
            <TabsTrigger value="requests">
              Requests{requestCount > 0 ? ` (${requestCount})` : ""}
            </TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <TabsContent value="messages">
            {openWith ? (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenWith(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ← All messages
                  </button>
                  <span className="ml-auto flex items-center gap-2">
                    <Avatar className="size-7">
                      {openWith.avatarUrl && <AvatarImage src={openWith.avatarUrl} alt="" />}
                      <AvatarFallback className="text-[10px]">
                        {initials(openWith.displayName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                      {openWith.displayName}
                    </span>
                  </span>
                </div>
                <Thread person={openWith} />
              </div>
            ) : connections.connectedPeople.length === 0 ? (
              <Empty icon={MessageSquare}>
                No conversations yet. Messaging opens with people you've
                connected to — send a request from someone's profile, and once
                they accept you can write to each other.
              </Empty>
            ) : (
              <ul className="space-y-2">
                {connections.connectedPeople.map((person) => {
                  const thread = connections.messagesWith(person.id);
                  const last = thread[thread.length - 1];
                  return (
                    <li key={person.id}>
                      <button
                        type="button"
                        onClick={() => setOpenWith(person)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:border-[var(--foreground)]/30"
                      >
                        <Avatar className="size-10 shrink-0">
                          {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
                          <AvatarFallback className="text-xs">
                            {initials(person.displayName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0 flex-1">
                          <span
                            className="block truncate text-sm"
                            style={{ fontFamily: "var(--font-serif)" }}
                          >
                            {person.displayName}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {last ? last.body : "Connected — say something."}
                          </span>
                        </span>
                        {last && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {ago(last.createdAt)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>

          {/* ── Requests ─────────────────────────────────────────────── */}
          <TabsContent value="requests">
            {requestCount === 0 && outgoingConnections.length === 0 ? (
              <Empty icon={UserPlus}>
                Nothing waiting on you. Connection requests and Space
                invitations arrive here, and neither takes effect until you
                answer.
              </Empty>
            ) : (
              <div className="space-y-6">
                {incomingConnections.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm text-muted-foreground">Connection requests</h2>
                    <ul className="space-y-2">
                      {incomingConnections.map((c) => (
                        <li
                          key={c.id}
                          className="rounded-2xl border border-border bg-card px-4 py-3.5"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="size-9 shrink-0">
                              {c.requesterAvatar && <AvatarImage src={c.requesterAvatar} alt="" />}
                              <AvatarFallback className="text-[10px]">
                                {initials(c.requesterName ?? "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm">
                                <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                                  {c.requesterName ?? "Someone"}
                                </strong>{" "}
                                wants to connect.
                              </p>
                              {c.note && (
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                  "{c.note}"
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 text-white [background-color:var(--forest)]"
                              onClick={() => connections.respondToConnection(c.id, true)}
                            >
                              <Check className="size-3.5" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => connections.respondToConnection(c.id, false)}
                            >
                              <X className="size-3.5" />
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {invitations.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm text-muted-foreground">Space invitations</h2>
                    <ul className="space-y-2">
                      {invitations.map((s) => (
                        <li
                          key={s.id}
                          className="rounded-2xl border border-border bg-card px-4 py-3.5"
                        >
                          <p className="text-sm">
                            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                              {s.invitedByName ?? "Someone"}
                            </strong>{" "}
                            invited you to{" "}
                            <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                              {s.name}
                            </strong>
                            {s.interest ? ` · ${s.interest}` : ""}.
                          </p>
                          {s.note && (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              "{s.note}"
                            </p>
                          )}
                          <div className="mt-3 flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 text-white [background-color:var(--forest)]"
                              onClick={() => connections.respondToInvitation(s.id, true)}
                            >
                              <Check className="size-3.5" />
                              Join
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => connections.respondToInvitation(s.id, false)}
                            >
                              <X className="size-3.5" />
                              Decline
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {outgoingConnections.length > 0 && (
                  <section>
                    <h2 className="mb-3 text-sm text-muted-foreground">Waiting on them</h2>
                    <ul className="space-y-2">
                      {outgoingConnections.map((c) => (
                        <li
                          key={c.id}
                          className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {c.addresseeName ?? "Someone"} · Request sent
                          </span>
                          <button
                            type="button"
                            onClick={() => connections.withdrawConnection(c.id)}
                            className="shrink-0 text-xs text-muted-foreground hover:text-[var(--coral-text)]"
                          >
                            Withdraw
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Activity ─────────────────────────────────────────────── */}
          <TabsContent value="activity">
            {social.notifications.length === 0 ? (
              <Empty icon={InboxIcon}>
                Quiet. Thoughts on your work, accepted connections and Space
                invitations all show up here.
              </Empty>
            ) : (
              <ul className="space-y-2">
                {social.notifications.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm"
                  >
                    {n.actorName && (
                      <strong style={{ fontFamily: "var(--font-serif)", fontWeight: 500 }}>
                        {n.actorName}{" "}
                      </strong>
                    )}
                    {n.body}
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {ago(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
