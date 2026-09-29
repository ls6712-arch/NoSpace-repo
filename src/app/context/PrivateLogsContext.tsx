import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";
import {
  PrivateLog,
  RemoteResult,
  fetchPrivateLogs,
  createPrivateLog,
  deletePrivateLog,
  updatePrivateLog,
} from "../lib/privateLogsRemote";
import { signMomentPaths } from "../lib/momentMedia";

/**
 * Private Logs. A signed-in owner's are Supabase-backed only (see
 * lib/privateLogsRemote.ts) — the `private_logs` table's RLS requires
 * auth.uid() = user_id for every operation, so there's nothing to fall
 * back to for that case, and nothing else to keep in sync.
 *
 * A signed-out visitor has no account for RLS to key off, so "Just keep
 * it for myself" (Log.tsx's no-login escape hatch) still needs somewhere
 * to write — this falls back to a local-only store, deliberately under a
 * fresh key rather than the old `sushii.journal.v1`. That old key's
 * privateLogs are intentionally left alone here (not read, not migrated,
 * not deleted) pending a separate decision on what to do with them.
 *
 * `add`/`remove` never decide shared-vs-local off `user` directly — early
 * on, `AuthContext.loading` can still be true with `user` not yet
 * populated even for someone who really is signed in (the initial
 * `getSession()` call hasn't resolved), and deciding off that
 * not-yet-trustworthy `user` was exactly how a signed-in owner's log
 * could land in this local fallback instead of the real table. Both wait
 * for `loading` to clear first, then read `userRef` — never the `user`
 * value closed over when the callback was created, which could still be
 * stale by the time the wait resolves.
 */

const LOCAL_KEY = "sushii.privateLogs.local.v1";

interface LocalState {
  logs: PrivateLog[];
}

const EMPTY: LocalState = { logs: [] };

function loadLocal(): LocalState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveLocal(state: LocalState) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
  } catch {
    // best effort — a private window shouldn't break logging
  }
}

const localId = () => Number(`${Date.now()}${Math.floor(Math.random() * 1000)}`);

interface PrivateLogsContextType {
  logs: PrivateLog[];
  /** True when `logs` is the signed-in owner's real, Supabase-backed copy. */
  isShared: boolean;
  add: (input: {
    note: string;
    media?: { path: string; type: "image" | "video"; hobbySlug?: string };
    projectId?: string;
  }) => Promise<RemoteResult<PrivateLog>>;
  remove: (id: number) => Promise<RemoteResult<true>>;
  update: (id: number, input: { note: string }) => Promise<RemoteResult<PrivateLog>>;
}

const PrivateLogsContext = createContext<PrivateLogsContextType | undefined>(undefined);

export function PrivateLogsProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const shared = !!user;

  const [local, setLocal] = useState<LocalState>(loadLocal);
  const [remoteLogs, setRemoteLogs] = useState<PrivateLog[]>([]);

  // Always the latest `user`, readable after an await without the
  // stale-closure risk a plain `user` reference from the callback's
  // creation-time render would carry.
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Resolves once — the moment the initial auth check finishes — and stays
  // resolved for the rest of the session, since `loading` never goes back
  // to `true` after that. Awaiting this before touching `userRef` is what
  // keeps add()/remove() from treating "not loaded yet" as "signed out."
  const authReadyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!authReadyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    authReadyRef.current = { promise, resolve };
  }
  useEffect(() => {
    if (!loading) authReadyRef.current!.resolve();
  }, [loading]);

  // Same backstop as ContentContext's addPostInFlightRef: a composer's own
  // disabled-while-saving button is the normal guard, but add() is called
  // from three different composers (AddMoment, QuickLog, Log.tsx), any one
  // of which could have — and, in Log.tsx's case, once did have — a bug in
  // that guard. Refusing a second concurrent add() here means a slow photo
  // upload can never turn one tap into more than one private_logs row,
  // regardless of which screen's own state got it wrong.
  const addInFlightRef = useRef(false);

  useEffect(() => {
    const onCleared = () => setLocal(EMPTY);
    window.addEventListener(LOCAL_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(LOCAL_CLEARED_EVENT, onCleared);
  }, []);

  useEffect(() => {
    if (!user) {
      setRemoteLogs([]);
      return;
    }
    let cancelled = false;
    fetchPrivateLogs(user.id).then(async ({ data }) => {
      if (cancelled || !data) return;
      // Step 1: each row's photo is a moment-media path now, not a ready URL
      // — sign the whole page in one batch, same shape as ContentContext.tsx's
      // own per-page Moment resolution.
      const paths = data.flatMap((l) => (l.mediaPath ? [l.mediaPath] : []));
      const signed = await signMomentPaths(paths);
      if (cancelled) return;
      setRemoteLogs(data.map((l) => (l.mediaPath ? { ...l, media: signed.get(l.mediaPath) } : l)));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const add = useCallback<PrivateLogsContextType["add"]>(async (input) => {
    if (addInFlightRef.current) {
      return { data: null, error: "Already saving." };
    }
    addInFlightRef.current = true;
    try {
      return await addImpl(input);
    } finally {
      addInFlightRef.current = false;
    }
  }, []);

  const addImpl: PrivateLogsContextType["add"] = async (input) => {
    await authReadyRef.current!.promise;
    const currentUser = userRef.current;

    if (currentUser) {
      const result = await createPrivateLog(currentUser.id, input);
      if (result.data) {
        let entry = result.data;
        // Show the photo right away rather than waiting for the next
        // fetch — same reason ContentContext.tsx resolves a just-inserted
        // Moment's own signed URL immediately instead of leaving it blank
        // until a refetch.
        if (entry.mediaPath) {
          const signed = await signMomentPaths([entry.mediaPath]);
          entry = { ...entry, media: signed.get(entry.mediaPath) };
        }
        setRemoteLogs((prev) => [entry, ...prev]);
        return { data: entry, error: null };
      }
      return result;
    }

    const entry: PrivateLog = {
      id: localId(),
      note: input.note,
      media: input.media?.path,
      mediaType: input.media?.type,
      hobbySlug: input.media?.hobbySlug,
      projectId: input.projectId,
      createdAt: Date.now(),
    };
    setLocal((prev) => {
      const next = { logs: [entry, ...prev.logs] };
      saveLocal(next);
      return next;
    });
    return { data: entry, error: null };
  };

  const remove = useCallback<PrivateLogsContextType["remove"]>(async (id) => {
    await authReadyRef.current!.promise;
    const currentUser = userRef.current;

    if (currentUser) {
      const result = await deletePrivateLog(id);
      if (result.data) setRemoteLogs((prev) => prev.filter((l) => l.id !== id));
      return result;
    }

    setLocal((prev) => {
      const next = { logs: prev.logs.filter((l) => l.id !== id) };
      saveLocal(next);
      return next;
    });
    return { data: true, error: null };
  }, []);

  const update = useCallback<PrivateLogsContextType["update"]>(async (id, input) => {
    await authReadyRef.current!.promise;
    const currentUser = userRef.current;

    if (currentUser) {
      const result = await updatePrivateLog(id, input);
      // updatePrivateLog only ever changes the note, so the previous
      // entry's already-resolved `media` still applies — fromRow() can't
      // set it (it only knows the raw mediaPath), so a plain replace here
      // would otherwise blank out a photo on every note edit.
      if (result.data) {
        setRemoteLogs((prev) => prev.map((l) => (l.id === id ? { ...result.data!, media: l.media } : l)));
      }
      return result;
    }

    let updated: PrivateLog | undefined;
    setLocal((prev) => {
      const logs = prev.logs.map((l) => {
        if (l.id !== id) return l;
        updated = { ...l, note: input.note };
        return updated;
      });
      const next = { logs };
      saveLocal(next);
      return next;
    });
    return updated ? { data: updated, error: null } : { data: null, error: "Not found." };
  }, []);

  const logs = shared ? remoteLogs : local.logs;

  return (
    <PrivateLogsContext.Provider value={{ logs, isShared: shared, add, remove, update }}>
      {children}
    </PrivateLogsContext.Provider>
  );
}

export function usePrivateLogs() {
  const ctx = useContext(PrivateLogsContext);
  if (!ctx) throw new Error("usePrivateLogs must be used within a PrivateLogsProvider");
  return ctx;
}
