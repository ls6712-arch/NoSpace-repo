/**
 * Writes supabase/functions/_shared/cornerHome.ts from the app's Corner data, so Stubby's function
 * can offer a Corner's at-home first step and what it needs without importing the app (Nov 3, 2026).
 * src/app/lib/cornerHome.test.ts fails when the two drift apart: run this again and commit.
 *
 * Usage: npx tsx scripts/gen-corner-home.ts
 */
import { writeFileSync } from "node:fs";
import { cornerHomeEntries, renderCornerHome } from "./cornerHomeData.ts";

writeFileSync("supabase/functions/_shared/cornerHome.ts", renderCornerHome(cornerHomeEntries()));
console.log(`gen-corner-home: ${cornerHomeEntries().length} Corners written.`);
