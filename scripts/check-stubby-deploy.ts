/**
 * Fails when stubby-scout on this commit is not the one last deployed and read back (Nov 3, 2026):
 * the app on Vercel ships from main on every merge, the function only when someone deploys it, and
 * the two drifting apart broke Stubby live. CI runs this on every push to main (it fails) and on
 * pull requests with --warn (it only says a deploy will be needed after merging).
 *
 * Fix a failure: deploy stubby-scout from main, read it back, and record it:
 *   node scripts/record-stubby-deploy.ts <get_edge_function answer as JSON>
 * then merge that record (supabase/deploys/stubby-scout.json) in a small PR.
 *
 * Usage: node scripts/check-stubby-deploy.ts [--warn]
 */
import { existsSync, readFileSync } from "node:fs";
import { functionFiles, hashFiles, RECORD_PATH, recordProblems, type DeployRecord } from "./stubbyDeploy.ts";

const warn = process.argv.includes("--warn");
const read = (p: string) => readFileSync(p);
const files = functionFiles(read);
const record = existsSync(RECORD_PATH) ? (JSON.parse(readFileSync(RECORD_PATH, "utf8")) as DeployRecord) : null;
const problems = recordProblems(hashFiles(read, files), record);

if (problems.length === 0) {
  console.log(`check-stubby-deploy: ${files.length} files match live version ${record!.version} (read back ${record!.confirmedAt}).`);
} else {
  console.log(`check-stubby-deploy: stubby-scout here is not the deployed one (live version ${record?.version ?? "unknown"}):`);
  for (const p of problems) console.log(`  - ${p}`);
  console.log("After merging: deploy stubby-scout from main, read it back, run node scripts/record-stubby-deploy.ts <read-back.json>, and merge the record.");
  if (!warn) process.exit(1);
}
