import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { LOCAL_CLEARED_EVENT } from "../lib/localData";
import {
  PrivateLog,
  fetchPrivateLogs,
  createPrivateLog,
  deletePrivateLog,
} from "../lib/privateLogsRemote";

/**
 * Private Logs. A signed-in owner's are Supabase-backed only (see
 * lib/privateLogsRemote.ts) — the `private_logs` table's RLS requires
 * auth.uid() = user_id for every operation, so there's nothing to fall
 * back to for that case, and nothing else to keep in sync.
 *
 * A signed-out visitor has no account for RLS to key off, so "Just keep
 * it for myself" (Log.tsx's no-login escape hatch) still needs somewhere
 * to write — this falls back to a local-only store, deliberately under a
 * fresh key rather than the old `nospace.journal.v1`. That old key's
 * privateLogs are intentionally left alone here (not read, not migrated,
 * not deleted) pending a separate decision on what to do with them.
 */

const LOCAL_KEY = "nospace.privateLogs.local.v1";

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
    media?: { url: string; type: "image" | "video"; hobbySlug?: string };
    projectId?: string;
  }) => Promise<PrivateLog | null>;
  remove: (id: number) => Promise<void>;
}

const PrivateLogsContext = createContext<PrivateLogsContextType | undefined>(undefined);

export function PrivateLogsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const shared = !!user;

  const [local, setLocal] = useState<LocalState>(loadLocal);
  const [remoteLogs, setRemoteLogs] = useState<PrivateLog[]>([]);

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
    fetchPrivateLogs(user.id).then((rows) => {
      if (!cancelled) setRemoteLogs(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const add = useCallback<PrivateLogsContextType["add"]>(
    async (input) => {
      if (shared && user) {
        const created = await createPrivateLog(user.id, input);
        if (created) setRemoteLogs((prev) => [created, ...prev]);
        return created;
      }
      const entry: PrivateLog = {
        id: localId(),
        note: input.note,
        media: input.media?.url,
        mediaType: input.media?.type,
        hobbySlug: input.media?.hobbySlug,
        projectId: input.projectId,
        createdAt: Date.now(),
      };
      const next = { logs: [entry, ...local.logs] };
      setLocal(next);
      saveLocal(next);
      return entry;
    },
    [shared, user, local],
  );

  const remove = useCallback(
    async (id: number) => {
      if (shared && user) {
        const ok = await deletePrivateLog(id);
        if (ok) setRemoteLogs((prev) => prev.filter((l) => l.id !== id));
        return;
      }
      const next = { logs: local.logs.filter((l) => l.id !== id) };
      setLocal(next);
      saveLocal(next);
    },
    [shared, user, local],
  );

  const logs = shared ? remoteLogs : local.logs;

  return (
    <PrivateLogsContext.Provider value={{ logs, isShared: shared, add, remove }}>
      {children}
    </PrivateLogsContext.Provider>
  );
}

export function usePrivateLogs() {
  const ctx = useContext(PrivateLogsContext);
  if (!ctx) throw new Error("usePrivateLogs must be used within a PrivateLogsProvider");
  return ctx;
}
