/**
 * Records a deploy of stubby-scout, only after reading it back: takes the live function as the
 * Supabase API returns it (get_edge_function: version and every file's content), compares each
 * file with this commit byte for byte, and writes supabase/deploys/stubby-scout.json only if all
 * of them match. Anything different is listed and nothing is written.
 *
 * Usage: node scripts/record-stubby-deploy.ts <read-back.json> [project-ref]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { compareLive, functionFiles, hashFiles, RECORD_PATH, type DeployRecord } from "./stubbyDeploy.ts";

const [path, project = "eyzokuhhbyidvmuqfmwm"] = process.argv.slice(2);
if (!path) {
  console.log("Usage: node scripts/record-stubby-deploy.ts <read-back.json> [project-ref]");
  process.exit(2);
}
const live = JSON.parse(readFileSync(path, "utf8")) as { version: number; files: { name: string; content: string }[] };
const read = (p: string) => readFileSync(p);
const files = functionFiles(read);
const problems = compareLive(live, read, files);
if (problems.length > 0) {
  console.log(`record-stubby-deploy: live version ${live.version} does not match this commit; nothing written:`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
const record: DeployRecord = { function: "stubby-scout", project, version: live.version, confirmedAt: new Date().toISOString().slice(0, 10), files: hashFiles(read, files) };
writeFileSync(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`);
console.log(`record-stubby-deploy: ${files.length} files match live version ${live.version}; wrote ${RECORD_PATH}.`);
