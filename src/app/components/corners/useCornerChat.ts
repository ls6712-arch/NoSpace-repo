import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  CHAT_PAGE,
  fetchAuthors,
  fetchChatPage,
  firstName,
  mergeMessages,
  rowToMessage,
  signChatPaths,
  type Author,
  type ChatMessage,
} from "../../lib/cornerChat";

interface PresenceMeta {
  name?: string;
  typing?: boolean;
}

/**
 * The live state of one Corner's chat: the last 50 messages, older pages on request, Realtime inserts and
 * updates for this Corner key, and presence (who is here, who is typing) on the private channel
 * "corner-chat:<key>". People you blocked are left out of presence; the database already leaves out
 * their messages, both ways.
 */
export function useCornerChat(cornerKey: string, userId: string | undefined, myName: string, blockedIds: readonly string[]) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [more, setMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [others, setOthers] = useState<{ id: string; name: string; typing: boolean }[]>([]);
  const [attempt, setAttempt] = useState(0);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);
  const nameRef = useRef(firstName(myName));
  nameRef.current = firstName(myName);
  const blockedRef = useRef(blockedIds);
  blockedRef.current = blockedIds;
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingNow = useRef(false);

  // First page, again after a failed load.
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessages([]);
    setMore(false);
    fetchChatPage(cornerKey)
      .then((page) => {
        if (cancelled) return;
        setMessages((prev) => mergeMessages(prev, page));
        setMore(page.length >= CHAT_PAGE);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [cornerKey, attempt]);

  // Realtime: new and changed messages for this Corner, and presence.
  useEffect(() => {
    if (!supabase || !userId) return;
    const channel = supabase.channel(`corner-chat:${cornerKey}`, { config: { private: true, presence: { key: userId } } });
    const filter = `corner_key=eq.${cornerKey}`;
    const onRow = (payload: { new: unknown }) => {
      const m = rowToMessage(payload.new as Parameters<typeof rowToMessage>[0]);
      setMessages((prev) => mergeMessages(prev, [m]));
    };
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "corner_messages", filter }, onRow)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "corner_messages", filter }, (p) => {
        const m = rowToMessage(p.new as Parameters<typeof rowToMessage>[0]);
        // A removed message keeps its place in the list as an empty, removed row so a late copy cannot revive it.
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev.map((x) => (x.id === m.id ? m : x)) : mergeMessages(prev, [m])));
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceMeta>();
        const next: { id: string; name: string; typing: boolean }[] = [];
        for (const [id, metas] of Object.entries(state)) {
          if (id === userId || blockedRef.current.includes(id)) continue;
          const meta = metas[metas.length - 1];
          const name = firstName(meta?.name);
          if (name) next.push({ id, name, typing: !!meta?.typing });
        }
        next.sort((a, b) => a.id.localeCompare(b.id));
        setOthers(next);
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") void channel.track({ name: nameRef.current, typing: false });
      });
    channelRef.current = channel;
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingNow.current = false;
      channelRef.current = null;
      void supabase?.removeChannel(channel);
      setOthers([]);
    };
  }, [cornerKey, userId]);

  // Names and signed photo URLs for whatever is on screen.
  useEffect(() => {
    const missing = messages.filter((m) => !m.removed && !authors.has(m.userId)).map((m) => m.userId);
    if (missing.length === 0) return;
    let cancelled = false;
    void fetchAuthors(missing).then((found) => {
      if (cancelled) return;
      setAuthors((prev) => {
        const next = new Map(prev);
        // A person with no profile row is remembered as unnamed so this does not ask again.
        for (const id of missing) next.set(id, found.get(id) ?? { name: "" });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [messages, authors]);

  useEffect(() => {
    const paths = messages.flatMap((m) => m.mediaPaths).filter((p) => !urls.has(p));
    if (paths.length === 0) return;
    let cancelled = false;
    void signChatPaths(paths).then((signed) => {
      if (cancelled || signed.size === 0) return;
      setUrls((prev) => new Map([...prev, ...signed]));
    });
    return () => {
      cancelled = true;
    };
  }, [messages, urls]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !more) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page = await fetchChatPage(cornerKey, { createdAt: oldest.createdAt, id: oldest.id });
      setMessages((prev) => mergeMessages(prev, page));
      setMore(page.length >= CHAT_PAGE);
    } catch {
      /* Scrolling to the top again tries once more. */
    } finally {
      setLoadingOlder(false);
    }
  }, [cornerKey, loadingOlder, more, messages]);

  /** Tells the room you are typing; it turns itself off after a few quiet seconds, or call it with false. */
  const setTyping = useCallback((typing: boolean) => {
    const channel = channelRef.current;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (typing) typingTimer.current = setTimeout(() => setTyping(false), 3000);
    if (!channel || typingNow.current === typing) return;
    typingNow.current = typing;
    void channel.track({ name: nameRef.current, typing });
  }, []);

  const add = useCallback((m: ChatMessage) => setMessages((prev) => mergeMessages(prev, [m])), []);
  const markRemoved = useCallback(
    (id: number) => setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, body: "", mediaPaths: [], removed: true } : m))),
    [],
  );
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return {
    messages,
    status,
    more,
    loadingOlder,
    authors,
    urls,
    /** First names of the other people here now, blocked people left out. */
    here: others.map((o) => o.name),
    typing: others.filter((o) => o.typing).map((o) => o.name),
    loadOlder,
    setTyping,
    add,
    markRemoved,
    retry,
  };
}
