import { expect, it } from "vitest";
import { windowWords } from "../../supabase/functions/stubby-scout/handler.ts";
import { buildContext } from "../../supabase/functions/stubby-scout/v3/context.ts";
import { rankCandidates } from "../../supabase/functions/stubby-scout/v3/recommendation.ts";
import { candidate, input } from "./fixtures.ts";
it("uses exact saved hours in Stubby's context instead of discarding them", () => {
  expect(windowWords(["mon@1140-1260", "wed@720-780", "sat-day"])).toEqual([
    "Monday 19:00 to 21:00 America/New_York",
    "Wednesday 12:00 to 13:00 America/New_York",
    "Saturday daytime",
  ]);
});
it("rewards an activity only when its whole known duration fits the saved hours", () => {
  const base = input({ text: "pottery this week indoors" });
  const ctx = buildContext({
    ...base,
    profile: { ...base.profile, windows: ["tue@1140-1260"] },
  });
  const at = Date.parse("2026-11-04T00:00:00Z");
  const inside = candidate({ startsAt: at, endsAt: at + 2 * 3600000 });
  const outside = candidate({ startsAt: at, endsAt: at + 3 * 3600000 });
  const a = rankCandidates([inside], ctx, []).recommendations;
  const b = rankCandidates([outside], ctx, []).recommendations;
  expect(a).toHaveLength(1);
  expect(b).toHaveLength(1);
  expect(a[0].score - b[0].score).toBe(4);
});
