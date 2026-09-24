import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Target, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { addJoinedProject } from "../lib/journal";
import { InvitePreview, fetchInvitePreview, fetchPursuitAsProject, joinViaLink } from "../lib/pursuitsRemote";
import { targetText } from "../lib/pursuitProgress";
import { PersonAvatar } from "./CreatePursuit";

/**
 * /join/:token — where an invite link lands. Works signed out: shows who
 * invited you and to what, then asks you to sign up or log in, and brings
 * you straight back here to finish joining.
 */
export function JoinPursuit() {
  const { token = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchInvitePreview(token).then((p) => !cancelled && setPreview(p));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const join = async () => {
    if (joining) return;
    setJoining(true);
    setError(null);
    const result = await joinViaLink(token);
    if (!result.pursuitId) {
      setError(result.error ?? "Couldn't join.");
      setJoining(false);
      return;
    }
    const project = await fetchPursuitAsProject(result.pursuitId);
    if (project) {
      addJoinedProject({
        ...project,
        role: project.ownerId === user?.id ? "owner" : "member",
      });
    }
    navigate(`/pursuit/${result.pursuitId}`, { replace: true });
  };

  if (preview === undefined || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Opening your invite…</p>
      </div>
    );
  }

  if (preview === null) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
          This invite isn't active.
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          The link may have been turned off. Ask whoever sent it for a new one.
        </p>
        <Link to="/">
          <Button variant="outline">Go to Sushii</Button>
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === preview.ownerId;
  const here = `/join/${token}`;

  return (
    <div className="min-h-screen bg-surface px-5 pb-24 pt-10">
      <div className="mx-auto max-w-md text-center">
        <div className="flex justify-center">
          <PersonAvatar name={preview.ownerName} src={preview.ownerAvatar} size="size-16" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {preview.ownerName} invited you to pursue this together
        </p>
        <h1 className="mt-2 text-[2rem] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>
          {preview.title}
        </h1>

        <div className="mt-6 space-y-2 rounded-2xl border border-border bg-card p-4 text-left text-sm">
          {preview.measure && (
            <p className="flex items-center gap-2.5">
              <Target className="size-4 shrink-0 text-muted-foreground" />
              {preview.mode === "group" ? `One shared goal: ${targetText(preview.measure)}` : `Your own goal: ${targetText(preview.measure)}`}
            </p>
          )}
          <p className="flex items-center gap-2.5">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            {preview.mode === "group"
              ? "Everyone contributes to the same total."
              : "Everyone has their own goal and journey, side by side."}
          </p>
          {preview.memberCount > 1 && (
            <p className="pl-[26px] text-xs text-muted-foreground">{preview.memberCount} people are in so far.</p>
          )}
        </div>

        <div className="mt-6">
          {isOwner ? (
            <Link to={`/pursuit/${preview.pursuitId}`}>
              <Button variant="coral" className="h-11 w-full rounded-xl">
                This is your Pursuit — open it
              </Button>
            </Link>
          ) : user ? (
            <Button variant="coral" className="h-11 w-full rounded-xl" onClick={join} disabled={joining}>
              {joining ? "Joining…" : "Join"}
            </Button>
          ) : (
            <>
              <Link to={`/login?redirect=${encodeURIComponent(here)}`}>
                <Button variant="coral" className="h-11 w-full rounded-xl">
                  Sign up or log in to join
                </Button>
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">Free to join. You'll come right back here.</p>
            </>
          )}
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}
