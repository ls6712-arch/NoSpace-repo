/**
 * The person's own "What you'll need" list for a Corner (or for one plan), kept
 * in this browser only. It starts from the Corner's needs, then it is theirs:
 * add, tick, remove. Every storage call is wrapped, so a browser that throws
 * (private mode, a full store) just forgets the list, never breaks the page.
 */

export interface ListItem {
  id: string;
  text: string;
  got: boolean;
}

export interface StartDraft {
  items: ListItem[];
  /** "What are you making?" */
  dish: string;
}

export const ITEM_MAX = 80;
const KEY_PREFIX = "soosh.start.v1";

export const draftKey = (userId: string | undefined, cornerKey: string, planId?: string | null) =>
  [KEY_PREFIX, userId ?? "anon", cornerKey, planId ?? ""].join(":");

const store = (): Storage | null => {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
};

export function seedDraft(needs: readonly string[]): StartDraft {
  return { items: needs.map((text, i) => ({ id: `n${i}`, text, got: false })), dish: "" };
}

function parse(raw: string | null): StartDraft | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StartDraft>;
    if (!v || !Array.isArray(v.items)) return null;
    const items = v.items.flatMap((i) =>
      i && typeof i.id === "string" && typeof i.text === "string" && i.text.trim() ? [{ id: i.id, text: i.text.slice(0, ITEM_MAX), got: i.got === true }] : [],
    );
    return { items, dish: typeof v.dish === "string" ? v.dish.slice(0, 80) : "" };
  } catch {
    return null;
  }
}

/** What was saved, or the Corner's own needs when nothing was (or storage is unavailable). */
export function loadDraft(key: string, needs: readonly string[]): StartDraft {
  try {
    return parse(store()?.getItem(key) ?? null) ?? seedDraft(needs);
  } catch {
    return seedDraft(needs);
  }
}

export function saveDraft(key: string, draft: StartDraft): void {
  try {
    store()?.setItem(key, JSON.stringify(draft));
  } catch {
    // The list is kept for this visit only.
  }
}

export function addItem(draft: StartDraft, text: string): StartDraft {
  const t = text.trim().slice(0, ITEM_MAX);
  if (!t) return draft;
  return { ...draft, items: [...draft.items, { id: `u${Date.now().toString(36)}${draft.items.length}`, text: t, got: false }] };
}

export const toggleItem = (draft: StartDraft, id: string): StartDraft => ({
  ...draft,
  items: draft.items.map((i) => (i.id === id ? { ...i, got: !i.got } : i)),
});

export const removeItem = (draft: StartDraft, id: string): StartDraft => ({ ...draft, items: draft.items.filter((i) => i.id !== id) });

/** "4 of 5 got", for the doing state. */
export function gotLine(items: readonly ListItem[]): string {
  return `${items.filter((i) => i.got).length} of ${items.length} got`;
}

/** The list as plain text for a message: the heading, then one line per thing. */
export function listText(heading: string, items: readonly ListItem[]): string {
  return [heading, ...items.map((i) => `- ${i.text}`)].join("\n");
}

/** "Priya is making cacio e pepe Thursday evening. Want in?" with the list under it when there is one. */
export function inviteText(opts: { name: string; verb: "making" | "doing"; what: string; when: string | null; items: readonly ListItem[]; needsHeading: string }): string {
  const who = opts.name.trim() ? `${opts.name.trim()} is` : "I’m";
  const line = `${who} ${opts.verb} ${opts.what}${opts.when ? ` ${opts.when}` : ""}. Want in?`;
  return opts.items.length > 0 ? `${line}\n\n${listText(opts.needsHeading, opts.items)}` : line;
}
