import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useJournalSlice, type Project } from "../lib/journal";
import {
  fetchPursuitAsProject,
  fetchPursuitMembers,
} from "../lib/pursuitsRemote";
import { workflowOf } from "../lib/pursuitWorkflow";
import { WorkflowPursuit } from "../components/pursuit/workflow/WorkflowPursuit";
import { Pursuit as LegacyPursuit } from "./LegacyPursuit";
export function Pursuit() {
  const { id } = useParams();
  const { user, isConfigured } = useAuth();
  const projects = useJournalSlice((s) => s.projects);
  const local = projects.find((p) => p.id === id);
  const [remote, setRemote] = useState<Project | null>(null);
  useEffect(() => {
    setRemote(null);
    if (!id || local || !user) return;
    let live = true;
    void (async () => {
      const p = await fetchPursuitAsProject(id);
      if (!p || !live) return;
      if (p.ownerId === user.id) {
        setRemote({ ...p, role: "owner" });
        return;
      }
      const members = await fetchPursuitMembers(id);
      if (
        live &&
        members.some((m) => m.userId === user.id && m.status === "joined")
      )
        setRemote({ ...p, role: "member" });
    })();
    return () => {
      live = false;
    };
  }, [id, !!local, user?.id]);
  const project = local ?? remote;
  const participant =
    !isConfigured ||
    (!!user &&
      !!project &&
      (!project.ownerId ||
        project.ownerId === user.id ||
        project.role === "member"));
  return project && workflowOf(project) && participant ? (
    <WorkflowPursuit
      key={`${project.id}:${user?.id ?? "local"}`}
      project={project}
    />
  ) : (
    <LegacyPursuit />
  );
}
