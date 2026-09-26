import { useState } from "react";
import { useNavigate } from "react-router";
import { Check } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocial } from "../context/SocialContext";
import { canAttachInto } from "../lib/messageTabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/**
 * "Send to…" — shares a Moment or Pursuit into one of your existing chats.
 * Only accepted threads are offered (canAttachInto): a pending request has
 * nowhere to put an attachment, per the messages INSERT policy.
 */
export function SendToChatDialog({
  open,
  onOpenChange,
  kind,
  postId,
  pursuitId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "moment" | "pursuit";
  postId?: number | string;
  pursuitId?: string;
}) {
  const social = useSocial();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sendingTo, setSendingTo] = useState<string | number | null>(null);
  const [sentTo, setSentTo] = useState<string | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chats = social.participations
    .filter((p) => canAttachInto(p) && !social.blockedIds.includes(p.fromUser === user?.id ? p.toUser ?? "" : p.fromUser))
    .sort((a, b) => b.createdAt - a.createdAt);

  const send = async (threadId: string | number) => {
    setError(null);
    setSendingTo(threadId);
    const result =
      kind === "moment" && postId != null
        ? await social.shareMoment(threadId, postId)
        : kind === "pursuit" && pursuitId != null
          ? await social.sharePursuit(threadId, pursuitId)
          : { error: "failed" as const };
    setSendingTo(null);
    if (result.error) {
      setError("Couldn't send that. Try again.");
      return;
    }
    setSentTo(threadId);
  };

  const close = () => {
    onOpenChange(false);
    setSentTo(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Send to…</DialogTitle>
        </DialogHeader>
        {chats.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">
            No open chats yet — start one from someone's profile first.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {chats.map((t) => {
              const name = user && t.fromUser === user.id ? t.toName ?? "Them" : t.fromName;
              const done = sentTo === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={sendingTo === t.id || done}
                    onClick={() => (done ? navigate(`/messages?thread=${t.id}`) : send(t.id))}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted disabled:cursor-default"
                  >
                    <Avatar className="size-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(name ?? "?")}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {done ? (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Check className="size-3.5" /> Sent
                      </span>
                    ) : sendingTo === t.id ? (
                      <span className="text-[11px] text-muted-foreground">Sending…</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="text-xs text-[var(--coral-text)]">{error}</p>}
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={close}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
