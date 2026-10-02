import { useState } from "react";
import { joinWaitlist } from "../lib/invites";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

/**
 * Step 2 (invite-only sign-up)'s one waitlist form, shared by the door
 * screen (/welcome), the invite arrival page's expired/used state
 * (/i/:code), and the signed-out landing page — every place that offers
 * "no invite yet?" instead of a sign-up button. join_waitlist reports
 * success for a duplicate email too, so "You're on the list." is honest
 * either way rather than needing its own already-joined copy.
 */
export function WaitlistForm({ className = "" }: { className?: string }) {
  const [email, setEmail] = useState("");
  const [hobby, setHobby] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    const ok = await joinWaitlist(email, hobby);
    setSubmitting(false);
    if (!ok) {
      setError("Couldn’t reach the server. Try again.");
      return;
    }
    setDone(true);
  };

  if (done) {
    return <p className={`text-sm text-muted-foreground ${className}`}>You’re on the list.</p>;
  }

  return (
    <form onSubmit={submit} className={`space-y-3 ${className}`}>
      <div>
        <Label htmlFor="waitlist-email" className="sr-only">
          Email
        </Label>
        <Input
          id="waitlist-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          autoComplete="email"
          required
        />
      </div>
      <div>
        <Label htmlFor="waitlist-hobby" className="sr-only">
          What do you make?
        </Label>
        <Input
          id="waitlist-hobby"
          value={hobby}
          onChange={(e) => setHobby(e.target.value)}
          placeholder="What do you make? (optional)"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button type="submit" variant="outline" className="w-full" disabled={submitting || !email.trim()}>
        {submitting ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
