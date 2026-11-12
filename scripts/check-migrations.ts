/**
 * Fails if supabase/migrations/ breaks a rule in scripts/migrationRules.ts: two migrations with one
 * version, a new migration that sorts before one production already has, or a stray file.
 *
 * Usage: node scripts/check-migrations.ts [base-ref]
 *   base-ref: the branch the PR merges into (CI passes origin/<base>). Without it, only the rules
 *   that need no comparison are checked.
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { migrationProblems } from "./migrationRules.ts";

const DIR = "supabase/migrations";

function filesAt(ref: string): string[] {
  const out = execFileSync("git", ["ls-tree", "--name-only", `${ref}:${DIR}`], { encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

const baseRef = process.argv[2] || null;
const head = readdirSync(DIR);
const base = baseRef ? filesAt(baseRef) : null;
const problems = migrationProblems(head, base);

if (problems.length === 0) {
  console.log(`check-migrations: ${head.length} files, no problems${baseRef ? ` (compared with ${baseRef})` : ""}.`);
} else {
  console.log(`check-migrations: ${problems.length} problem(s)${baseRef ? ` (compared with ${baseRef})` : ""}:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
