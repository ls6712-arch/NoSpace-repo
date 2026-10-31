import { removeEntry } from "./calendarEntries";
import { cancelOwnPlan, deleteSession, leavePlan } from "./planEdits";
import { ERROR_LINE } from "./stateCopy";
import { resumePendingChanges, type PersistedChange } from "./undo";

/**
 * Sends one change that waited out its 6 seconds. Each is safe to repeat: deleting
 * what is already gone, leaving what you already left and removing an entry that
 * is not there all change nothing. Returns an error line, or null.
 */
export async function sendPending(change: PersistedChange): Promise<string | null> {
  const p = change.payload;
  switch (change.type) {
    case "cancelPlan":
      return cancelOwnPlan(Number(p.sessionId), typeof p.pursuitId === "string" ? p.pursuitId : undefined);
    case "deleteSession":
      return deleteSession(Number(p.sessionId));
    case "leavePlan":
      return leavePlan({ id: String(p.id), kind: p.kind === "event" ? "event" : "session" }, change.userId);
    case "removeEntry":
      return removeEntry(Number(p.entryId));
    default:
      return ERROR_LINE;
  }
}

/** Called once the person is known, from the app's root: whatever an earlier page left waiting goes now if its 6 seconds are up. */
export const resumeCalendarChanges = (userId: string) => resumePendingChanges(userId, sendPending);
