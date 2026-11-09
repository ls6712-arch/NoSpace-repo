import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ArrowDown, ImagePlus, MoreHorizontal, X } from "lucide-react";
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
import { PAGE_FROM, PAGE_TO, exit, page, pop } from "../../lib/motionTokens";
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

/** The line in the card header: who else is here now. Nothing when you are alone. Never a number. */
export function PresenceLine({ names }: { names: readonly string[] }) {
  const line = presenceLine(names);
  if (!line) return null;
  return (
    <p role="status" className="flex min-w-0 items-center gap-1.5 text-small text-[color-mix(in_srgb,var(--success)_45%,var(--foreground))]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-success" />
      <span className="truncate">{line}</span>
    </p>
  );
}

/** Typing: first names with three quiet dots. No words, so it needs no copy of its own. */
export function TypingDots({ names }: { names: readonly string[] }) {
  if (names.length === 0) return null;
  return (
    <motion.p
      data-typing
      initial={PAGE_FROM}
      animate={PAGE_TO}
      exit={{ opacity: 0 }}
      transition={page}
      className="flex items-center gap-1.5 px-1 text-caption text-muted-foreground"
    >
      <span>{names.join(", ")}</span>
      <span aria-hidden="true" className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-1 rounded-full bg-current motion-safe:animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </span>
    </motion.p>
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
    <div className="border-t border-[var(--hairline)] p-3 tab:px-5">
      <AnimatePresence initial={false}>
        {pending.length > 0 && (
          <motion.ul
            key="previews"
            aria-label="Photos to send"
            className="mb-2 flex gap-2 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={exit}
          >
            <AnimatePresence initial={false}>
              {pending.map((p) => (
                <motion.li
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={pop}
                  className="relative overflow-hidden rounded-card border border-border"
                >
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
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </AnimatePresence>
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
          className="max-h-32 min-h-11 flex-1 bg-card"
        />
        <PillButton variant="light" disabled={!canSend} onClick={onSend} className="shrink-0">
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
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={pop}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-card border border-border bg-popover shadow-overlay"
          >
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
          </motion.div>
        )}
      </AnimatePresence>
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
 * Corner chat, the card from the Embroidery design: a "Corner chat" title, who is here now in the corner,
 * messages as an avatar and a soft bubble ("Lena · Does anyone..."), and a composer with a black Send.
 * For approved members only: the caller never renders it for a visitor. Messages are grouped by day and then
 * by sender, the last 50 load first and older ones when you scroll to the top. Links are plain text.
 *
 * Motion (tokens only): a new message rises in, a removed one fades out, photo previews pop, the presence
 * line and the typing names fade, and the header hairline fades in as you scroll. Scroll: day headings stick,
 * the edges fade where there is more, a "latest" button appears when you are scrolled up (a dot when something
 * new came in, never a number), and the view follows new messages only while you are at the bottom.
 *
 * `compact` is the card on the Walls tab (fixed height, beside Passed along); without it the card is the
 * Chat tab (at most 720px on a desktop, the rest of the screen on a phone).
 */
export function CornerChat({ corner, compact = false }: { corner: { spaceSlug: string; slug: string; name: string }; compact?: boolean }) {
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
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevHeight = useRef(0);
  const newestId = useRef<number | null>(null);
  const positioned = useRef(false);
  const loadedNewest = useRef(Number.POSITIVE_INFINITY);
  const wide = useWide();
  const [phoneHeight, setPhoneHeight] = useState<number | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { scrollY } = useScroll({ container: scrollRef });
  const hairline = useTransform(scrollY, [0, 24], [0, 1]);

  const groups = groupMessages(chat.messages);
  const empty = chat.status === "ready" && groups.length === 0;
  const line = presenceLine(chat.here.slice(0, 4));

  // The Chat tab on a phone fills the screen from its top down to the tab bar, and follows the visual
  // viewport, so the composer stays in view when the keyboard opens. The Walls card keeps its own height.
  useEffect(() => {
    if (compact || wide) {
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
  }, [compact, wide, reducedMotion]);

  // What counts as new: anything newer than the newest message that was there when the first page loaded.
  useEffect(() => {
    if (chat.status === "ready" && loadedNewest.current === Number.POSITIVE_INFINITY) {
      loadedNewest.current = chat.messages.reduce((n, m) => Math.max(n, m.createdAt), 0);
    }
  }, [chat.status, chat.messages]);

  // Scrolling: start at the bottom; follow new messages only while you are there; hold your place when an
  // older page lands above; a dot on the latest button when something arrives while you read earlier ones.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || chat.status !== "ready") return;
    const newest = chat.messages.length ? chat.messages[chat.messages.length - 1] : null;
    const arrived = newest != null && newestId.current != null && newest.id !== newestId.current;
    if (!positioned.current) {
      positioned.current = true;
      el.scrollTop = el.scrollHeight;
    } else if (arrived && stickToBottom.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
    } else if (arrived && newest && newest.userId !== myId) {
      setUnseen(true);
    } else if (!arrived && prevHeight.current && el.scrollHeight > prevHeight.current && el.scrollTop < 120) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    newestId.current = newest?.id ?? null;
    prevHeight.current = el.scrollHeight;
  }, [chat.status, chat.messages, chat.urls, chat.typing.length, pending.length, phoneHeight, myId, reducedMotion]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickToBottom.current = bottom;
    setAtBottom(bottom);
    setAtTop(el.scrollTop < 8);
    if (bottom) setUnseen(false);
    if (el.scrollTop < 80 && chat.more && !chat.loadingOlder) void chat.loadOlder();
  };

  const jumpToLatest = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = true;
    setUnseen(false);
    el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
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
  const edgeFade = `linear-gradient(to bottom, ${atTop ? "currentColor" : "transparent"} 0, currentColor 20px, currentColor calc(100% - 20px), ${atBottom ? "currentColor" : "transparent"} 100%)`;

  return (
    <div
      ref={panelRef}
      style={phoneHeight != null ? { height: phoneHeight } : undefined}
      className={`flex min-h-0 scroll-mt-16 flex-col overflow-hidden rounded-card border border-border bg-card ${
        compact ? "h-[26rem]" : "tab:h-[min(720px,calc(100dvh-12rem))]"
      }`}
    >
      <div className="relative flex min-h-12 flex-col items-start gap-0.5 px-4 pb-2.5 pt-4 tab:flex-row tab:items-center tab:justify-between tab:gap-3 tab:px-5">
        <h3 className="whitespace-nowrap text-title">Corner chat</h3>
        <AnimatePresence mode="wait" initial={false}>
          {line && (
            <motion.div key={line} initial={{ opacity: 0, y: 4 }} animate={PAGE_TO} exit={{ opacity: 0 }} transition={page} className="max-w-full min-w-0">
              <PresenceLine names={chat.here.slice(0, 4)} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.span aria-hidden="true" style={{ opacity: hairline }} className="absolute inset-x-0 bottom-0 h-px bg-[var(--hairline)]" />
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          style={{ maskImage: edgeFade, WebkitMaskImage: edgeFade }}
          className="h-full space-y-4 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 tab:px-5"
        >
          {chat.loadingOlder && <Skeleton className="mx-auto h-4 w-24" />}
          {chat.status === "loading" && (
            <div className="space-y-3">
              {["w-40", "w-56", "w-32"].map((w, i) => (
                <Skeleton key={i} className={`h-9 ${w} rounded-card ${i === 1 ? "ml-auto" : ""}`} />
              ))}
            </div>
          )}
          {chat.status === "failed" && <ErrorNotice onRetry={chat.retry} />}
          {empty && (
            <motion.p initial={PAGE_FROM} animate={PAGE_TO} transition={page} className="py-10 text-center text-body text-muted-foreground">
              {CHAT_COPY.empty}
            </motion.p>
          )}

          {chat.status === "ready" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={page} className="space-y-4">
              {groups.map((day) => (
                <section key={day.day} aria-label={formatDate(day.at)} className="space-y-3">
                  <h4 className="sticky top-0 z-10 mx-auto w-fit rounded-full border border-[var(--hairline)] bg-card px-3 py-0.5 text-caption text-muted-foreground">
                    {formatDate(day.at)}
                  </h4>
                  {day.runs.map((run) => {
                    const mine = run.userId === myId;
                    const author = chat.authors.get(run.userId);
                    const name = nameOf(author);
                    const first = name.split(/\s+/)[0];
                    return (
                      <div key={run.messages[0].id} className={`flex gap-2.5 ${mine ? "flex-row-reverse" : ""}`}>
                        {!mine && (
                          <Avatar className="size-8 shrink-0 self-end">
                            {author?.avatarUrl && <AvatarImage src={author.avatarUrl} alt="" />}
                            <AvatarFallback className="text-caption">{name.slice(0, 1).toUpperCase()}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={`flex min-w-0 max-w-[82%] flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
                          <AnimatePresence initial={false}>
                            {run.messages.map((m, i) => {
                              const fresh = m.createdAt > loadedNewest.current;
                              const nameInBubble = !mine && i === 0 && !!first && !!m.body;
                              return (
                                <motion.div
                                  key={m.id}
                                  initial={fresh ? { opacity: 0, y: 10 } : false}
                                  animate={PAGE_TO}
                                  exit={{ opacity: 0, scale: 0.96 }}
                                  transition={page}
                                  className={`group flex items-end gap-1 ${mine ? "flex-row-reverse" : ""}`}
                                >
                                  <div className={`flex min-w-0 flex-col gap-1.5 ${mine ? "items-end" : "items-start"}`}>
                                    {!mine && i === 0 && !!first && !m.body && <span className="px-1 text-caption text-muted-foreground">{first}</span>}
                                    <Photos paths={m.mediaPaths} urls={chat.urls} mine={mine} />
                                    {m.body && (
                                      <p className={`whitespace-pre-wrap break-words rounded-card px-3.5 py-2 text-small ${mine ? "bg-foreground text-background" : "bg-surface-muted"}`}>
                                        {nameInBubble && <span className="font-semibold">{first} · </span>}
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
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </motion.div>
          )}
          <AnimatePresence initial={false}>{chat.typing.length > 0 && <TypingDots key="typing" names={chat.typing} />}</AnimatePresence>
        </div>

        <AnimatePresence>
          {!atBottom && chat.status === "ready" && (
            <motion.button
              type="button"
              onClick={jumpToLatest}
              aria-label="Latest"
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.9 }}
              transition={pop}
              className="absolute bottom-3 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-overlay"
            >
              <ArrowDown className="size-4" />
              {unseen && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-[var(--accent)]" />}
            </motion.button>
          )}
        </AnimatePresence>
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
