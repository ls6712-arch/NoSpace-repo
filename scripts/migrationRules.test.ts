import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { migrationProblems, migrationsIn } from "./migrationRules";

const BASE = [
  "20261110000000_log_punch_cards.sql",
  "rollback_20261110000000_log_punch_cards.sql",
  "20261111000000_stubby_ask_decision_trace.sql",
  "rollback_20261111000000_stubby_ask_decision_trace.sql",
];

describe("migration rules", () => {
  it("passes a clean folder with a new migration after the base's latest", () => {
    expect(migrationProblems([...BASE, "20261111000010_member_rpc_gate.sql", "rollback_20261111000010_member_rpc_gate.sql"], BASE)).toEqual([]);
  });

  it("fails two migrations with one version (what happened on Nov 3)", () => {
    const head = [...BASE, "20261111000000_member_rpc_gate.sql"];
    const p = migrationProblems(head, null);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/Version 20261111000000 is used by 2 migrations/);
  });

  it("fails a new migration that sorts before, or level with, one production already has", () => {
    expect(migrationProblems([...BASE, "20261109120000_late_arrival.sql"], BASE)[0]).toMatch(/20261109120000_late_arrival\.sql is new but sorts at or before 20261111000000_stubby_ask_decision_trace\.sql/);
    expect(migrationProblems([...BASE, "20261111000000_same_second.sql"], BASE).some((x) => /is new but sorts at or before/.test(x))).toBe(true);
  });

  it("doesn't count migrations the base already has as new", () => {
    expect(migrationProblems(BASE, BASE)).toEqual([]);
  });

  it("fails stray files", () => {
    const p = migrationProblems([...BASE, "notes.md", "2026111_bad.sql", "rollback_bad.sql"], BASE);
    expect(p).toHaveLength(3);
    expect(p.join("\n")).toMatch(/notes\.md: not a migration/);
    expect(p.join("\n")).toMatch(/2026111_bad\.sql: not a migration/);
    expect(p.join("\n")).toMatch(/rollback_bad\.sql: not a migration/);
  });

  it("sorts by version", () => {
    expect(migrationsIn(["20261111000010_b.sql", "rollback_20261111000010_b.sql", "20261110000000_a.sql"]).map((m) => m.file)).toEqual(["20261110000000_a.sql", "20261111000010_b.sql"]);
  });

  it("the repo's own folder passes the rules that need no base", () => {
    expect(migrationProblems(readdirSync("supabase/migrations"), null)).toEqual([]);
  });
});
