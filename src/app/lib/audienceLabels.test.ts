import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOMENT_VISIBILITY_OPTIONS, visibilityWord } from "./visibility";

/** One label set for who sees a Moment: Group, Followers, Everyone, Only you. Wording only. */
const SRC = join(__dirname, "..", "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}
const all = files(SRC).map((p) => ({ p, s: readFileSync(p, "utf8") }));

describe("audience labels", () => {
  it("the shared options use Only you, Followers, Everyone", () => {
    expect(MOMENT_VISIBILITY_OPTIONS.map((o) => o.label)).toEqual(["Only you", "Followers", "Everyone"]);
  });

  it("a public Moment reads Everyone, never Public", () => {
    expect(visibilityWord({ visibility: "public" } as never)).toBe("Everyone");
    expect(visibilityWord({ visibility: "followers" } as never)).toBe("Followers");
  });

  it("no audience label says Public", () => {
    const bad = all.filter(({ s }) => /(label:\s*|public:\s*(\{\s*label:\s*)?)"Public"/.test(s)).map(({ p }) => p);
    expect(bad).toEqual([]);
  });

  it("the Log picker says Followers, not Friends", () => {
    const log = all.find(({ p }) => p.endsWith("pages/Log.tsx"))!.s;
    expect(log).not.toMatch(/label:\s*"Friends"/);
    expect(log).toMatch(/label:\s*"Followers"/);
    const posted = all.find(({ p }) => p.endsWith("log/PostedScreen.tsx"))!.s;
    expect(posted).not.toMatch(/Posted to your friends/);
  });
});
