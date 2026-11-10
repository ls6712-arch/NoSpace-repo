/**
 * Every phrase the back navigation needs, in one place so the founder can
 * change them without touching a component.
 *
 * Proposed, NOT yet approved (docs/briefs back navigation brief, section 3).
 * Nothing here ships as final until the founder says so.
 */
export const NAV_COPY = {
  /** Accessible name of the bare chevron. Screen readers only; nothing is drawn. */
  backLabel: "Back",
  /** Accessible name of a flow's X. */
  closeLabel: "Close",
  /** Title of the discard check for a Moment. */
  discardMomentTitle: "Discard this Moment?",
  /** Title of the discard check for any other flow. */
  discardChangesTitle: "Discard changes?",
  discardAction: "Discard",
  keepEditingAction: "Keep editing",
} as const;
