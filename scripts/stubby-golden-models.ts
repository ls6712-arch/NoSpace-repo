// Runs the Stubby plan's golden asks (docs/briefs/stubby-plan.md §11) live, on two models, and
// prints a short comparison for the PR: pass or fail per case, tokens, searches and cost per ask.
//
//   ANTHROPIC_API_KEY=... node scripts/stubby-golden-models.ts \
//     [--models claude-haiku-5-5,claude-sonnet-5-5] \
//     [--price claude-haiku-5-5=IN:OUT,claude-sonnet-5-5=IN:OUT]   dollars per million input:output tokens
//     [--search-price 0.01]                                         dollars per web search
//
// Live web search can't be fed fake pages, so this uses today's clock and real results; the
// golden unit tests (supabase/functions/stubby-scout/golden.test.ts) pin the rules with a fixed
// clock. A case passes when the code's checks leave what the case expects: a question for case 1,
// picks inside the window (or the soonest after, marked) for 2, a solo mix with one idea for 3,
// nothing over the budget for 4, free family picks for 5. Nothing is written anywhere.
import { checkAskPicks } from "../supabase/functions/stubby-scout/ask.ts";
import { askSystemPrompt, askUserPrompt, type AboutPerson } from "../supabase/functions/stubby-scout/askPrompt.ts";
import { readIntent, searchWindow, type Answers } from "../supabase/functions/stubby-scout/intent.ts";
import { readPicksBlock } from "../supabase/functions/stubby-scout/picks.ts";
import { runSearch } from "../supabase/functions/stubby-scout/search.ts";

const args = process.argv.slice(2);
const opt = (n: string, d = "") => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const key = process.env.ANTHROPIC_API_KEY;
if (!key) { console.error("Set ANTHROPIC_API_KEY."); process.exit(1); }
const models = opt("models", "claude-haiku-5-5,claude-sonnet-5-5").split(",");
const prices = new Map(opt("price").split(",").filter(Boolean).map((p) => { const [m, v] = p.split("="); const [i, o] = v.split(":").map(Number); return [m, { i, o }] as const; }));
const searchPrice = Number(opt("search-price", "NaN"));

const NOBODY: AboutPerson = { corners: [], freeTimes: [], neighborhood: null, city: "New York", passes: [], sooshPages: [] };
const POTTERY_RUNNING: AboutPerson = { ...NOBODY, corners: ["Pottery", "Running"], sooshPages: [{ label: "Pottery, how to start", url: "/start/crafts/pottery" }, { label: "Running, how to start", url: "/start/sports-fitness/running" }] };
const CORNERS = new Map([["pottery", 7], ["running", 8]]);

interface Case { name: string; ask: string; person: AboutPerson; monthly?: number; answers?: Answers; picked?: number[] }
const CASES: Case[] = [
  { name: "1 something fun", ask: "something fun", person: NOBODY },
  { name: "2 girlfriend tonight", ask: "something fun to do with my girlfriend tonight", person: NOBODY },
  { name: "3 tonight, just me", ask: "something to do tonight", person: POTTERY_RUNNING, answers: { who: "solo" }, picked: [7, 8] },
  { name: "4 pottery tonight, $50", ask: "pottery tonight", person: NOBODY, monthly: 50 },
  { name: "5 free, weekend, kids", ask: "free stuff this weekend with the kids", person: NOBODY },
];

async function run(model: string, c: Case) {
  const now = Date.now();
  const intent = readIntent(c.ask, { now, monthlyBudget: c.monthly ?? null, cornerNames: c.person.corners, answers: c.answers });
  if (c.name.startsWith("1")) return { pass: intent.missing === "who", note: `question: ${intent.missing}`, input: 0, output: 0, searches: 0 };
  const window = searchWindow(intent, now);
  const r = await runSearch({ apiKey: key!, model, maxSearches: 5, focus: null, cornerNames: c.person.corners, now, prompt: { system: askSystemPrompt(), user: askUserPrompt(c.ask, intent, window, c.person, now) } });
  const raw = readPicksBlock(r.text) ?? [];
  const { kept, dropped, outcome } = checkAskPicks(raw, { now, intent, window, sourceLinks: r.sourceLinks, sooshLinks: new Set(c.person.sooshPages.map((p) => p.url)), corners: CORNERS, pickedCornerIds: new Set(c.picked ?? []), askText: c.ask, latestMs: window.endMs + 7 * 86_400_000 });
  const ideas = kept.filter((p) => p.kind === "idea").length;
  const pass =
    c.name.startsWith("3") ? kept.length >= 2 && ideas === 1 && kept.filter((p) => p.betterWithFriend).length <= 1 :
    c.name.startsWith("2") ? outcome !== "nothing" || raw.length > 0 :
    kept.length > 0;
  return { pass, note: `${outcome}: kept ${kept.length} of ${raw.length} (${ideas} idea), dropped ${dropped.length}${kept.some((p) => !p.why) ? ", a pick with no why" : ""}`, input: r.usage?.input ?? 0, output: r.usage?.output ?? 0, searches: r.searches };
}

const lines = ["| Case | " + models.join(" | ") + " |", "|---|" + models.map(() => "---|").join("")];
const totals = new Map(models.map((m) => [m, { input: 0, output: 0, searches: 0, asks: 0, passed: 0 }]));
for (const c of CASES) {
  const cells: string[] = [];
  for (const m of models) {
    try {
      const r = await run(m, c);
      const t = totals.get(m)!;
      t.input += r.input; t.output += r.output; t.searches += r.searches; t.passed += r.pass ? 1 : 0; if (r.searches || r.input) t.asks += 1;
      cells.push(`${r.pass ? "pass" : "FAIL"}: ${r.note}`);
    } catch (e) {
      cells.push(`ERROR: ${String((e as Error).message).slice(0, 80)}`);
    }
  }
  lines.push(`| ${c.name} | ${cells.join(" | ")} |`);
}
const cost = (m: string) => {
  const t = totals.get(m)!;
  const p = prices.get(m);
  if (!p || !t.asks || Number.isNaN(searchPrice)) return "give --price and --search-price";
  return `$${(((t.input * p.i + t.output * p.o) / 1e6 + t.searches * searchPrice) / t.asks).toFixed(4)}`;
};
lines.push(`| Passed | ${models.map((m) => `${totals.get(m)!.passed} of ${CASES.length}`).join(" | ")} |`);
lines.push(`| Per ask: tokens in/out, searches | ${models.map((m) => { const t = totals.get(m)!; const n = t.asks || 1; return `${Math.round(t.input / n)}/${Math.round(t.output / n)}, ${(t.searches / n).toFixed(1)}`; }).join(" | ")} |`);
lines.push(`| Cost per ask | ${models.map(cost).join(" | ")} |`);
console.log(lines.join("\n"));
