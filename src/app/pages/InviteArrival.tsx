import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { fetchInvitePreview, type InvitePreview } from "../lib/invites";
import { saveInviteCode } from "../lib/inviteCode";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { WaitlistForm } from "../components/WaitlistForm";
import { APP_NAME } from "../config";

/**
 * /#/i/:code — Step 2's arrival page, where an invite link lands. Works
 * signed out (the whole point) and signed in alike; see the two early
 * returns below for what a signed-in visitor sees instead of the sign-in
 * buttons. A signed-in *pending* visitor never actually reaches this
 * component's own branches at all — Root.tsx's pending gate redirects to
 * /welcome first, same as it does for every other route.
 */
export function InviteArrival() {
  const { code = "" } = useParams();
  const { user, profile, loading, signInWithGoogle } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    fetchInvitePreview(code).then((p) => {
      if (cancelled) return;
      setPreview(p);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const startGoogle = async () => {
    setError(null);
    saveInviteCode(code);
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
  };

  if (checking || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-small text-muted-foreground">Checking your invite…</p>
      </div>
    );
  }

  // Already signed in and active: this invite isn't for them — they're
  // already on the app — so sign-in buttons here would do nothing useful.
  if (user && profile?.access === "active") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-small text-muted-foreground">You’re already on {APP_NAME}.</p>
        <Link to="/my-space">
          <Button variant="coral">Back to Home</Button>
        </Link>
      </div>
    );
  }

  if (!preview?.isValid) {
    return (
      <div className="min-h-viewport bg-surface px-5 pb-24 pt-16">
        <div className="mx-auto max-w-sm text-center">
          <h1 className="text-title" style={{ fontFamily: "var(--font-serif)" }}>
            This invite has expired or was already used.
          </h1>
          <div className="mt-8 text-left">
            <WaitlistForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-viewport bg-surface px-5 pb-24 pt-16">
      <div className="mx-auto max-w-sm text-center">
        <div className="flex justify-center">
          <Avatar className="size-16">
            {preview.inviterAvatar && (
              <AvatarImage src={preview.inviterAvatar} alt="" className="object-cover" />
            )}
            <AvatarFallback className="text-lead">
              {(preview.inviterName ?? "?").trim().slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <h1 className="mt-4 text-display leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          {preview.inviterName} invited you to {APP_NAME}
        </h1>
        {preview.note && (
          <p className="mt-3 text-small italic leading-relaxed text-muted-foreground">“{preview.note}”</p>
        )}

        <div className="mt-8 space-y-3">
          <Button variant="coral" className="h-11 w-full rounded-control" onClick={startGoogle}>
            Continue with Google
          </Button>
          <Link to="/login" onClick={() => saveInviteCode(code)}>
            <Button variant="outline" className="h-11 w-full rounded-control">
              Use email
            </Button>
          </Link>
        </div>
        {error && <p className="mt-3 text-caption text-destructive">{error}</p>}
      </div>
    </div>
  );
}
