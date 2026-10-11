/**
 * Landing-page screenshot screens. Each one renders a real page or component
 * from the app, fed by the example data in ./fixtures through the in-memory
 * database client (./fakeSupabase). Registered only in `--mode landing-preview`
 * (src/app/routes.ts); never linked from the app and never in a production build.
 */
import { useMemo } from "react";
import { useParams } from "react-router";
import { MomentCard } from "../app/components/MomentCard";
import { useContent } from "../app/context/ContentContext";
import { seedJournal, type Project } from "../app/lib/journal";
import { Log } from "../app/pages/Log";
import { Pursuit } from "../app/pages/Pursuit";
import { You } from "../app/pages/You";
import { MAYA } from "./fixtures";

const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => Date.now() - days * DAY;

/** Maya's own Pursuits, as the local journal holds them. `v2` is the one the
 * step screens show twice: in progress, then finished. */
function mayaProjects(v2: "in-progress" | "finished"): Project[] {
  return [
    {
      id: "p-v2",
      title: "Climb my first V2",
      hobbySlug: "sports-fitness",
      interest: "Bouldering",
      shared: true,
      startedAt: ago(10),
      finishedAt: v2 === "finished" ? ago(1) : undefined,
      endingNote: v2 === "finished" ? "Chalk up, trust your feet, and fall a lot first." : undefined,
    },
    {
      id: "p-halfmarathon",
      title: "Half marathon",
      hobbySlug: "sports-fitness",
      interest: "Running",
      shared: true,
      startedAt: ago(45),
      goal: { id: "g-half", shape: "number", label: "13.1 miles", targetNumber: 13.1, unit: "miles", current: 11, createdAt: ago(45) },
    },
    {
      id: "p-sourdough",
      title: "Sourdough, 10 loaves",
      hobbySlug: "food-cooking",
      interest: "Baking",
      shared: true,
      startedAt: ago(60),
      finishedAt: ago(9),
      goal: { id: "g-sd", shape: "number", label: "10 loaves", targetNumber: 10, unit: "loaves", current: 10, createdAt: ago(60), reachedAt: ago(9) },
    },
    {
      id: "p-film",
      title: "First roll of film",
      hobbySlug: "photography-film",
      interest: "Film photography",
      shared: true,
      startedAt: ago(30),
      finishedAt: ago(12),
    },
  ];
}

function useSeed(v2: "in-progress" | "finished") {
  useMemo(() => {
    seedJournal({ projects: mayaProjects(v2), saved: [] });
  }, [v2]);
}

function stateFromHash(): "in-progress" | "finished" {
  return /[?&]state=finished/.test(window.location.hash) ? "finished" : "in-progress";
}

/** One Moment, in its card, on the page background. */
function PreviewMoment({ id }: { id: number }) {
  const { posts } = useContent();
  const post = posts.find((p) => p.id === id);
  if (!post) return null;
  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6">
      <MomentCard post={post} surface="feed" />
    </div>
  );
}

export function PreviewScreen() {
  const { screen } = useParams();
  useSeed(stateFromHash());
  switch (screen) {
    case "shelf":
      return <You />;
    case "create":
      return <Log />;
    case "save":
      return <PreviewMoment id={9101} />;
    case "come-along":
      return <PreviewMoment id={9201} />;
    case "notifications":
      // The bell lives in the real header; the page behind it is Maya's Shelf.
      return <You />;
    default:
      return <div className="p-8">No such screen.</div>;
  }
}

export function PreviewPursuit() {
  useSeed(stateFromHash());
  return <Pursuit />;
}

export const PREVIEW_VIEWER = MAYA;
