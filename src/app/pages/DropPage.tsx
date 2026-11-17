import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useAuth } from "../context/AuthContext";
import { PageShell } from "../components/layout/PageShell";
import { PillButton } from "../components/ui/PillButton";
import { Skeleton } from "../components/ui/skeleton";
import { StubArt } from "../components/stub/StubArt";
import { notify, notifyError } from "../components/ui/toaster";
import { closesLine, countLines, dropFace, dropLogPath, dropPath, dropPhase, dropSignUpPath, goalLine } from "../lib/drops";
import { DROP_COPY, invitedLine } from "../lib/dropCopy";
import { bringSomeone } from "../lib/dropShare";
import { fetchInvitePreview } from "../lib/invites";
import { shareStub } from "../lib/stubShareImage";
import { editionLabel } from "../lib/stubs";
import { firstName } from "../lib/tasteModel";
import { useDrop } from "../lib/useDrop";
import { NotFound } from "./NotFound";

/**
 * /drop/:slug: one drop, and the page a friend's link opens. Signed out it
 * shows the drop, who sent you, and Sign up, which ends back here. Signed in it
 * shows the one next step for where you stand: I'm in, Log a Moment, or your
 * number with Share and Bring someone. A drop that has not opened, or does not
 * exist, is the ordinary 404.
 */
export function DropPage() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const inviteCode = params.get("invite");
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { status, drop, mine, joining, join } = useDrop(slug, user?.id);
  const [now] = useState(() => Date.now());
  const [busy, setBusy] = useState<"share" | "bring" | null>(null);
  const [inviter, setInviter] = useState<{ name: string; code: string } | null>(null);

  // A friend's link: say who sent it, and carry their invite into sign-up only if it is still good.
  useEffect(() => {
    if (!inviteCode || user) return;
    let live = true;
    void fetchInvitePreview(inviteCode).then((p) => {
      if (live && p.isValid && p.inviterName) setInviter({ name: p.inviterName, code: inviteCode });
    });
    return () => {
      live = false;
    };
  }, [inviteCode, user]);

  if (status === "loading" || authLoading) {
    return (
      <PageShell title="">
        <div className="mx-auto flex max-w-[420px] flex-col items-center gap-4" aria-hidden="true">
          <Skeleton className="h-[330px] w-[220px] rounded-card" />
          <Skeleton className="h-8 w-3/4 rounded-control" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </PageShell>
    );
  }
  if (!drop) return <NotFound />;

  const open = dropPhase(drop, now) === "open";
  const finished = mine?.edition != null;
  const face = dropFace(drop, now, mine?.edition);
  const meta = [closesLine(drop, now), ...countLines(drop)];

  const onJoin = async () => {
    const r = await join();
    if (r.error) notifyError(r.error);
  };
  const onShare = async () => {
    setBusy("share");
    const outcome = await shareStub(face, firstName(profile?.display_name ?? ""));
    setBusy(null);
    if (outcome === "saved") notify(DROP_COPY.imageSaved);
    else if (outcome === "failed") notifyError(DROP_COPY.imageFailed);
  };
  const onBring = async () => {
    setBusy("bring");
    const outcome = await bringSomeone(drop, now);
    setBusy(null);
    if (outcome === "copied") notify(DROP_COPY.linkCopied);
    else if (outcome === "failed") notifyError(DROP_COPY.linkFailed);
  };

  return (
    <PageShell title={drop.title} kicker={DROP_COPY.kicker}>
      <div className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-5 text-center">
        <StubArt face={face} width={220} interactive className="-rotate-3" />

        <div className="flex flex-col gap-2">
          {!user && inviter && <p className="text-body font-semibold text-accent-text">{invitedLine(inviter.name)}</p>}
          {drop.blurb && <p className="text-lead">{drop.blurb}</p>}
          <p className="text-body font-semibold">{goalLine(drop)}</p>
          <p className="text-small text-muted-foreground">{meta.join(" · ")}</p>
        </div>

        <div className="flex w-full flex-col gap-3">
          {finished ? (
            <>
              <p className="text-title font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
                {`You’re ${editionLabel(mine!.edition!)}`}
              </p>
              {open && <p className="text-small text-muted-foreground">{DROP_COPY.kept}</p>}
              <PillButton className="w-full" disabled={busy === "share"} onClick={() => void onShare()}>
                {DROP_COPY.share}
              </PillButton>
              {open && (
                <PillButton variant="outline" className="w-full" disabled={busy === "bring"} onClick={() => void onBring()}>
                  {DROP_COPY.bring}
                </PillButton>
              )}
            </>
          ) : !open ? (
            <p className="text-body">{DROP_COPY.closed}</p>
          ) : !user ? (
            <>
              <PillButton className="w-full" onClick={() => navigate(dropSignUpPath(drop.slug, inviter?.code))}>
                {DROP_COPY.signUp}
              </PillButton>
              <PillButton variant="outline" className="w-full" onClick={() => navigate(`/login?redirect=${encodeURIComponent(dropPath(drop.slug))}`)}>
                {DROP_COPY.logIn}
              </PillButton>
              <p className="text-small text-muted-foreground">{DROP_COPY.signedOut}</p>
            </>
          ) : mine ? (
            <>
              <p className="text-small text-muted-foreground">{DROP_COPY.joined}</p>
              <PillButton className="w-full" onClick={() => navigate(dropLogPath(mine.pursuitId))}>
                {DROP_COPY.log}
              </PillButton>
              <PillButton variant="outline" className="w-full" disabled={busy === "bring"} onClick={() => void onBring()}>
                {DROP_COPY.bring}
              </PillButton>
            </>
          ) : (
            <PillButton className="w-full" disabled={joining} onClick={() => void onJoin()}>
              {DROP_COPY.join}
            </PillButton>
          )}
        </div>
      </div>
    </PageShell>
  );
}
