import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The monthly budget is private: never on a profile, a Stub or any shared
 * view. This lists every component and page that may touch it. A new file that
 * reads the budget has to be added here on purpose, which is the moment to ask
 * whether anyone else can see that screen.
 */
const ROOT = path.resolve(__dirname, "..");
const ALLOWED = new Set([
  // The owner's own screens.
  "components/week/BudgetSlider.tsx",
  "components/week/GlanceCard.tsx",
  "pages/Week.tsx",
  "pages/WhoCanSeeMyTime.tsx",
  "pages/onboarding/screens/YoursScreen.tsx",
  // The owner-only card on your own profile (its section is not part of the public profile).
  "components/profile/PlanningCard.tsx",
]);
const BUDGET = /monthly_budget|monthlyBudget|MonthlyBudget|budgetLabel|budgetLine|BudgetSlider|\bbudget\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("budget privacy", () => {
  const files = [...sources(path.join(ROOT, "components")), ...sources(path.join(ROOT, "pages"))].map((f) => path.relative(ROOT, f).split(path.sep).join("/"));

  it("is read by no component or page that is not on the owner-only list", () => {
    const readers = files.filter((f) => BUDGET.test(readFileSync(path.join(ROOT, f), "utf8")));
    expect(readers.filter((f) => !ALLOWED.has(f))).toEqual([]);
  });

  it("is not in a Stub, a shared Ticket or a public Shelf component", () => {
    const shared = files.filter((f) => /^components\/(stub|stubby|shelf|share)\//i.test(f) || /^pages\/(Shelf|PublicProfile|StubPage)/.test(f));
    expect(shared.length).toBeGreaterThan(0);
    expect(shared.filter((f) => BUDGET.test(readFileSync(path.join(ROOT, f), "utf8")))).toEqual([]);
  });
});
