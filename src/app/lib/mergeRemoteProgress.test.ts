import { describe, expect, it } from "vitest";
import { mergeProgressEntries } from "./journal";

const entry = (id: string, createdAt: number) => ({ id, projectId: "p1", amount: 1, createdAt });

describe("mergeProgressEntries", () => {
  it("adds database entries this browser lacks, oldest first", () => {
    const merged = mergeProgressEntries([entry("a", 2)], [entry("b", 1)]);
    expect(merged.map((e) => e.id)).toEqual(["b", "a"]);
  });
  it("never duplicates an entry already here", () => {
    const local = [entry("a", 1)];
    expect(mergeProgressEntries(local, [entry("a", 1)])).toBe(local);
  });
});
