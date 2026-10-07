import fs from "node:fs";
import path from "node:path";

/**
 * Finds the text a person can read in the source: string literals, template
 * literals, JSX text and bare multi-line JSX text. Comments are removed first.
 * Used by the copy-rule tests (src/app/lib/copyRules.test.ts), which keep the
 * style guide (docs/style-guide.md) from drifting.
 */
export interface CopyString {
  file: string;
  line: number;
  text: string;
}

/** Replaces comments with blank space but keeps every newline, so the line
 * numbers that follow still match the original file. */
function blankComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (_m, pre: string) => pre);
}

export function extractStrings(file: string, src: string): CopyString[] {
  const out: CopyString[] = [];
  blankComments(src)
    .split("\n")
    .forEach((line, i) => {
      const s = line.trim();
      if (!s || s.startsWith("import ") || s.startsWith("export type ") || s.startsWith("type ")) return;
      const re = /"([^"\n]+)"|`([^`\n]+)`|>([^<>{}\n]+)<|^\s*([A-Za-z’'][^<>{}=\n;"`]*)$/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        const text = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
        if (text) out.push({ file, line: i + 1, text });
      }
    });
  return out;
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
}

/** Every user-facing string under src/app, plus the seed script. */
export function allUserFacingStrings(root: string): CopyString[] {
  const files: string[] = [];
  walk(path.join(root, "src", "app"), files);
  const seed = path.join(root, "seed-moments.js");
  if (fs.existsSync(seed)) files.push(seed);
  return files.flatMap((f) => extractStrings(path.relative(root, f), fs.readFileSync(f, "utf8")));
}
