/**
 * Stubby's picks as a deck of cards (stubby-plan §6.5). Pure, and kept in this browser only
 * (pickPrivacy.test.ts): nothing about the deck, a Not now or Your selection is sent anywhere
 * until the Privacy Policy line for learning is published (plan PR 5).
 *
 * - `order`: the deck, front first. Keep takes the front card to Your selection; Not now sends
 *   it to the back, so it comes around again only after the rest.
 * - `passed`: cards said Not now to this round. When the front card is one of them, the deck has
 *   run out ("That's all I found. Want more?") until See the ones you skipped clears them.
 * - `recent`: the last 3 said Not now to, newest last, for Bring it back.
 * - `selection`: Your selection, up to 5, in the order kept.
 * - `all`: every card this deck has held, for the "2 of 5" count.
 */
export interface DeckState {
  order: number[];
  passed: number[];
  recent: number[];
  selection: number[];
  all: number[];
}

export const EMPTY_DECK: DeckState = { order: [], passed: [], recent: [], selection: [], all: [] };
export const SELECTION_MAX = 5;
export const BRING_BACK_MAX = 3;

const without = (list: readonly number[], id: number) => list.filter((x) => x !== id);

/** A new deck from an ask's picks. Your selection carries over, and nothing in it is dealt again. */
export function dealDeck(state: DeckState, ids: readonly number[]): DeckState {
  const fresh = ids.filter((id, i) => ids.indexOf(id) === i && !state.selection.includes(id));
  return { order: fresh, passed: [], recent: [], selection: state.selection, all: fresh };
}

/** A follow-up's picks go to the back of the deck, never replacing it. */
export function addCards(state: DeckState, ids: readonly number[]): DeckState {
  const known = new Set([...state.all, ...state.selection]);
  const fresh = ids.filter((id, i) => ids.indexOf(id) === i && !known.has(id));
  return { ...state, order: [...state.order, ...fresh], all: [...state.all, ...fresh] };
}

/** The card in front, or null when the deck is empty or has run out (only Not now cards left). */
export function frontCard(state: DeckState): number | null {
  const id = state.order[0];
  return id === undefined || state.passed.includes(id) ? null : id;
}

/** "2 of 5": the front card's place among every card this deck has held. */
export function cardCount(state: DeckState): { n: number; total: number } | null {
  const id = frontCard(state);
  if (id === null) return null;
  return { n: state.all.indexOf(id) + 1, total: state.all.length };
}

export const selectionFull = (state: DeckState) => state.selection.length >= SELECTION_MAX;

/** Keep: the front card goes to Your selection and the next comes forward. Not when the selection is full. */
export function keepFront(state: DeckState): DeckState {
  const id = frontCard(state);
  if (id === null || selectionFull(state)) return state;
  return { ...state, order: state.order.slice(1), recent: without(state.recent, id), selection: [...state.selection, id] };
}

/** Not now: the front card goes to the back of the deck. */
export function notNowFront(state: DeckState): DeckState {
  const id = frontCard(state);
  if (id === null) return state;
  return {
    ...state,
    order: [...state.order.slice(1), id],
    passed: [...without(state.passed, id), id],
    recent: [...without(state.recent, id), id].slice(-BRING_BACK_MAX),
  };
}

/** Bring it back: the card last said Not now to comes to the front again. */
export function bringBack(state: DeckState): DeckState {
  const id = state.recent[state.recent.length - 1];
  if (id === undefined || !state.order.includes(id)) return { ...state, recent: state.recent.slice(0, -1) };
  return { ...state, order: [id, ...without(state.order, id)], passed: without(state.passed, id), recent: state.recent.slice(0, -1) };
}

/** See the ones you skipped: the Not now cards are fresh again, in the order they were passed. */
export function seeSkipped(state: DeckState): DeckState {
  return { ...state, passed: [], recent: [] };
}

/** Removed from Your selection: back into the deck, at the back. */
export function unselect(state: DeckState, id: number): DeckState {
  if (!state.selection.includes(id)) return state;
  return { ...state, selection: without(state.selection, id), order: [...without(state.order, id), id], all: state.all.includes(id) ? state.all : [...state.all, id] };
}

/** Made into plans (or removed for good): gone from the deck and the selection. */
export function dropCards(state: DeckState, ids: readonly number[]): DeckState {
  const gone = new Set(ids);
  const keep = (list: readonly number[]) => list.filter((x) => !gone.has(x));
  return { order: keep(state.order), passed: keep(state.passed), recent: keep(state.recent), selection: keep(state.selection), all: state.all };
}

/** Cards whose picks are gone (removed, or past) leave the deck. */
export function prune(state: DeckState, alive: ReadonlySet<number>): DeckState {
  const keep = (list: readonly number[]) => list.filter((x) => alive.has(x));
  return { order: keep(state.order), passed: keep(state.passed), recent: keep(state.recent), selection: keep(state.selection), all: keep(state.all) };
}

// ── this browser only ─────────────────────────────────────────────────────

export const DECK_KEY = "soosh.stubby.deck.v1";

const ids = (v: unknown): number[] => (Array.isArray(v) ? v.filter((x): x is number => Number.isInteger(x)) : []);

/** The saved deck for this person, or an empty one. Never throws. */
export function loadDeck(userId: string | undefined): DeckState {
  if (!userId) return EMPTY_DECK;
  try {
    const raw = window.localStorage.getItem(`${DECK_KEY}:${userId}`);
    if (!raw) return EMPTY_DECK;
    const v = JSON.parse(raw) as Record<string, unknown>;
    return { order: ids(v.order), passed: ids(v.passed), recent: ids(v.recent).slice(-BRING_BACK_MAX), selection: ids(v.selection).slice(0, SELECTION_MAX), all: ids(v.all) };
  } catch {
    return EMPTY_DECK;
  }
}

export function saveDeck(userId: string | undefined, state: DeckState): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(`${DECK_KEY}:${userId}`, JSON.stringify(state));
  } catch {
    // Private mode or storage blocked: the deck lasts for this visit only.
  }
}
