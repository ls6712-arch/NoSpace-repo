import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ImagePlus, MoreHorizontal, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCategories } from "../../context/CategoriesContext";
import { useSocial } from "../../context/SocialContext";
import { cornerFollowKey } from "../../context/CornersContext";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { PillButton } from "../ui/PillButton";
import { Skeleton } from "../ui/skeleton";
import { Textarea } from "../ui/textarea";
import { ErrorNotice } from "../StateViews";
import { ImageWithFallback } from "../ImageWithFallback";
import { ReportDialog } from "../ReportDialog";
import { convertHeicIfNeeded, isHeicFile } from "../../lib/heicConversion";
import { isGif, mediaKindOf } from "../../lib/uploadMedia";
import { ERROR_LINE, UPLOAD_COPY } from "../../lib/stateCopy";
import { formatDate, formatTime } from "../../lib/dates";
import { useMediaQuery, useWide } from "../../lib/useMediaQuery";
import {
  CHAT_COPY,
  MAX_BODY,
  MAX_PHOTOS,
  MAX_PHOTO_MB,
  deleteChatPhotos,
  groupMessages,
  presenceLine,
  removeChatMessage,
  sendChatMessage,
  uploadChatPhoto,
  type Author,
  type ChatMessage,
} from "../../lib/cornerChat";
import { useCornerChat } from "./useCornerChat";

interface Pending {
  id: string;
  file: File;
  preview: string;
}

/** The header line over the chat: who else is here now. Nothing when you are alone. Never a number. */
export function PresenceLine({ names }: { names: readonly string[] }) {
  const line = presenceLine(names);
  if (!line) return null;
  return (
    <p role="status" className="truncate text-small text-muted-foreground">
      {line}
    </p>
  );
}

/** Typing: first names with three quiet dots. No words, so it needs no copy of its own. */
export function TypingDots({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <p data-typing className="flex items-center gap-1.5 px-1 text-caption text-muted-foreground">
      <span>{names.join(", ")}</span>
      <span aria-hidden="true" className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </p>
  );
}

/** The composer: words, up to 4 photos with previews you can remove, and Send. Locked while a message is on its way. */
export function Composer({
  sending,
  draft,
  onDraft,
  pending,
  onPick,
  onRemove,
  onSend,
  error,
}: {
  sending: boolean;
  draft: string;
  onDraft: (v: string) => void;
  pending: readonly Pending[];
  onPick: (files: File[]) => void;
  onRemove: (id: string) => void;
  onSend: () => void;
  error: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canSend = !sending && (draft.trim().length > 0 || pending.length > 0);
  return (
    <div className="border-t border-[var(--hairline)] p-3">
      {pending.length > 0 && (
        <ul className="mb-2 flex gap-2" aria-label="Photos to send">
          {pending.map((p) => (
            <li key={p.id} className="relative overflow-hidden rounded-card border border-border">
              <ImageWithFallback src={p.preview} alt="" className="size-16" />
              <button
                type="button"
                disabled={sending}
                onClick={() => onRemove(p.id)}
                aria-label="Remove attachment"
                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-control bg-scrim-solid/70 text-on-media disabled:opacity-50"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="mb-2 text-caption text-[var(--accent-text)]">
          {error}
        </p>
      )}
      <div className="flex items-end gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (picked.length > 0) onPick(picked);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Add a photo"
          disabled={sending || pending.length >= MAX_PHOTOS}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus className="size-4" />
        </Button>
        <Textarea
          value={draft}
          rows={1}
          maxLength={MAX_BODY}
          disabled={sending}
          placeholder={CHAT_COPY.placeholder}
          aria-label={CHAT_COPY.placeholder}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          className="max-h-32 min-h-11 flex-1"
        />
        <PillButton disabled={!canSend} onClick={onSend} className="shrink-0">
          Send
        </PillButton>
      </div>
    </div>
  );
}

/** Report and Delete for one message, behind a small "…" button. Report on other people's, Delete on yours (or any, for an admin). */
function MessageMenu({ name, canReport, canDelete, onReport, onDelete }: { name: string; canReport: boolean; canDelete: boolean; onReport: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  if (!canReport && !canDelete) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`More about ${name}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex size-8 items-center justify-center rounded-control text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 max-tab:opacity-100"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-card border border-border bg-popover shadow-overlay">
          {canReport && (
            <button
              type="button"
              className="block w-full px-3.5 py-2.5 text-left text-small transition-colors hover:bg-surface-muted"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
            >
              Report
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              className="block w-full px-3.5 py-2.5 text-left text-small text-[var(--accent-text)] transition-colors hover:bg-surface-muted"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Photos({ paths, urls, mine }: { paths: string[]; urls: Map<string, string>; mine: boolean }) {
  if (paths.length === 0) return null;
  return (
    <div className={`grid gap-1.5 ${paths.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${mine ? "ml-auto" : ""}`}>
      {paths.map((p) => (
        <ImageWithFallback
          key={p}
          src={urls.get(p)}
          alt=""
          aspect={paths.length === 1 ? "4 / 3" : "1 / 1"}
          className={`overflow-hidden rounded-card bg-surface-muted ${paths.length === 1 ? "w-56 tab:w-72" : "w-28 tab:w-36"}`}
        />
      ))}
    </div>
  );
}

/**
 * Corner chat: the Chat tab of a Corner page, for approved members. The caller never renders it for a
 * visitor. Messages are grouped by day and then by sender, the composer stays at the bottom of the panel,
 * and the list loads the last 50 messages, then older ones when you scroll to the top. Links are plain text.
 */
export function CornerChat({ corner }: { corner: { spaceSlug: string; slug: string; name: string } }) {
  const { user, profile } = useAuth();
  const { isAdmin } = useCategories();
  const social = useSocial();
  const key = cornerFollowKey(corner.spaceSlug, corner.slug);
  const myId = user?.id;
  const chat = useCornerChat(key, myId, profile?.display_name ?? "", social.blockedIds);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);
  const wide = useWide();
  const [phoneHeight, setPhoneHeight] = useState<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const groups = groupMessages(chat.messages);
  const empty = chat.status === "ready" && groups.length === 0;

  // Phone: the chat fills the screen from where its panel starts down to the tab bar, and follows the visual
  // viewport, so the composer stays in view when the keyboard opens.
  useEffect(() => {
    if (wide) {
      setPhoneHeight(null);
      return;
    }
    const measure = () => {
      const el = panelRef.current;
      if (!el) return;
      const vv = window.visualViewport;
      const viewport = vv?.height ?? window.innerHeight;
      const keyboardOpen = vv != null && window.innerHeight - vv.height > 120;
      const tabBar = keyboardOpen ? 0 : 72 + Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--safe-bottom") || "0");
      const top = el.getBoundingClientRect().top;
      setPhoneHeight(Math.max(280, Math.round(viewport - Math.max(top, 0) - tabBar)));
    };
    panelRef.current?.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
    const t = window.setTimeout(measure, reducedMotion ? 0 : 350);
    measure();
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [wide, reducedMotion]);

  // Stay at the bottom for new messages when you were already there; keep your place when older ones arrive.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (prevHeight.current && el.scrollHeight > prevHeight.current && !stickToBottom.current) {
      // Older page added above: hold the view where it was.
      if (el.scrollTop < 120) el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevHeight.current = el.scrollHeight;
  }, [chat.messages, chat.urls, chat.typing.length, pending.length, phoneHeight]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 80 && chat.more && !chat.loadingOlder) void chat.loadOlder();
  };

  useEffect(
    () => () => {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
    },
    // Only on unmount: previews are revoked as they are removed or sent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const pick = useCallback(
    async (files: File[]) => {
      setError(null);
      const room = MAX_PHOTOS - pending.length;
      const added: Pending[] = [];
      for (const file of files.slice(0, Math.max(room, 0))) {
        const converted = await convertHeicIfNeeded(file);
        if (isHeicFile(converted)) {
          setError(UPLOAD_COPY.heic);
          continue;
        }
        if (mediaKindOf(converted) !== "image") {
          setError(UPLOAD_COPY.photoOnly);
          continue;
        }
        if (isGif(converted)) {
          setError(UPLOAD_COPY.gifBlocked);
          continue;
        }
        if (converted.size > MAX_PHOTO_MB * 1024 * 1024) {
          setError(UPLOAD_COPY.tooBig(MAX_PHOTO_MB));
          continue;
        }
        added.push({ id: crypto.randomUUID(), file: converted, preview: URL.createObjectURL(converted) });
      }
      if (added.length > 0) setPending((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    },
    [pending.length],
  );

  const removePending = (id: string) =>
    setPending((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return prev.filter((p) => p.id !== id);
    });

  const send = async () => {
    if (!myId || sending) return;
    const body = draft.trim();
    if (!body && pending.length === 0) return;
    setSending(true);
    setError(null);
    chat.setTyping(false);
    const uploaded: string[] = [];
    try {
      const results = await Promise.all(pending.map((p) => uploadChatPhoto(key, myId, p.file)));
      for (const r of results) if (r.path) uploaded.push(r.path);
      const failed = results.find((r) => r.error);
      if (failed) {
        await deleteChatPhotos(uploaded);
        setError(failed.error);
        return;
      }
      const { message, error: sendError } = await sendChatMessage(key, body, uploaded);
      if (!message) {
        await deleteChatPhotos(uploaded);
        setError(sendError ?? ERROR_LINE);
        return;
      }
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      setDraft("");
      stickToBottom.current = true;
      chat.add(message);
    } catch {
      await deleteChatPhotos(uploaded);
      setError(ERROR_LINE);
    } finally {
      setSending(false);
    }
  };

  const remove = async (m: ChatMessage) => {
    const { error: removeError } = await removeChatMessage(m.id);
    if (removeError) {
      setError(removeError);
      return;
    }
    chat.markRemoved(m.id);
    void deleteChatPhotos(m.userId === myId ? m.mediaPaths : []);
  };

  const nameOf = (a: Author | undefined) => a?.name || "";

  return (
    <div
      ref={panelRef}
      style={phoneHeight != null ? { height: phoneHeight } : undefined}
      className="flex min-h-0 scroll-mt-16 flex-col overflow-hidden rounded-card border border-border bg-card tab:h-[min(720px,calc(100dvh-12rem))]"
    >
      {chat.here.length > 0 && (
        <div className="border-b border-[var(--hairline)] px-4 py-2.5">
          <PresenceLine names={chat.here.slice(0, 4)} />
        </div>
      )}

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {chat.loadingOlder && <Skeleton className="mx-auto h-4 w-24" />}
        {chat.status === "loading" && (
          <div className="space-y-3">
            {["w-40", "w-56", "w-32"].map((w, i) => (
              <Skeleton key={i} className={`h-9 ${w} rounded-card ${i === 1 ? "ml-auto" : ""}`} />
            ))}
          </div>
        )}
        {chat.status === "failed" && <ErrorNotice onRetry={chat.retry} />}
        {empty && <p className="py-10 text-center text-body text-muted-foreground">{CHAT_COPY.empty}</p>}

        {groups.map((day) => (
          <section key={day.day} aria-label={formatDate(day.at)} className="space-y-3">
            <h3 className="text-center text-caption text-muted-foreground">{formatDate(day.at)}</h3>
            {day.runs.map((run) => {
              const mine = run.userId === myId;
              const author = chat.authors.get(run.userId);
              const name = nameOf(author);
              return (
                <div key={run.messages[0].id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                  {!mine && (
                    <Avatar className="size-8 shrink-0 self-end">
                      {author?.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
                      <AvatarFallback className="text-caption">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`flex min-w-0 max-w-[78%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                    {!mine && name && <span className="px-1 text-caption text-muted-foreground">{name.split(/\s+/)[0]}</span>}
                    {run.messages.map((m, i) => (
                      <div key={m.id} className={`group flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}>
                        <div className={`flex min-w-0 flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
                          <Photos paths={m.mediaPaths} urls={chat.urls} mine={mine} />
                          {m.body && (
                            <p className={`whitespace-pre-wrap break-words rounded-card px-3.5 py-2 text-small ${mine ? "bg-foreground text-background" : "bg-surface-muted"}`}>
                              {m.body}
                            </p>
                          )}
                          {i === run.messages.length - 1 && <span className="px-1 text-caption text-muted-foreground">{formatTime(m.createdAt)}</span>}
                        </div>
                        <MessageMenu
                          name={name || "this person"}
                          canReport={!mine}
                          canDelete={mine || isAdmin}
                          onReport={() => setReporting(m)}
                          onDelete={() => void remove(m)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
        <TypingDots names={chat.typing} />
      </div>

      <Composer
        sending={sending}
        draft={draft}
        onDraft={(v) => {
          setDraft(v);
          chat.setTyping(v.length > 0);
        }}
        pending={pending}
        onPick={(files) => void pick(files)}
        onRemove={removePending}
        onSend={() => void send()}
        error={error}
      />

      {reporting && (
        <ReportDialog
          open
          onOpenChange={(open) => !open && setReporting(null)}
          targetUserId={reporting.userId}
          targetKind="corner_message"
          targetId={reporting.id}
          personName={nameOf(chat.authors.get(reporting.userId))}
        />
      )}
    </div>
  );
}
