/**
 * The in-progress Moment draft — everything on the caption screen except the
 * attached photo/video, which can't live in localStorage (see
 * draftMedia.ts for that half). Local-first, same as the rest of this app:
 * this is what makes a draft survive a full browser close and reopen, with
 * or without an account. A signed-in account additionally gets a best-effort
 * mirror of just these fields (draftRemote.ts) for cross-device recovery —
 * the photo/video itself only ever recovers on the device that captured it.
 *
 * Only one draft is tracked at a time by design (v1 scope) — starting a new
 * capture overwrites whatever was here before, once the person has actually
 * been asked about it (see the resume-or-discard prompt in Log.tsx).
 */
const DRAFT_KEY = "nospace.draft.v1";

export interface MomentDraftFields {
  thought: string;
  hobbySlug: string;
  subHobby: string;
  interest: string;
  spaceSet: boolean;
  audience: string;
  circleId?: number;
  isActivity: boolean;
  startsAt: string;
  locationName: string;
  locationPrivacy: string;
  projectId: string;
  projectTitle: string;
  /** Whether media was attached when this was saved — a marker only. The
   * actual file lives in IndexedDB (this device) or nowhere (another
   * device), never here. */
  mediaType: "photo" | "video" | null;
  updatedAt: number;
}

/** Whether a draft actually has anything in it worth offering to resume —
 * the same bar the caption screen itself uses to decide whether there's
 * something to lose. */
export function draftHasContent(draft: MomentDraftFields): boolean {
  return (
    draft.thought.trim().length > 0 ||
    !!draft.mediaType ||
    draft.audience !== "private" ||
    draft.interest.trim().length > 0 ||
    draft.isActivity ||
    !!draft.projectId ||
    draft.projectTitle.trim().length > 0
  );
}

export function saveLocalDraft(fields: MomentDraftFields) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
  } catch {
    // best effort — a private window or full storage shouldn't break composing
  }
}

export function loadLocalDraft(): MomentDraftFields | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as MomentDraftFields) : null;
  } catch {
    return null;
  }
}

export function clearLocalDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // best effort
  }
}
