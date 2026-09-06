import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Handshake, MessagesSquare, Send } from "lucide-react";
import { useSocial } from "../context/SocialContext";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Avatar, AvatarFallback } from "../components/ui/avatar";

/**
 * Messages exist only inside an accepted Make together or Explore together.
 * There is no inbox to cold-message into and no way to start a thread from
 * here — every thread on this page began as someone asking to do a specific
 * thing, and the other person saying yes.
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
  const [activeId, setActiveId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const threads = social.participations.filter(
    (p) => p.status === "accepted" && (p.kind === "make_together" || p.kind === "explore_together"),
  );

  const active = threads.find((t) => String(t.id) === String(activeId)) ?? threads[0];
  const messages = active ? social.messagesFor(active.id) : [];

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
    if (!active || !draft.trim()) return;
    await social.sendMessage(active.id, draft);
    setDraft("");
  };

  if (threads.length === 0) {
    return (
      <div className="min-h-screen bg-surface py-14">
        <div className="container mx-auto max-w-lg px-4 text-center">
          <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-surface-muted text-[var(--forest)]">
            <MessagesSquare className="size-6" />
          </span>
          <h1 className="mb-2 text-3xl" style={{ fontFamily: "var(--font-serif)" }}>
            No open threads
          </h1>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Messaging opens when someone accepts a Make together or Explore
            together request, never before. There's no way to message a
            stranger here, by design.
          </p>
          <Link to="/discover">
            <Button variant="outline">Find someone to make something with</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface py-10 sm:py-14">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="mb-1 text-3xl sm:text-4xl" style={{ fontFamily: "var(--font-serif)" }}>
          Messages
        </h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Only with people who accepted making or exploring something together.
        </p>

        <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          {/* Threads */}
          <ul className="space-y-2">
            {threads.map((t) => {
              const name = user && t.fromUser === user.id ? t.toName ?? "Them" : t.fromName;
              const on = String(t.id) === String(active?.id);
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
                        ) : (
                          <MessagesSquare className="size-3" />
                        )}
                        {t.intent}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* The thread */}
          {active && (
            <div className="flex min-h-[26rem] flex-col rounded-2xl border border-border bg-card">
              <div className="border-b border-[var(--hairline)] px-4 py-3">
                <div className="text-sm" style={{ fontFamily: "var(--font-serif)" }}>
                  {otherName}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {active.kind === "make_together" ? "Making together" : "Exploring together"} ·{" "}
                  {active.intent}
                </div>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
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
                  placeholder={`Message ${otherName}`}
                  className="flex-1"
                />
                <Button variant="coral" size="icon" onClick={send} aria-label="Send">
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
