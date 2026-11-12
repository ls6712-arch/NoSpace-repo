import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseActivities, renderActivitiesFile, resolveActivities } from "./cornerActivitiesLogic";

const HEADER = "id,corner_slug,corner_name,title,how,first_step,moods,energy,who,cost,where,duration,season,moment_prompt";
const row = (o: Partial<Record<string, string>> = {}) => {
  const r = { id: "origami-1", corner_slug: "origami", corner_name: "Origami", title: "Fold a paper crane", how: '"One, two, three."', first_step: "Cut a square.", moods: "cozy;make", energy: "low", who: "solo;friend", cost: "free", where: "home", duration: "15min", season: "any", moment_prompt: "Your crane.", ...o };
  return Object.values(r).join(",");
};
const csv = (...rows: string[]) => [HEADER, ...rows].join("\n");

describe("parseActivities", () => {
  it("reads a row, splits the lists, keeps quoted commas", () => {
    const [a] = parseActivities(csv(row()));
    expect(a).toMatchObject({ id: "origami-1", cornerSlug: "origami", moods: ["cozy", "make"], who: ["solo", "friend"], how: "One, two, three.", duration: "15min" });
  });
  it("throws on a wrong column set, a bad value, a duplicate id, an id that does not match its Corner, a dash or a link", () => {
    expect(() => parseActivities("id,title\nx,y")).toThrow(/columns/);
    expect(() => parseActivities(csv(row({ energy: "huge" })))).toThrow(/energy/);
    expect(() => parseActivities(csv(row({ moods: "cozy;sleepy" })))).toThrow(/moods/);
    expect(() => parseActivities(csv(row(), row()))).toThrow(/duplicate/);
    expect(() => parseActivities(csv(row({ id: "other-1" })))).toThrow(/does not match/);
    expect(() => parseActivities(csv(row({ title: "A — B" })))).toThrow(/dash/);
    expect(() => parseActivities(csv(row({ first_step: "See https://example.com" })))).toThrow(/link/);
  });
  it("reads the real file", () => {
    const rows = parseActivities(readFileSync("data/corner_activities.csv", "utf8"));
    expect(rows).toHaveLength(300);
  });
});

describe("resolveActivities", () => {
  const rows = parseActivities(csv(row(), row({ id: "table-tennis-1", corner_slug: "table-tennis", corner_name: "Table tennis" })));
  it("puts each activity on the Space its Corner sits under after the merge", () => {
    const { resolved, unresolved } = resolveActivities(rows, (s) => ({ origami: { spaceSlug: "crafts-making", slug: "origami" }, "table-tennis": { spaceSlug: "sports-fitness", slug: "table-tennis" } })[s] ?? null);
    expect(unresolved).toEqual([]);
    expect(resolved.map((r) => `${r.spaceSlug}/${r.cornerSlug}`)).toEqual(["crafts-making/origami", "sports-fitness/table-tennis"]);
  });
  it("lists a slug that does not resolve, and one that resolves to a different slug, instead of guessing", () => {
    const { resolved, unresolved } = resolveActivities(rows, (s) => (s === "origami" ? { spaceSlug: "crafts-making", slug: "paper-folding" } : null));
    expect(resolved).toEqual([]);
    expect(unresolved).toEqual(["origami (resolves to paper-folding: decide before attaching)", "table-tennis"]);
  });
});

describe("renderActivitiesFile", () => {
  it("writes a do-not-edit header, the types and one line per activity", () => {
    const out = renderActivitiesFile(resolveActivities(parseActivities(csv(row())), () => ({ spaceSlug: "crafts-making", slug: "origami" })).resolved);
    expect(out).toContain("GENERATED FILE. DO NOT EDIT.");
    expect(out).toContain('{ id: "origami-1", cornerSlug: "origami", spaceSlug: "crafts-making"');
  });
});
