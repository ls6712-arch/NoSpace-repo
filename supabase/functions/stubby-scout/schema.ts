// The request body, checked before anything else. Strict: an unknown field (a user_id, a guest_id,
// anything) is a 400, never read. Who is asking always comes from the verified token, never the body.
// Pure, no dependencies, so it runs the same under Deno and in vitest.

export const MAX_BODY_BYTES = 8_000;
export const MAX_ASK_CHARS = 500;

export type Body = {
  mode: "admin" | "restock" | "ask";
  focus?: string;
  ask?: string;
  answers?: { who?: string; when?: string; skip?: boolean };
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
    only(v.answers, ["who", "when", "skip"], "answers.");
    out.answers = { who: str(v.answers.who, 20, "answers.who"), when: str(v.answers.when, 20, "answers.when"), skip: bool(v.answers.skip, "answers.skip") };
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
