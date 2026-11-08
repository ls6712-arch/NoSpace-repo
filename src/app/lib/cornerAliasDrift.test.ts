import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MERGED_CORNERS } from "../data/hobbies";

/**
 * The Corner walls RPCs match a Moment to its Corner with a copy of MERGED_CORNERS
 * inside private.corner_alias_sources() (supabase/migrations). This fails when the
 * two lists differ. The fix is a new migration that redefines the function; never
 * an edit to one that has run. The latest migration that defines the function wins.
 */
const dir = path.resolve(__dirname, "../../../supabase/migrations");

function latestAliasList(): { file: string; pairs: Record<string, string> } {
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql") && !f.startsWith("rollback_"))
    .sort();
  const defining = files.filter((f) => /create\s+(or\s+replace\s+)?function\s+private\.corner_alias_sources\s*\(/i.test(fs.readFileSync(path.join(dir, f), "utf8")));
  expect(defining.length).toBeGreaterThan(0);
  const file = defining[defining.length - 1];
  const sql = fs.readFileSync(path.join(dir, file), "utf8");
  const start = sql.search(/create\s+(or\s+replace\s+)?function\s+private\.corner_alias_sources\s*\(/i);
  const body = sql.slice(start, sql.indexOf("$$;", sql.indexOf("$$", start) + 2));
  const pairs: Record<string, string> = {};
  for (const m of body.matchAll(/\(\s*'([a-z0-9-]+\/[a-z0-9-]+)'\s*,\s*'([a-z0-9-]+\/[a-z0-9-]+)'\s*\)/g)) pairs[m[1]] = m[2];
  return { file, pairs };
}

describe("Corner alias list", () => {
  it("is the same in hobbies.ts (MERGED_CORNERS) and private.corner_alias_sources()", () => {
    const { file, pairs } = latestAliasList();
    const missingInSql = Object.keys(MERGED_CORNERS).filter((k) => pairs[k] !== MERGED_CORNERS[k]);
    const extraInSql = Object.keys(pairs).filter((k) => MERGED_CORNERS[k] !== pairs[k]);
    expect({ file, missingInSql, extraInSql }).toEqual({ file, missingInSql: [], extraInSql: [] });
  });
  it("reads a non-empty list, so an unparseable file cannot pass by being empty", () => {
    expect(Object.keys(latestAliasList().pairs).length).toBe(Object.keys(MERGED_CORNERS).length);
  });
});
