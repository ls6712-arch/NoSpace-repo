import fs from "node:fs";
import path from "node:path";

/**
 * Placeholder text that must never ship to production: the example.com
 * contact address and the "[PLACEHOLDER" legal last-updated lines. The
 * production build fails while any of them is in the source; preview builds
 * only warn (see vite.config.ts).
 */
const BANNED = [/example\.com/i, /\[PLACEHOLDER/];

export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
}

export interface PlaceholderHit {
  file: string;
  line: number;
  text: string;
}

export function findPlaceholdersInSource(file: string, src: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  stripComments(src)
    .split("\n")
    .forEach((text, i) => {
      if (BANNED.some((re) => re.test(text))) hits.push({ file, line: i + 1, text: text.trim() });
    });
  return hits;
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|html)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
}

/** Every placeholder in the shipped source under `root`/src and index.html. */
export function findLaunchPlaceholders(root: string): PlaceholderHit[] {
  const files: string[] = [path.join(root, "index.html")];
  walk(path.join(root, "src"), files);
  return files.flatMap((f) => {
    if (!fs.existsSync(f)) return [];
    return findPlaceholdersInSource(path.relative(root, f), fs.readFileSync(f, "utf8"));
  });
}
