// The request body, checked before anything else. Strict: an unknown field (a user_id, a guest_id,
// anything) is a 400, never read. Who is asking always comes from the verified token, never the body.
// Pure, no dependencies, so it runs the same under Deno and in vitest.

export const MAX_BODY_BYTES = 8_000;
export const MAX_ASK_CHARS = 500;

export type Body = {
  mode: "admin" | "restock" | "ask";
  focus?: string;
  ask?: string;
  answers?: { who?: (typeof WHO_VALUES)[number]; when?: string; skip?: boolean; setting?: (typeof SETTING_VALUES)[number]; rememberedWho?: (typeof WHO_VALUES)[number] };
  questions?: boolean;
  stream?: boolean;
  /**
   * With mode "ask" and no ask: how many asks are left, nothing searched. Shaped as an ask so the
   * function before this one answers it with a harmless 400, never as Find picks.
   */
  status?: boolean;
  followUp?: { of: number; kind: string; titles: string[] };
};

export class BodyError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function only(o: Record<string, unknown>, allowed: readonly string[], where: string) {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) throw new BodyError(`Unknown field ${where}${k}.`);
}

function str(v: unknown, max: number, name: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new BodyError(`${name} must be text.`);
  if (v.length > max) throw new BodyError(`${name} is too long.`);
  return v;
}

function bool(v: unknown, name: string): boolean | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "boolean") throw new BodyError(`${name} must be true or false.`);
  return v;
}

/** The fixed choices the app sends as answers. Anything else is a 400, never passed on. */
export const WHO_VALUES = ["solo", "partner", "friends", "family"] as const;
export const SETTING_VALUES = ["in", "out"] as const;
export const WHEN_VALUES = ["tonight", "tomorrow", "weekend"] as const;

/** A value from a fixed list, checked as text of at most 20 characters first. */
function oneOf<T extends string>(v: unknown, allowed: readonly T[], name: string): T | undefined {
  const s = str(v, 20, name);
  if (s === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(s)) throw new BodyError(`${name} is not one of the choices.`);
  return s as T;
}

/** tonight, tomorrow, weekend, or a real calendar day "YYYY-MM-DD". */
function whenValue(v: unknown): string | undefined {
  const s = str(v, 10, "answers.when");
  if (s === undefined || (WHEN_VALUES as readonly string[]).includes(s)) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!m || !d || d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) throw new BodyError("answers.when is not a day.");
  return s;
}

/** Reads and checks the raw body. Throws BodyError on anything unexpected. */
export function parseBody(raw: string): Body {
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) throw new BodyError("Too long.");
  let v: unknown = {};
  if (raw.trim() !== "") {
    try {
      v = JSON.parse(raw);
    } catch {
      throw new BodyError("Not JSON.");
    }
  }
  if (!isObj(v)) throw new BodyError("Not an object.");
  only(v, ["mode", "focus", "ask", "answers", "questions", "stream", "status", "followUp"], "");

  const mode = v.mode === undefined ? "admin" : v.mode;
  if (mode !== "admin" && mode !== "restock" && mode !== "ask") throw new BodyError("Unknown mode.");

  const out: Body = { mode };
  out.focus = str(v.focus, 200, "focus");
  out.ask = str(v.ask, MAX_ASK_CHARS, "ask");
  out.questions = bool(v.questions, "questions");
  out.stream = bool(v.stream, "stream");
  out.status = bool(v.status, "status");

  if (v.answers !== undefined && v.answers !== null) {
    if (!isObj(v.answers)) throw new BodyError("answers must be an object.");
    only(v.answers, ["who", "when", "skip", "setting", "rememberedWho"], "answers.");
    out.answers = {
      who: oneOf(v.answers.who, WHO_VALUES, "answers.who"),
      when: whenValue(v.answers.when),
      skip: bool(v.answers.skip, "answers.skip"),
      setting: oneOf(v.answers.setting, SETTING_VALUES, "answers.setting"),
      rememberedWho: oneOf(v.answers.rememberedWho, WHO_VALUES, "answers.rememberedWho"),
    };
  }

  if (v.followUp !== undefined && v.followUp !== null) {
    const f = v.followUp;
    if (!isObj(f)) throw new BodyError("followUp must be an object.");
    only(f, ["of", "kind", "titles"], "followUp.");
    if (typeof f.of !== "number" || !Number.isSafeInteger(f.of) || f.of <= 0) throw new BodyError("followUp.of must be an ask id.");
    const kind = str(f.kind, 20, "followUp.kind") ?? "";
    const titles = f.titles === undefined ? [] : f.titles;
    if (!Array.isArray(titles) || titles.length > 20 || titles.some((t) => typeof t !== "string" || t.length > 200)) throw new BodyError("followUp.titles must be up to 20 short texts.");
    out.followUp = { of: f.of, kind, titles: titles as string[] };
  }
  return out;
}
