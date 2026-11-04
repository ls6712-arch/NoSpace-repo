import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { cornerHomeEntries, renderCornerHome } from "../../../scripts/cornerHomeData";

describe("Stubby's shared Corner table (supabase/functions/_shared/cornerHome.ts)", () => {
  it("matches the app's Corner data: run npx tsx scripts/gen-corner-home.ts if not", () => {
    const file = readFileSync(path.resolve(__dirname, "../../../supabase/functions/_shared/cornerHome.ts"), "utf8");
    expect(file).toBe(renderCornerHome(cornerHomeEntries()));
  });
});
