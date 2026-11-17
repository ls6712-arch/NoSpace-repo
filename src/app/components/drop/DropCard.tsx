import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { PillButton } from "../ui/PillButton";
import { StubArt } from "../stub/StubArt";
import { notify, notifyError } from "../ui/toaster";
import { closesLine, countLines, dropFace, dropLogPath, dropPath, type Drop, type MyDrop } from "../../lib/drops";
import { bringSomeone } from "../../lib/dropShare";
import { editionLabel } from "../../lib/stubs";
import { DROP_COPY } from "../../lib/dropCopy";

/**
 * The open drop, first thing on Home: its Stub, what to do, when it closes and
 * the real counts, with the one next step for where you stand. Not joined: I'm
 * in. Joined: Log a Moment. Finished: your number, and Bring someone.
 */
export function DropCard({
  drop,
  mine,
  joining,
  onJoin,
  now,
}: {
  drop: Drop;
  mine: MyDrop | null;
  joining: boolean;
  onJoin: () => Promise<{ pursuitId: string | null; error: string | null }>;
  now: number;
}) {
  const navigate = useNavigate();
  const [bringing, setBringing] = useState(false);
  const to = dropPath(drop.slug);
  const finished = mine?.edition != null;
  const meta = [closesLine(drop, now), ...countLines(drop)].join(" · ");

  const join = async () => {
    const r = await onJoin();
    if (r.error) notifyError(r.error);
    else if (r.pursuitId) navigate(to);
  };
  const bring = async () => {
    setBringing(true);
    const outcome = await bringSomeone(drop, now);
    setBringing(false);
    if (outcome === "copied") notify(DROP_COPY.linkCopied);
    else if (outcome === "failed") notifyError(DROP_COPY.linkFailed);
  };

  return (
    <article aria-labelledby="home-drop-title" className="flex items-stretch gap-4 overflow-hidden rounded-card border border-border bg-card p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-small font-semibold text-accent-text">{DROP_COPY.kicker}</p>
        <h2 id="home-drop-title" className="text-title font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          <Link to={to} className="text-foreground">
            {drop.title}
          </Link>
        </h2>
        {drop.blurb && <p className="line-clamp-2 text-body">{drop.blurb}</p>}
        <p className="text-small text-muted-foreground">{meta}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {finished ? (
            <>
              <p className="mr-1 text-body font-semibold">{`You’re ${editionLabel(mine!.edition!)}`}</p>
              <PillButton variant="outline" disabled={bringing} onClick={() => void bring()}>
                {DROP_COPY.bring}
              </PillButton>
            </>
          ) : mine ? (
            <PillButton onClick={() => navigate(dropLogPath(mine.pursuitId))}>{DROP_COPY.log}</PillButton>
          ) : (
            <PillButton disabled={joining} onClick={() => void join()}>
              {DROP_COPY.join}
            </PillButton>
          )}
        </div>
      </div>
      <Link to={to} aria-hidden="true" tabIndex={-1} className="flex shrink-0 items-center self-center">
        <StubArt face={dropFace(drop, now, mine?.edition)} width={96} shimmer className="-rotate-3" />
      </Link>
    </article>
  );
}
