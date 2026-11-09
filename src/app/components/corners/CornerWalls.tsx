import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { supabase } from "../../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { ErrorNotice } from "../StateViews";
import { AvatarStack } from "../ui/AvatarStack";
import { Segmented } from "../ui/Segmented";
import { PillButton } from "../ui/PillButton";
import { PressLink } from "../common/PressLink";
import { SECTION_GAP } from "../../lib/pageGrid";
import { cornerStyle } from "../../lib/categoryStyle";
import {
  WALL_PAGE,
  fetchPassedAlong,
  fetchWall,
  sortAt,
  type Chain,
  type WallCard as Card,
  type WallKind,
} from "../../lib/cornerWalls";
import { WALL_COPY, WallCard, WallCardShape } from "./WallCard";

interface Wall {
  cards: Card[];
  more: boolean;
  loading: boolean;
}

const EMPTY: Wall = { cards: [], more: false, loading: true };

/** Faces of the newest posters on a wall, at most 3, never a number. */
export function wallFaces(cards: readonly Card[]) {
  const seen = new Set<string>();
  const out: { name: string; avatarUrl?: string }[] = [];
  for (const c of cards) {
    if (seen.has(c.authorId)) continue;
    seen.add(c.authorId);
    out.push({ name: c.authorName, avatarUrl: c.authorAvatarUrl });
    if (out.length === 3) break;
  }
  return out;
}

/** Which walls have something to show: an empty wall gets no panel. */
export function wallsToShow(making: readonly Card[], made: readonly Card[]): { making: boolean; made: boolean } {
  return { making: making.length > 0, made: made.length > 0 };
}

function Panel({ kind, wall, tint, hidden, onMore, children }: { kind: WallKind; wall: Wall; tint: string; hidden: boolean; onMore: () => void; children: React.ReactNode }) {
  const title = kind === "making" ? WALL_COPY.stillMaking : WALL_COPY.madeIt;
  const line = kind === "making" ? WALL_COPY.stillMakingLine : WALL_COPY.madeItLine;
  const faces = wallFaces(wall.cards);
  return (
    <section
      aria-labelledby={`wall-${kind}`}
      data-wall={kind}
      style={{ "--wall-tint": tint } as React.CSSProperties}
      className={`${hidden ? "hidden desk:block" : ""} rounded-card bg-[var(--wall-tint)] p-4 tab:p-5`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`wall-${kind}`} className="text-title">
            {title}
          </h3>
          <p className="text-small text-muted-foreground">{line}</p>
        </div>
        {faces.length > 0 && <AvatarStack people={faces} size="size-8" />}
      </div>
      {children}
      {wall.more && (
        <div className="mt-4">
          <Button variant="outline" onClick={onMore}>
            Show more
          </Button>
        </div>
      )}
    </section>
  );
}

/** "Passed along": up to 3 chains as chips with arrows, ending in a dashed You? that opens Make your version. */
export function PassedAlong({ chains, onYou, card = false }: { chains: Chain[]; onYou: (chain: Chain) => void; card?: boolean }) {
  if (chains.length === 0) return null;
  return (
    <section className={card ? "rounded-card border border-border bg-card p-4 tab:p-5" : SECTION_GAP} aria-labelledby="passed-title">
      <h3 id="passed-title" className="text-title">
        {WALL_COPY.passedAlong}
      </h3>
      <p className="mb-4 text-small text-muted-foreground">{WALL_COPY.passedAlongLine}</p>
      <ul className="flex flex-col gap-3">
        {chains.map((chain, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            {chain.chips.map((chip, j) => (
              <span key={j} className="inline-flex items-center gap-2">
                {j > 0 && <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />}
                <span className="inline-flex min-h-9 items-center rounded-full border border-border bg-card px-3 text-small">{chip}</span>
              </span>
            ))}
            {!chain.mine && (
              <span className="inline-flex items-center gap-2">
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => onYou(chain)}
                  className="inline-flex min-h-11 items-center rounded-full border border-dashed border-foreground/40 px-4 text-small font-semibold hover:bg-card"
                >
                  {WALL_COPY.you}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The Walls tab of a Corner page: Still making and Made it side by side on a
 * desktop (one at a time behind a two-option control on a phone), then Passed
 * along. An empty wall is not shown; when both are empty there is one card
 * that invites a Moment. Visitors (signed out, or not approved yet) get blurred
 * shapes only: nothing is asked of the server for them, so no names, photos or
 * captions are ever sent.
 */
export function CornerWalls({
  corner,
  restricted,
  onOpenMoment,
  onMake,
  onMakeFromChain,
  onLogMoment,
  onDoWithPeople,
  chat,
}: {
  corner: { spaceSlug: string; slug: string; name: string };
  /** The Corner chat card, for approved members: it sits beside Passed along (full width when there is none). */
  chat?: React.ReactNode;
  restricted: boolean;
  onOpenMoment: (card: Card) => void;
  onMake: (card: Card) => void;
  onMakeFromChain: (chain: Chain) => void;
  onLogMoment: () => void;
  onDoWithPeople: () => void;
}) {
  const { user } = useAuth();
  const key = `${corner.spaceSlug}/${corner.slug}`;
  const [making, setMaking] = useState<Wall>(EMPTY);
  const [made, setMade] = useState<Wall>(EMPTY);
  const [chains, setChains] = useState<Chain[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mineStarted, setMineStarted] = useState<Set<number>>(new Set());
  const [phoneWall, setPhoneWall] = useState<WallKind>("making");

  const load = useCallback(
    async (kind: WallKind, before?: number) => {
      const rows = await fetchWall(key, kind, { before, limit: WALL_PAGE + 1 });
      return { cards: rows.slice(0, WALL_PAGE), more: rows.length > WALL_PAGE };
    },
    [key],
  );

  useEffect(() => {
    if (restricted) return;
    let cancelled = false;
    setFailed(false);
    setMaking(EMPTY);
    setMade(EMPTY);
    Promise.all([load("making"), load("made"), fetchPassedAlong(key, user?.id).catch(() => [] as Chain[])])
      .then(([a, b, c]) => {
        if (cancelled) return;
        setMaking({ ...a, loading: false });
        setMade({ ...b, loading: false });
        setChains(c);
        // A wall with nothing on it is not a tab on a phone.
        if (a.cards.length === 0 && b.cards.length > 0) setPhoneWall("made");
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [key, restricted, load, attempt, user?.id]);

  // Which of these Moments the viewer already started their own Pursuit because of.
  useEffect(() => {
    if (restricted || !supabase || !user) return;
    const ids = [...making.cards, ...made.cards].map((c) => c.postId);
    if (ids.length === 0) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase!.from("pursuits").select("inspired_by_post_id").eq("user_id", user.id).in("inspired_by_post_id", ids);
      if (!cancelled) setMineStarted(new Set((data ?? []).map((r) => r.inspired_by_post_id as number)));
    })();
    return () => {
      cancelled = true;
    };
  }, [making.cards, made.cards, restricted, user]);

  const more = async (kind: WallKind) => {
    const wall = kind === "making" ? making : made;
    const last = wall.cards[wall.cards.length - 1];
    if (!last) return;
    try {
      const next = await load(kind, sortAt(last));
      const set = kind === "making" ? setMaking : setMade;
      set((prev) => ({ cards: [...prev.cards, ...next.cards], more: next.more, loading: false }));
    } catch {
      setFailed(true);
    }
  };

  const tints = useMemo(
    () => ({
      making: "color-mix(in srgb, var(--cat, var(--accent)) 14%, var(--background))",
      made: "color-mix(in srgb, var(--success) 12%, var(--background))",
    }),
    [],
  );

  if (restricted) {
    return (
      <div style={cornerStyle(corner.spaceSlug, corner.slug)} className={SECTION_GAP}>
        <div className="relative">
          <ul aria-hidden="true" className="grid gap-4 tab:grid-cols-2 desk:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <WallCardShape key={i} />
            ))}
          </ul>
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="flex max-w-sm flex-col items-center gap-3 rounded-card border border-border bg-card p-6 text-center shadow-overlay">
              <p className="text-lead font-semibold">{WALL_COPY.visitors}</p>
              <PressLink to="/onboarding" className="inline-flex min-h-12 items-center justify-center rounded-control bg-[var(--accent)] px-6 text-body font-semibold text-[var(--accent-foreground)]">
                Sign up
              </PressLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (failed) return <ErrorNotice className={SECTION_GAP} onRetry={() => setAttempt((n) => n + 1)} />;

  if (making.loading || made.loading) {
    return (
      <div className={SECTION_GAP} aria-busy="true" aria-hidden="true">
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const show = wallsToShow(making.cards, made.cards);

  if (!show.making && !show.made) {
    return (
      <div className={SECTION_GAP}>
        <div className="flex flex-col items-start gap-3 rounded-card border border-border bg-card p-5">
          <h3 className="text-title">{WALL_COPY.shareWhatYoureMaking}</h3>
          <PillButton onClick={onLogMoment}>{WALL_COPY.logAMoment}</PillButton>
          <button type="button" onClick={onDoWithPeople} className="min-h-11 text-small font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            Do this with people
          </button>
        </div>
        {chat && <div className={SECTION_GAP}>{chat}</div>}
      </div>
    );
  }

  const both = show.making && show.made;
  const bottomRow = (
    <div className={`${SECTION_GAP} grid items-start gap-6 ${chat && chains.length > 0 ? "desk:grid-cols-3" : ""}`}>
      {chat && <div className={chains.length > 0 ? "desk:col-span-2" : undefined}>{chat}</div>}
      <PassedAlong chains={chains} onYou={onMakeFromChain} card={!!chat} />
    </div>
  );
  const renderCards = (kind: WallKind, wall: Wall) => (
    <ul className={`grid gap-4 ${both ? "tab:grid-cols-2" : "tab:grid-cols-2 desk:grid-cols-4"}`}>
      {wall.cards.map((c) => (
        <WallCard key={`${kind}-${c.postId}`} card={c} kind={kind} yoursStarted={mineStarted.has(c.postId)} onOpen={() => onOpenMoment(c)} onMake={() => onMake(c)} />
      ))}
    </ul>
  );

  return (
    <div style={cornerStyle(corner.spaceSlug, corner.slug)}>
      {both && (
        <Segmented
          label="Walls"
          className="mb-4 desk:hidden"
          value={phoneWall}
          onChange={setPhoneWall}
          options={[
            { value: "making", label: WALL_COPY.stillMaking },
            { value: "made", label: WALL_COPY.madeIt },
          ]}
        />
      )}
      <div className={`${SECTION_GAP} grid gap-6 ${both ? "desk:grid-cols-2" : ""}`}>
        {show.making && (
          <Panel kind="making" wall={making} tint={tints.making} hidden={both && phoneWall !== "making"} onMore={() => void more("making")}>
            {renderCards("making", making)}
          </Panel>
        )}
        {show.made && (
          <Panel kind="made" wall={made} tint={tints.made} hidden={both && phoneWall !== "made"} onMore={() => void more("made")}>
            {renderCards("made", made)}
          </Panel>
        )}
      </div>
      {chat || chains.length > 0 ? (chat ? bottomRow : <PassedAlong chains={chains} onYou={onMakeFromChain} />) : null}
    </div>
  );
}

