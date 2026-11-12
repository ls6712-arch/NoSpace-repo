/** Bounded, deterministic interpretation. Unknown or contradictory time/money constraints fail closed. */
import { dayWindow, nyParts, nyTime, readIntent, searchWindow, type Answers, type Window } from "../intent.ts";

// Public activity vocabulary only: these canonical labels may be passed to hosted search.
const TOPICS: Record<string, string> = {
  pottery: "pottery|ceramics?|clay", painting: "paint(?:ing)?|watercolou?rs?", drawing: "draw(?:ing)?|sketch(?:ing)?",
  guitar: "guitars?", drums: "drums?|drumming", cycling: "cycl(?:e|es|ing)|bik(?:e|es|ing)", running: "run(?:s|ning)?|jogg?ing",
  walking: "walk(?:s|ing)?|stroll(?:s|ing)?", hiking: "hik(?:e|es|ing)", climbing: "climb(?:ing)?|bouldering",
  yoga: "yoga|pilates", museum: "museums?", library: "librar(?:y|ies)", gaming: "gaming|video games?",
  "board games": "board games?|tabletop", chess: "chess", cooking: "cook(?:ing)?", baking: "bak(?:e|es|ing)",
  dance: "danc(?:e|es|ing)", photography: "photography|photo walks?", knitting: "knit(?:ting)?|crochet(?:ing)?",
  swimming: "swim(?:ming)?", reading: "read(?:ing)?|book clubs?", gardening: "garden(?:ing)?", volunteering: "volunteer(?:ing)?",
  "bars and drinks": "bars?|brewer(?:y|ies)|wine|beer|cocktails?|tastings?",
  birdwatching: "bird(?:watching| watching)", astronomy: "astronomy|stargazing", music: "live music|concerts?|jazz",
};
export function negated(text: string, at: number): boolean {
  const clause = text.slice(Math.max(0, at - 100), at).split(/[.,;!?]|\b(?:but|instead|however|actually)\b/i).at(-1) ?? "";
  const scope = clause.replace(/\bnot only\b|\b(?:no|not)\s+(?:more|less|later|earlier)\s+than\b/gi, "")
    .replace(/\b(?:don['’]t|do not|can['’]t|cannot)\s+(?:want to\s+)?(?:spend|pay)\b/gi, "spend");
  return /\b(?:not|no|never|avoid|without|except|don['’]t|do not|doesn['’]t|isn['’]t|is not|can['’]t|cannot)\b/i.test(scope);
}
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function safeTopics(catalog: readonly string[]): string[] {
  return [...new Set(catalog.filter(x => /^[a-z][a-z -]{2,59}$/i.test(x) && !/\b(ignore|instruction|system|prompt|secret|assistant|disregard)\b/i.test(x)).map(x => x.toLowerCase()))].slice(0, 1000);
}
export function topicChoices(text: string, catalog: readonly string[] = []): { positive: string[]; negative: string[] } {
  const positive = new Set<string>();
  const negative = new Set<string>();
  for (const [topic, aliases] of Object.entries(TOPICS)) {
    for (const m of text.matchAll(new RegExp(`\\b(?:${aliases})\\b`, "gi"))) {
      (negated(text, m.index!) ? negative : positive).add(topic);
    }
  }
  for (const topic of safeTopics(catalog)) {
    if (Object.values(TOPICS).some(aliases => new RegExp(`^(?:${aliases})$`, "i").test(topic))) continue;
    for (const m of text.matchAll(new RegExp(`\\b${escapeRegex(topic)}\\b`, "gi"))) (negated(text, m.index!) ? negative : positive).add(topic);
  }
  // Prefer a named specific Corner over a generic word contained in it.
  for (const t of [...positive]) if ([...positive].some(other => other !== t && matchesTopic(other, t))) positive.delete(t);
  for (const t of positive) negative.delete(t);
  return { positive: [...positive], negative: [...negative] };
}
export const matchesTopic = (text: string, topic: string) => TOPICS[topic]
  ? new RegExp(`\\b(?:${TOPICS[topic]})\\b`, "i").test(text)
  : new RegExp(`\\b${escapeRegex(topic)}\\b`, "i").test(text);

function budgetOf(text: string): number | null {
  const money = [...text.matchAll(/\$\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)(?!\d|[.,]\d)/g),
    ...text.matchAll(/\b(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)\s*(?:dollars?|usd|bucks?)\b/gi)];
  const amounts = money.map(m => Number(m[1].replace(/,/g, ""))).filter(Number.isFinite);
  const availability = text.replace(/\b(?:i['’]m|i am|we['’]re|we are)\s+free\b|\bfree\s+(?:time|slots?|windows?)\b/gi, "available");
  for (const m of availability.matchAll(/\bfree\b|\bno cost\b|\bcosts nothing\b/gi)) {
    if (!negated(availability, m.index!) && !/\b(?:prefer|ideally)\s*$/i.test(availability.slice(0, m.index!)) && !/^\s+(?:preferred|if possible)/i.test(availability.slice(m.index! + m[0].length))) return 0;
  }
  if (amounts.length) return Math.min(...amounts);
  if (/\b(?:cheap|inexpensive|affordable)\b/i.test(text)) return 20;
  return null;
}
const CLOCK = "(?:[0-2]?\\d:[0-5]\\d(?:\\s*[ap]m)?|(?:1[0-2]|0?[1-9])\\s*[ap]m)";
function clock(s: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$/i.exec(s.trim());
  if (!m) return null;
  let hour = Number(m[1]); const minute = Number(m[2] ?? 0);
  if (minute > 59 || (m[3] ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (m[3]) hour = hour % 12 + (m[3].toLowerCase() === "pm" ? 12 : 0);
  return { hour, minute };
}
/** An ambiguous or nonexistent DST wall time requires another answer, never an arbitrary offset. */
function wallTime(day: ReturnType<typeof nyParts>, value: string, tz: string): number | null {
  const c = clock(value); if (!c) return null;
  const guess = nyTime(day.y, day.m, day.d, c.hour, c.minute, tz);
  const found = new Set<number>();
  for (const delta of [0, -120, -60, -30, 30, 60, 120]) {
    const ms = guess + delta * 60000; const p = nyParts(ms, tz);
    if (p.y === day.y && p.m === day.m && p.d === day.d && p.hour === c.hour && p.minute === c.minute) found.add(ms);
  }
  return found.size === 1 ? [...found][0] : null;
}
function timeWindow(text: string, base: Window, now: number, tz: string, answeredWhen: boolean): { window: Window; invalid: boolean } {
  let window = { ...base };
  const date = /\b\d{4}-\d{2}-\d{2}\b/.exec(text);
  if (date && !answeredWhen) {
    const w = dayWindow(date[0], now, tz);
    if (!w) return { window: { ...window, endMs: window.startMs }, invalid: true };
    window = w;
  }
  const day = nyParts(window.startMs, tz);
  const at = (h: number) => nyTime(day.y, day.m, day.d, h, 0, tz);
  if (/\b(?:tonight|evening)\b/i.test(text)) window.startMs = Math.max(window.startMs, at(17));
  else if (/\bmorning\b/i.test(text)) { window.startMs = Math.max(window.startMs, at(6)); window.endMs = Math.min(window.endMs, at(12)); }
  else if (/\bafternoon\b/i.test(text)) { window.startMs = Math.max(window.startMs, at(12)); window.endMs = Math.min(window.endMs, at(17)); }
  const starts = [...text.matchAll(new RegExp(`\\b(?:after|from|at)\\s+(${CLOCK})\\b`, "gi"))].map(m => m[1]);
  const ends = [...text.matchAll(new RegExp(`\\b(?:before|until|by)\\s+(${CLOCK})\\b`, "gi"))].map(m => m[1]);
  const between = new RegExp(`\\bbetween\\s+(\\d{1,2}(?::\\d{2})?(?:\\s*[ap]m)?)\\s+and\\s+(${CLOCK})\\b`, "i").exec(text);
  if (between) {
    let first = between[1];
    if (!/[ap]m/i.test(first) && /[ap]m/i.test(between[2])) first += between[2].match(/[ap]m/i)![0];
    starts.push(first); ends.push(between[2]);
  }
  let invalid = false;
  for (const [values, lower] of [[starts, true], [ends, false]] as const) for (const v of values) {
    const time = wallTime(day, v, tz);
    if (time === null) invalid = true;
    else if (lower) window.startMs = Math.max(window.startMs, time);
    else window.endMs = Math.min(window.endMs, time);
  }
  if (starts.length || ends.length || /\b(?:morning|afternoon|evening)\b/i.test(text)) window.hard = true;
  if (invalid || window.endMs <= window.startMs) return { window: { ...window, endMs: window.startMs }, invalid: true };
  return { window, invalid: false };
}
const CITIES = ["New York", "New York City", "NYC", "Boston", "London", "San Francisco", "Los Angeles", "Chicago", "Seattle", "Austin", "Toronto", "Vancouver", "Paris", "Berlin", "Mumbai", "New Delhi", "Delhi", "Kolkata", "Sydney", "Melbourne", "Tokyo", "Singapore"];
export function cityKey(city: string): string {
  const normalized = city.toLowerCase().replace(/[-_,.]/g, " ").replace(/\s+/g, " ").trim();
  return /^(?:nyc|new york(?: city| ny)?)$/.test(normalized) ? "new york" : normalized;
}
function cityIn(text: string): string | null | undefined {
  for (const m of text.matchAll(/\b(?:in|near|around)\s+([a-z][a-z ]{1,60})/gi)) {
    if (negated(text, m.index!)) continue;
    const city = [...CITIES].sort((a, b) => b.length - a.length).find(c => m[1].toLowerCase() === c.toLowerCase() || m[1].toLowerCase().startsWith(`${c.toLowerCase()} `));
    if (city) return city;
  }
  // Do not search the saved home city when a different, unrecognized named place was requested.
  if (/\b(?:in|near|around)\s+[A-Z][a-z]+\b/.test(text)) return null;
  return undefined;
}
function settingOf(text: string, answer?: Answers["setting"]) {
  const positive = new Set<string>(); const negative = new Set<string>();
  for (const [name, pattern] of [["home", "at home|stay(?:ing)? home|stay(?:ing)? in|from home|night in"], ["indoor", "indoors?"], ["outdoor", "outdoors?|outside"], ["away", "head(?:ing)? out|go(?:ing)? out|out of the house|night out"]]) {
    for (const m of text.matchAll(new RegExp(`\\b(?:${pattern})\\b`, "gi"))) (negated(text, m.index!) ? negative : positive).add(name);
  }
  const setting = positive.has("home") ? "home" : positive.has("indoor") ? "indoor" : positive.has("outdoor") ? "outdoor"
    : negative.has("outdoor") ? "indoor" : negative.has("indoor") ? "outdoor" : answer === "in" ? "home" : null;
  return { setting: setting as "home" | "indoor" | "outdoor" | null, awayFromHome: positive.has("away") || negative.has("home") || (answer === "out" && setting !== "home") };
}
const RESOURCES = ["guitar", "drums", "painting supplies", "bicycle", "gaming console", "camera", "yoga mat", "knitting needles"];
export function resourceChanges(text: string) {
  const add: string[] = []; const remove: string[] = [];
  for (const resource of RESOURCES) for (const m of text.matchAll(new RegExp(`\\b${resource}\\b`, "gi"))) {
    const prefix = text.slice(Math.max(0, m.index! - 50), m.index!);
    if (/\b(?:no longer|don['’]t|do not|lost|sold|gave away|without)\b/i.test(prefix)) remove.push(resource);
    else if (/\b(?:have|own|my|our)\s+(?:an?\s+)?$/i.test(prefix)) add.push(resource);
  }
  return { add, remove };
}
export function parseRequest(text: string, now: number, tz: string, answers: Answers | null, catalog: readonly string[] = []) {
  const topics = topicChoices(text, catalog);
  // Legacy parser still supplies company/time language; V3 owns money, negation and setting.
  const timeText = text.replace(/\b(?:not|never)\s+(?:tonight|today|tomorrow|this weekend|next weekend)\b/gi, "");
  const companyText = timeText.replace(/\b(?:without|no|not with)\s+(?:(?:my|the)\s+)?(?:kids?|children|friends|partner|girlfriend|boyfriend|family)\b/gi, "");
  const intent = readIntent(companyText.replace(/\bindoors?\b/gi, ""), { now, timeZone: tz, answers });
  const budget = budgetOf(text);
  intent.budget = budget === null ? null : { max: budget, free: budget === 0, from: "ask" };
  intent.from.budget = budget === null ? null : "ask";
  intent.adults = topics.positive.includes("bars and drinks");
  const setting = settingOf(text, answers?.setting);
  intent.setting = setting.setting === "home" ? "in" : setting.awayFromHome ? "out" : null;
  if (topics.positive.length || setting.setting) { intent.specific = true; intent.missing = null; }
  const time = timeWindow(timeText, searchWindow(intent, now, tz), now, tz, !!answers?.when);
  intent.when = time.window;
  const invalidMoney = /[€£¥]|\b(?:EUR|GBP|JPY|INR|euros?|pounds?|yen|rupees?)\b|\$\s*-\s*\d|\$\s*\d+[.,]\d{3,}(?!\d)/.test(text.replace(/\$\s*\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?/g, ""));
  if (invalidMoney) time.window.endMs = time.window.startMs;
  const city = cityIn(text);
  return { intent, window: time.window, ...setting, topics, city, resources: resourceChanges(text), issues: [...(time.invalid ? ["time"] : []), ...(invalidMoney ? ["budget"] : []), ...(city === null ? ["location"] : [])] };
}
