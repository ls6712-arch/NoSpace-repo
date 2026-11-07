import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareLive, functionFiles, hashFiles, liveName, recordProblems } from "./stubbyDeploy.ts";

const fake = (files: Record<string, string>) => (p: string) => {
  const k = p.replace(/^supabase\/functions\//, "");
  if (!(k in files)) throw new Error(`no ${k}`);
  return files[k];
};

describe("stubby-scout deploy record (Nov 3, 2026)", () => {
  const files = {
    "stubby-scout/index.ts": 'import { a } from "./a.ts";\nimport { s } from "../_shared/s.ts";\nimport { createClient } from "jsr:@supabase/supabase-js@2";',
    "stubby-scout/a.ts": 'import type { T } from "./b.ts";\nexport { a };',
    "stubby-scout/b.ts": "export type T = 1;",
    "stubby-scout/a.test.ts": "never imported",
    "_shared/s.ts": "export const s = 1;",
  };
  const read = fake(files);

  it("follows index.ts's imports, type-only and _shared included, and nothing else", () => {
    expect(functionFiles(read)).toEqual(["_shared/s.ts", "stubby-scout/a.ts", "stubby-scout/b.ts", "stubby-scout/index.ts"]);
  });

  it("finds what changed, was added or was dropped since the record", () => {
    const now = hashFiles(read, functionFiles(read));
    expect(recordProblems(now, { files: now })).toEqual([]);
    const old = { ...now, "stubby-scout/a.ts": "0".repeat(64), "stubby-scout/gone.ts": "1".repeat(64) };
    delete (old as Record<string, string>)["_shared/s.ts"];
    expect(recordProblems(now, { files: old })).toEqual([
      "_shared/s.ts: not in the last confirmed deploy",
      "stubby-scout/a.ts: changed since the last confirmed deploy",
      "stubby-scout/gone.ts: deployed, but no longer part of the function",
    ]);
    expect(recordProblems(now, null)).toHaveLength(1);
  });

  it("reads the API's file names in every shape it has used", () => {
    expect(liveName("user_fn_eyzokuhhbyidvmuqfmwm_8376ab22-01a1-4525-b59a-1f4dd9854c69_23/source/index.ts")).toBe("stubby-scout/index.ts");
    expect(liveName("source/handler.ts")).toBe("stubby-scout/handler.ts");
    expect(liveName("_shared/access.ts")).toBe("_shared/access.ts");
    expect(liveName("source/_shared/access.ts")).toBe("_shared/access.ts");
    expect(liveName("functions/stubby-scout/v3/types.ts")).toBe("stubby-scout/v3/types.ts");
    expect(liveName("functions/_shared/access.ts")).toBe("_shared/access.ts");
  });

  it("records a read-back only when every file matches byte for byte", () => {
    const list = functionFiles(read);
    const live = { files: list.map((f) => ({ name: f.startsWith("_shared") ? f : f.replace("stubby-scout/", "source/"), content: files[f as keyof typeof files] })) };
    expect(compareLive(live, read, list)).toEqual([]);
    live.files[0] = { ...live.files[0], content: `${live.files[0].content} ` };
    expect(compareLive(live, read, list)).toEqual(["_shared/s.ts: live differs from this commit"]);
    expect(compareLive({ files: live.files.slice(1) }, read, list)).toEqual(["_shared/s.ts: missing from the live function"]);
  });

  it("the real function's file list starts from its index.ts", () => {
    const real = functionFiles((p) => readFileSync(p));
    expect(real).toContain("stubby-scout/index.ts");
    expect(real).toContain("_shared/access.ts");
    expect(real).toContain("_shared/stubbyVersion.ts");
    expect(real.some((f) => f.includes(".test."))).toBe(false);
  });
});
