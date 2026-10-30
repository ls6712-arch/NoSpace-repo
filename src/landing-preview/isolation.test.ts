import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The in-memory preview client (fakeSupabase.ts) and its example people must
 * never reach a production bundle. It is only swapped in by the vite plugin in
 * `--mode landing-preview` (vite.config.ts), and the only app code that names
 * the preview folder is a dynamic import behind an `import.meta.env.MODE`
 * check in routes.ts, which the build removes. This fails if anything else
 * starts importing it.
 */
const SRC = path.resolve(__dirname, "..");
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? files(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");

describe("landing-preview isolation", () => {
  const outside = files(SRC).filter((f) => !rel(f).startsWith("landing-preview/"));

  it("nothing outside src/landing-preview imports it, except the guarded routes", () => {
    const importers = outside.filter((f) => /from\s+["'][^"']*landing-preview[^"']*["']|import\(["'][^"']*landing-preview[^"']*["']\)/.test(fs.readFileSync(f, "utf8")));
    expect(importers.map(rel)).toEqual(["app/routes.ts"]);
  });

  it("routes.ts reaches it only through a dynamic import inside the landing-preview mode check", () => {
    const src = fs.readFileSync(path.join(SRC, "app/routes.ts"), "utf8");
    expect(src).not.toMatch(/^import .*landing-preview/m);
    const guarded = src.slice(src.indexOf('import.meta.env.MODE === "landing-preview"'));
    expect(guarded.indexOf("import(")).toBeGreaterThan(-1);
    const unguarded = src.slice(0, src.indexOf('import.meta.env.MODE === "landing-preview"'));
    expect(unguarded).not.toMatch(/import\(["'][^"']*landing-preview/);
  });

  it("the vite plugin that swaps the client is off outside landing-preview mode", () => {
    const cfg = fs.readFileSync(path.resolve(SRC, "../vite.config.ts"), "utf8");
    expect(cfg).toContain("if (mode !== 'landing-preview') return { name: 'landing-preview-off' }");
  });
});
