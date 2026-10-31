import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SUBSCRIBE } from "../../lib/calendarCopy";
import { feedUrl, fetchFeedStatus, localToken, resetFeedLink, type FeedStatus } from "../../lib/calendarFeed";
import { TOAST } from "../../lib/stateCopy";
import { notify, notifyError } from "../ui/toaster";

/** Puts text on the clipboard: the modern way, then the old one for a page that may not use it. True when it worked. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * The state and the two actions behind the subscribe link. The link is made on the
 * first Copy, kept in this browser, and copied again from there; on a device that
 * does not have it, only Reset link is offered (a reset makes a new one and stops the old).
 */
export function useSubscribeLink() {
  const { user } = useAuth();
  const userId = user?.id;
  const [status, setStatus] = useState<FeedStatus | "loading">("loading");
  const [here, setHere] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void fetchFeedStatus(userId).then((s) => {
      if (!live) return;
      setStatus(s);
      setHere(!!localToken(userId));
    });
    return () => {
      live = false;
    };
  }, [userId]);

  const give = useCallback(async (url: string) => {
    if (await copyText(url)) notify(TOAST.linkCopied);
    else notifyError(SUBSCRIBE.copy);
  }, []);

  /** Copy subscribe link: copies this browser's link, making the first one when there is none. */
  const copy = useCallback(async () => {
    if (!userId || busy) return;
    const token = localToken(userId);
    if (token) {
      const url = feedUrl(token);
      if (url) return void (await give(url));
    }
    if (status === "active") return;
    setBusy(true);
    const r = await resetFeedLink(userId);
    setBusy(false);
    if (!r.url) return void notifyError(r.error ?? "");
    setStatus("active");
    setHere(true);
    await give(r.url);
  }, [userId, busy, status, give]);

  /** Reset link: a new link, and the old one stops working. */
  const reset = useCallback(async () => {
    if (!userId || busy) return;
    setBusy(true);
    const r = await resetFeedLink(userId);
    setBusy(false);
    if (!r.url) return void notifyError(r.error ?? "");
    setStatus("active");
    setHere(true);
    await give(r.url);
  }, [userId, busy, give]);

  return { visible: !!userId && status !== "loading" && status !== "unavailable", status, here, busy, copy, reset };
}

const PILL = "inline-flex min-h-11 items-center justify-center rounded-full border border-border bg-card px-4 text-small font-semibold text-foreground disabled:opacity-50";

/** The two buttons and the line under them, for the calendar's card and for Settings. */
export function SubscribeActions({ link }: { link: ReturnType<typeof useSubscribeLink> }) {
  const needsReset = link.status === "active" && !link.here;
  return (
    <div className="flex flex-col items-start gap-2">
      {needsReset ? (
        <p className="text-caption text-muted-foreground">{SUBSCRIBE.elsewhere}</p>
      ) : (
        <button type="button" onClick={() => void link.copy()} disabled={link.busy} className={PILL}>
          {SUBSCRIBE.copy}
        </button>
      )}
      {link.status === "active" && (
        <div className="flex flex-col items-start gap-0.5">
          <button type="button" onClick={() => void link.reset()} disabled={link.busy} className={needsReset ? PILL : "inline-flex min-h-11 items-center text-small font-semibold text-accent-text underline-offset-4 hover:underline"}>
            {SUBSCRIBE.reset}
          </button>
          <span className="text-caption text-muted-foreground">{SUBSCRIBE.resetHint}</span>
        </div>
      )}
    </div>
  );
}

/** "Your calendars" on the calendar: a card under Show. Out of sight until the link can be made. */
export function SubscribeCard({ className }: { className?: string }) {
  const link = useSubscribeLink();
  if (!link.visible) return null;
  return (
    <section aria-labelledby="calendar-feed-h" className={`flex flex-col gap-3 rounded-card border border-border bg-card p-4 ${className ?? ""}`}>
      <h2 id="calendar-feed-h" className="text-lead">
        {SUBSCRIBE.heading}
      </h2>
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-semibold">{SUBSCRIBE.title}</span>
        <span className="text-caption text-muted-foreground">{SUBSCRIBE.hint}</span>
      </div>
      <SubscribeActions link={link} />
    </section>
  );
}
