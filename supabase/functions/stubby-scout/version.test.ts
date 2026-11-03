// The app and stubby-scout must agree on one Stubby version (_shared/stubbyVersion.ts, Nov 3, 2026).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORS, handleScout, type ScoutDeps } from "./handler.ts";
import { corsFor } from "../_shared/access.ts";
import { STUBBY_SCHEMA_SHA256, STUBBY_UPDATING, STUBBY_VERSION, STUBBY_VERSION_HEADER, versionMatches } from "../_shared/stubbyVersion.ts";

/** Deps that fail the test if anything is read: a version mismatch stops before all of it. */
const untouched = new Proxy({} as ScoutDeps, {
  get(_t, key) {
    throw new Error(`read ${String(key)} after a version mismatch`);
  },
});

const post = (headers: Record<string, string>, body = "not json") => new Request("https://fn.example.com/stubby-scout", { method: "POST", headers, body });

describe("the stubby-version header", () => {
  it("answers another version with Stubby is updating, before reading anything", async () => {
    for (const v of ["2026-10-01.1", "9999-01-01.1", ""]) {
      const res = await handleScout(post({ [STUBBY_VERSION_HEADER]: v }), untouched);
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "Stubby is updating, try again in a minute.", code: "STUBBY_UPDATING" });
      expect(res.headers.get(STUBBY_VERSION_HEADER)).toBe(STUBBY_VERSION);
    }
  });

  it("lets the same version through, and no header at all (the morning schedule, older apps)", async () => {
    const settings = { settings: { enabled: true, hasKey: true } } as unknown as ScoutDeps;
    // A bad body is a 400 again once the version check has passed.
    expect((await handleScout(post({ [STUBBY_VERSION_HEADER]: STUBBY_VERSION }), settings)).status).toBe(400);
    expect((await handleScout(post({}), settings)).status).toBe(400);
    expect(versionMatches(null)).toBe(true);
    expect(versionMatches(` ${STUBBY_VERSION} `)).toBe(true);
  });

  it("is allowed by CORS and readable by the app, on every answer", () => {
    expect(CORS["access-control-allow-headers"]).toContain(STUBBY_VERSION_HEADER);
    expect(CORS["access-control-expose-headers"]).toBe(STUBBY_VERSION_HEADER);
    const c = corsFor("https://onsoosh.com", ["https://onsoosh.com"]);
    expect(c["access-control-allow-headers"]).toContain(STUBBY_VERSION_HEADER);
    expect(c["access-control-expose-headers"]).toBe(STUBBY_VERSION_HEADER);
  });

  it("says updating in plain words (style guide: no dashes, under 12 words)", () => {
    expect(STUBBY_UPDATING.error).not.toMatch(/[–—]/);
    expect(STUBBY_UPDATING.error.split(" ").length).toBeLessThanOrEqual(12);
  });

  it("is bumped whenever the request check changes: schema.ts is held to the hash next to the version", () => {
    const sha = createHash("sha256").update(readFileSync(new URL("./schema.ts", import.meta.url))).digest("hex");
    expect(sha, "schema.ts changed: bump STUBBY_VERSION and set STUBBY_SCHEMA_SHA256 in supabase/functions/_shared/stubbyVersion.ts").toBe(STUBBY_SCHEMA_SHA256);
  });
});
