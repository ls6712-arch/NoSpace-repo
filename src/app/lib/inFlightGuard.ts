/**
 * The backstop behind ContentContext.addPost and PrivateLogsContext.add: a
 * composer's own "Saving…"-disabled button is the normal guard against a
 * double submit, but Log.tsx once had a bug in exactly that guard (see
 * commit history), and nothing stops two different composers from calling
 * in at the same moment either. One InFlightGuard per write path refuses a
 * second concurrent call outright rather than letting it start a second
 * insert.
 *
 * Deliberately silent, not an error: the first call is still in progress
 * and — as far as anyone can tell yet — still on track to succeed, so a
 * second call arriving before it finishes isn't a failure a person needs
 * to see. `run` returns a distinct `{ skipped: true }` for that case
 * specifically so callers can tell it apart from a real failure and skip
 * showing any error state or toast for it, while still surfacing a genuine
 * error from `fn` itself normally.
 */
export interface InFlightSkipped {
  readonly skipped: true;
}

export function isInFlightSkipped(value: unknown): value is InFlightSkipped {
  return !!value && typeof value === "object" && (value as InFlightSkipped).skipped === true;
}

export class InFlightGuard {
  private busy = false;

  async run<T>(fn: () => Promise<T>): Promise<T | InFlightSkipped> {
    if (this.busy) return { skipped: true };
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
}
