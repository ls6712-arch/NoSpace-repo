import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Project, ProgressEntry, PursuitMember, useJournalSlice } from "./journal";
import { fetchPursuitMembers, fetchPursuitProgress } from "./pursuitsRemote";

const NO_ENTRIES: ProgressEntry[] = [];

/**
 * Every amount logged toward one Pursuit: this browser's own entries
 * (instant, offline) merged with what's in the database — which is where
 * other participants' progress lives. Deduplicated by entry id, since the
 * owner's own entries exist in both places once mirrored.
 */
export function usePursuitProgress(projectId: string | undefined, refreshKey = 0) {
  const { user } = useAuth();
  const all = useJournalSlice((s) => s.progress ?? NO_ENTRIES);
  const local = useMemo(
    () => (projectId ? all.filter((e) => e.projectId === projectId).map((e) => ({ ...e, userId: e.userId ?? user?.id })) : []),
    [all, projectId, user?.id],
  );
  const [remote, setRemote] = useState<ProgressEntry[]>([]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetchPursuitProgress(projectId).then((r) => !cancelled && setRemote(r));
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey, user?.id]);

  return useMemo(() => {
    const byId = new Map<string, ProgressEntry>();
    for (const e of remote) byId.set(e.id, e);
    for (const e of local) byId.set(e.id, e);
    return [...byId.values()].sort((a, b) => a.createdAt - b.createdAt);
  }, [local, remote]);
}

/** Participants: the database's list when there is one, otherwise the
 * members saved locally at creation (so the owner sees who they invited
 * even before the migration runs or while offline). Owner always first. */
export function usePursuitMembers(project: Project | undefined, ownerFallback?: PursuitMember) {
  const [remote, setRemote] = useState<PursuitMember[] | null>(null);
  useEffect(() => {
    if (!project || (project.mode ?? "solo") === "solo") return;
    let cancelled = false;
    fetchPursuitMembers(project.id).then((m) => !cancelled && setRemote(m.length ? m : null));
    return () => {
      cancelled = true;
    };
  }, [project?.id, project?.mode]);
  const list = remote ?? project?.members ?? [];
  const withOwner = ownerFallback && !list.some((m) => m.role === "owner") ? [ownerFallback, ...list] : list;
  return withOwner.filter((m) => m.status !== "declined");
}
