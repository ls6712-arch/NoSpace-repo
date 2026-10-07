import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { createInvite, inviteLink } from "../lib/invites";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { APP_NAME } from "../config";
import { plural } from "../lib/plural";
import { useSubmitGuard } from "../lib/useSubmitGuard";
import { ERROR_LINE } from "../lib/stateCopy";

/**
 * Step 3, "one optional invite card at the end of onboarding." Shown by
 * Onboarding.tsx only after the cover step has saved and only when the
 * person still has an invite to give (lib/invites.ts fetchInvitesLeft),
 * so it never offers something create_invite() would refuse.
 *
 * Optional in every way: "Not now" leaves with nothing written, and making
 * a link is one tap with the note left blank. The full invite ask is Step 4's
 * Day-2 moment, after a first response lands; this card stays one quiet offer.
 */
export function OnboardingInviteCard({
  invitesLeft,
  onDone,
  variant = "page",
}: {
  /** null = no limit (admins). */
  invitesLeft: number | null;
  onDone: () => void;
  /** "page" for onboarding's full screen; "card" for the Day-2 ask on
   * My Space (smaller heading, same content and buttons). */
  variant?: "page" | "card";
}) {
  const Heading = variant === "page" ? "h1" : "h2";
  const [note, setNote] = useState("");
  const [creating, runCreate] = useSubmitGuard();
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const create = () =>
    runCreate(async () => {
      setError(null);
      const result = await createInvite(note);
      if (result.error || !result.code) {
        setError(result.error || ERROR_LINE);
        return;
      }
      setLink(inviteLink(result.code));
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the link is on screen to copy by hand.
    }
  };

  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: APP_NAME, url: link });
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  };

  return (
    <div>
      <Heading
        className={variant === "page" ? "mb-1 text-title sm:text-display" : "mb-1 text-title"}
        style={{ fontFamily: "var(--font-serif)" }}
      >
        Invite someone?
      </Heading>
      <p className="mb-6 text-small text-[var(--ink-soft)]">
        {APP_NAME} is invite-only for now.{" "}
        {invitesLeft === null
          ? "Send an invite link to someone you’d like here."
          : `You have ${plural(invitesLeft, "invite")} to give.`}
      </p>

      {!link ? (
        <>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 280))}
            placeholder="A note for them (optional). They’ll see it when they open the link."
            className="mb-2"
          />
          <div className="mb-3 text-right text-caption text-[var(--ink-soft)]">{note.length}/280</div>
          {error && (
            <p role="alert" className="mb-3 text-caption text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onDone}>
              Not now
            </Button>
            <Button busy={creating} variant="coral" disabled={creating} onClick={create}>
              Create invite link
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex items-center gap-2 rounded-card border border-[var(--line)] bg-[var(--paper-raised)] px-3 py-2.5">
            <code className="min-w-0 flex-1 truncate text-caption" title={link}>{link}</code>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            {canShare && (
              <Button variant="outline" size="sm" onClick={share} aria-label="Share invite link">
                <Share2 className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="coral" onClick={onDone}>
              Done
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
