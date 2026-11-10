import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  asksWallQuestion,
  DEFAULT_WALL_LABELS,
  finishedPursuitTitle,
  ROOM_WALL_LABEL_KEYS,
  roomWallLabels,
  wallLabels,
} from "./cornerWallLabels";
import { checkInDue, getJournal, pursuitStatus, seedJournal, startFinishedProject, startProject } from "./journal";
import { activePursuits } from "./pursuitTrail";
import { quietPursuits } from "./needsYou";
import { hobbies } from "../data/hobbies";

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), "utf8");
/** Without whole-line comments, which may say the words. */
const code = (src: string) => src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, "");

describe("wall labels per Corner", () => {
  it("names the four Corners' walls as the founder decided", () => {
    expect(roomWallLabels("crafts-making/pottery")).toEqual({ making: "Still making", made: "Made it" });
    expect(roomWallLabels("home-garden/gardening")).toEqual({ making: "Still growing", made: "Made it" });
    expect(roomWallLabels("books-writing/reading")).toEqual({ making: "Still reading", made: "Read it" });
    expect(roomWallLabels("gaming-tabletop/board-games")).toEqual({ making: "Still learning", made: "Played it" });
  });

  it("every Corner with labels is a real Corner", () => {
    for (const key of ROOM_WALL_LABEL_KEYS) {
      const [space, slug] = key.split("/");
      expect(hobbies.find((h) => h.slug === space)?.subItems.some((s) => s.slug === slug), key).toBe(true);
    }
  });

  it("every label is in the glossary, in sentence case, with no dash", () => {
    const glossary = read("../../../docs/glossary.md");
    for (const key of ROOM_WALL_LABEL_KEYS) {
      for (const label of Object.values(roomWallLabels(key)!)) {
        expect(glossary, label).toContain(`| ${label} |`);
        expect(label).toMatch(/^[A-Z][a-z]+( [a-z]+)*$/);
      }
    }
  });

  it("a Corner uses its own labels only once it has a room; every other Corner says Still making and Made it", () => {
    expect(wallLabels("crafts-making", "pottery")).toEqual(DEFAULT_WALL_LABELS);
    // Merged into Pottery: the kept Corner's labels.
    expect(wallLabels("art-creative", "ceramics")).toEqual(roomWallLabels("crafts-making/pottery"));
    expect(wallLabels("art-creative", "drawing")).toEqual(DEFAULT_WALL_LABELS);
    for (const key of ROOM_WALL_LABEL_KEYS) {
      const [space, slug] = key.split("/");
      expect(wallLabels(space, slug)).toEqual(asksWallQuestion(space, slug) ? roomWallLabels(key) : DEFAULT_WALL_LABELS);
    }
  });

  it("Log a Moment asks only on a Corner that has a room", () => {
    expect(asksWallQuestion("crafts-making", "pottery")).toBe(true);
    expect(asksWallQuestion("art-creative", "drawing")).toBe(false);
    expect(asksWallQuestion("", "")).toBe(false);
    expect(asksWallQuestion("crafts-making", "")).toBe(false);
  });
});

describe("the Pursuit made by answering finished", () => {
  it("is titled from the first line of the Moment, cut at a word, or the Corner's name", () => {
    expect(finishedPursuitTitle("  \nA blue bowl\nglazed twice", "Pottery")).toBe("A blue bowl");
    expect(finishedPursuitTitle("", "Pottery")).toBe("Pottery");
    expect(finishedPursuitTitle("   ", "Pottery")).toBe("Pottery");
    const long = finishedPursuitTitle("A very long caption about a bowl that took four attempts and a great deal of patience to centre", "Pottery");
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/\s…$/);
  });

  beforeEach(() => seedJournal({}));

  it("is finished from its first write and linked to its Moment, in one commit", () => {
    const seen: string[] = [];
    const p = startFinishedProject({ title: "A blue bowl", hobbySlug: "crafts-making", subHobby: "pottery" }, 41, 1_000);
    seen.push(pursuitStatus(p));
    const stored = getJournal().projects.find((x) => x.id === p.id)!;
    expect(seen).toEqual(["complete"]);
    expect(stored.finishedAt).toBe(1_000);
    expect(stored.startedAt).toBe(1_000);
    expect(getJournal().entryProject["41"]).toBe(p.id);
    expect(stored.goal).toBeUndefined();
    expect(stored.measure).toBeUndefined();
  });

  it("is never listed as active: not in the active list, the quiet list, or a check-in", () => {
    const open = startProject({ title: "Learn the wheel", hobbySlug: "crafts-making", subHobby: "pottery" });
    const done = startFinishedProject({ title: "A blue bowl", hobbySlug: "crafts-making", subHobby: "pottery" }, 41, 1_000);
    const projects = getJournal().projects;
    const year = 365 * 86_400_000;
    expect(activePursuits(projects, () => []).map((p) => p.id)).toEqual([open.id]);
    expect(quietPursuits(projects, () => [], 1_000 + year).map((p) => p.id)).not.toContain(done.id);
    expect(checkInDue(projects.find((p) => p.id === done.id)!, undefined, 1_000 + year)).toBe(false);
    expect(projects.filter((p) => !p.finishedAt).map((p) => p.id)).toEqual([open.id]);
  });
});

describe("Log a Moment's finished answer", () => {
  const log = code(read("../pages/Log.tsx"));

  it("is asked through the Corner's own labels, and never for a private or group Moment", () => {
    expect(log).toContain('{ value: "making", label: wallNames.making }');
    expect(log).toContain('{ value: "made", label: wallNames.made }');
    expect(log).toMatch(/const asksWall = spaceSet && asksWallQuestion\(hobbySlug, wallCorner\) && circle !== "private" && circle !== "group" && ownSoloPursuit;/);
  });

  it("makes the Pursuit already finished (never started open, then finished), and only for a Moment that was saved", () => {
    expect(log).toContain('const finishing = asksWall && wallAnswer === "made" && !entry.unsaved;');
    expect(log.match(/startFinishedProject\(/g)).toHaveLength(1);
    expect(log.match(/mirrorFinishedPursuitWithMoment\(/g)).toHaveLength(1);
    // The one remaining startProject call is the older "name a new Pursuit" path, which is not this one.
    const finishedBlock = log.slice(log.indexOf("if (finishing) {"), log.indexOf("setUndoTarget({ postId: entry.id"));
    expect(finishedBlock).not.toContain("startProject(");
  });

  it("stores nothing new on the Moment: no progress column, no new table", () => {
    expect(log).not.toMatch(/\bprogress:\s*["']?(still_making|made_it)/);
    expect(code(read("../context/ContentContext.tsx"))).not.toMatch(/still_making|made_it|started_from_post_id/);
  });

  it("undo takes finished back with the Moment", () => {
    expect(log).toContain("dropProject(undoTarget.finished.pursuitId)");
    expect(log).toContain("deleteRemotePursuit(undoTarget.finished.pursuitId)");
    expect(log).toContain("resumeProject(undoTarget.finished.pursuitId)");
  });
});

describe("saving a finished Pursuit", () => {
  it("writes the Pursuit before linking the Moment, and never writes it open first", () => {
    const remote = code(read("./pursuitsRemote.ts"));
    const fn = remote.slice(remote.indexOf("export async function mirrorFinishedPursuitWithMoment"), remote.indexOf("export async function deleteRemotePursuit"));
    expect(fn).toContain("!project.finishedAt) return");
    expect(fn.indexOf("await mirrorPursuit(userId, project)")).toBeGreaterThan(-1);
    expect(fn.indexOf("await mirrorPursuit(userId, project)")).toBeLessThan(fn.indexOf('.update({ pursuit_id: project.id })'));
    // Marked as made from a Moment after it exists and before the Moment points at it.
    const mark = fn.indexOf(".update({ from_moment: true })");
    expect(mark).toBeGreaterThan(fn.indexOf("await mirrorPursuit(userId, project)"));
    expect(mark).toBeLessThan(fn.indexOf('.update({ pursuit_id: project.id })'));
    // Nothing else in the app sets the mark.
    expect(remote.match(/from_moment/g)).toHaveLength(1);
  });
});
