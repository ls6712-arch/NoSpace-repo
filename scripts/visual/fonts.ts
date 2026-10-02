// The app loads its webfonts from Google Fonts. Layout checks need the real
// metrics, and some sandboxes can't reach the CDN from the browser, so this
// caches the latin subsets once (via curl, which honours proxy settings) and
// the runner serves them to the page through request interception.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export function cacheFonts(dir: string, fontsCssPath: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const importUrl = /@import url\(['"]([^'"]+)['"]\)/.exec(fs.readFileSync(fontsCssPath, "utf8"))?.[1];
  if (!importUrl) throw new Error(`no Google Fonts @import in ${fontsCssPath}`);
  const css = execFileSync("curl", ["-sS", "-A", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36", importUrl], { encoding: "utf8" });
  const faces = [...css.matchAll(/\/\* ([\w-]+) \*\/\s*(@font-face \{.*?\})/gs)].filter((m) => m[1] === "latin").map((m) => m[2]);
  const out = faces.map((face) => {
    const url = /url\((https:\/\/[^)]+)\)/.exec(face)![1];
    const name = crypto.createHash("md5").update(url).digest("hex").slice(0, 12) + ".woff2";
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) execFileSync("curl", ["-sS", "-o", file, url]);
    return face.replace(url, `/__fonts/${name}`);
  });
  fs.writeFileSync(path.join(dir, "fonts.css"), out.join("\n"));
}
