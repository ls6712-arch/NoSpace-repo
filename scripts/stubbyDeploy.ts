/**
 * What "stubby-scout is deployed from main" means, checkably (Nov 3, 2026): the files the function
 * is built from (index.ts and everything it imports, _shared included), each with its sha256, and
 * a record of the set that was last deployed and read back from the live project
 * (supabase/deploys/stubby-scout.json). Pure apart from the file reader it is handed.
 */
import { createHash } from "node:crypto";
import { posix } from "node:path";

export const FUNCTIONS_DIR = "supabase/functions";
export const ENTRY = "stubby-scout/index.ts";
export const RECORD_PATH = "supabase/deploys/stubby-scout.json";

export interface DeployRecord {
  function: "stubby-scout";
  project: string;
  /** The live version number read back after the deploy. */
  version: number;
  /** The day it was read back and compared, YYYY-MM-DD. */
  confirmedAt: string;
  /** Paths relative to supabase/functions, to sha256. */
  files: Record<string, string>;
}

export type Read = (path: string) => Buffer | string;

const IMPORT = /(?:import|export)\s[^;]*?from\s+"(\.{1,2}\/[^"]+\.ts)"/g;

/** index.ts and every local file it imports, as paths relative to supabase/functions, sorted. */
export function functionFiles(read: Read, entry = ENTRY): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = read(`${FUNCTIONS_DIR}/${file}`).toString();
    for (const m of text.matchAll(IMPORT)) queue.push(posix.normalize(posix.join(posix.dirname(file), m[1])));
  }
  return [...seen].sort();
}

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function hashFiles(read: Read, files: readonly string[]): Record<string, string> {
  return Object.fromEntries(files.map((f) => [f, sha256(read(`${FUNCTIONS_DIR}/${f}`))]));
}

/** What differs between the files on this commit and the record: empty when the deploy is confirmed. */
export function recordProblems(current: Record<string, string>, record: Pick<DeployRecord, "files"> | null): string[] {
  if (!record) return [`no deploy record at ${RECORD_PATH}`];
  const out: string[] = [];
  for (const [f, h] of Object.entries(current)) {
    if (!(f in record.files)) out.push(`${f}: not in the last confirmed deploy`);
    else if (record.files[f] !== h) out.push(`${f}: changed since the last confirmed deploy`);
  }
  for (const f of Object.keys(record.files)) if (!(f in current)) out.push(`${f}: deployed, but no longer part of the function`);
  return out;
}

/**
 * A file name as the Supabase API returns it ("user_fn_<project>_<id>_23/source/index.ts",
 * "source/index.ts", "functions/stubby-scout/index.ts", "_shared/access.ts"), as a path relative to supabase/functions.
 */
export function liveName(name: string): string {
  let n = name.replace(/^.*?_\d+\//, "").replace(/^\/+/, "");
  n = n.replace(/^source\//, "");
  // The CLI's --use-api deploy names files relative to supabase/ ("functions/stubby-scout/index.ts").
  n = n.replace(/^functions\//, "");
  if (n.startsWith("_shared/") || n.startsWith("stubby-scout/")) return n;
  return `stubby-scout/${n}`;
}

/**
 * Compares a live read-back (the get_edge_function answer: version and files with their content)
 * with the files on this commit, byte for byte. Returns the problems; empty means they match.
 */
export function compareLive(live: { files: { name: string; content: string }[] }, read: Read, files: readonly string[]): string[] {
  const got = new Map(live.files.map((f) => [liveName(f.name), f.content]));
  const out: string[] = [];
  for (const f of files) {
    const mine = read(`${FUNCTIONS_DIR}/${f}`);
    const theirs = got.get(f);
    if (theirs === undefined) out.push(`${f}: missing from the live function`);
    else if (sha256(Buffer.from(theirs, "utf8")) !== sha256(mine)) out.push(`${f}: live differs from this commit`);
  }
  for (const f of got.keys()) if (!files.includes(f)) out.push(`${f}: live has it, this commit's function doesn't`);
  return out;
}
