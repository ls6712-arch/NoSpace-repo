import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight, LayoutList, Music, Plus, Volume2, VolumeX, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { POST_COLUMNS, rowToPost, useContent } from "../context/ContentContext";
import type { Post } from "../data/posts";
import type { CornerModel } from "../lib/cornerModel";
import { isInCorner } from "../lib/cornerAlias";
import { CHAT_COPY } from "../lib/cornerChat";
import { fetchPassedAlong, fetchWall, seedFromCard, sortAt, type Chain, type WallCard as Card, type WallKind } from "../lib/cornerWalls";
import { resolvePostMedia, signMomentPaths } from "../lib/momentMedia";
import { AvatarStack } from "../components/ui/AvatarStack";
import { Button } from "../components/ui/button";
import { PillButton } from "../components/ui/PillButton";
import { Skeleton } from "../components/ui/skeleton";
import { notify } from "../components/ui/toaster";
import { ErrorNotice } from "../components/StateViews";
import { MomentDetail } from "../components/moment/MomentDetail";
import { PursuitDialog } from "../components/PursuitDialog";
import { CornerChat } from "../components/corners/CornerChat";
import { PassedAlong, wallFaces } from "../components/corners/CornerWalls";
import { WALL_COPY, WallCard } from "../components/corners/WallCard";
import { wallLabels } from "../lib/cornerWallLabels";
import { planRoom, type RoomMoment, type Spot } from "../world/layout";
import { WORLD_COPY, readWorldPrefs, signLine, webglAvailable, writeWorldPrefs, type CornerWorldDef, type WorldPrefs } from "../world/cornerWorlds";
import type { Frame, World } from "../world/core/scene";

/**
 * A Corner as a room. For a Corner that has one, this is the Corner: it is what
 * opens at /corners/:slug for a member (CornerDetail decides). It shows the same
 * things as the list's Walls tab. Still making is the drying rack, Made it is the shelves, and the
 * viewer's own pieces sit on Your shelf. Every piece is a real Moment; the
 * potters and the cat are characters, always labelled so, and are never
 * counted or listed with people.
 *
 * Nothing here is new data. The walls come from corner_wall and
 * corner_passed_along, the chat is the Corner chat, and the dashed You? on a
 * chain opens the same sheet as on the Corner page. The room only draws them.
 *
 * The scene (three.js) is fetched when this page opens, as its own file. If
 * the browser cannot draw it, or the first frame takes too long, the person
 * gets the list with a short note.
 */

/** Longer than this to build and draw the first frame, and the device is not up to it. */
const FIRST_FRAME_LIMIT_MS = 4000;
/** One request's worth of wall cards, and how many requests a wall may take. */
const WALL_BATCH = 24;
const WALL_BATCHES = 5;
/** Cards a panel section shows before "Show more". */
const PANEL_PAGE = 8;
/** How often the walls are asked for again while the world is open. */
const REFRESH_MS = 30_000;
/** Width the side panel takes from the canvas on a desktop, px. */
const PANEL_INSET = 436;
const DESK = "(min-width: 1128px)";

const SPOTS: { spot: Spot; wall?: WallKind; section: string; dot: string }[] = [
  { spot: "rack", wall: "making", section: "world-making", dot: "bg-[var(--accent)]" },
  { spot: "shelf", wall: "made", section: "world-made", dot: "bg-[var(--success)]" },
  { spot: "yours", section: "world-yours", dot: "bg-foreground" },
];

interface WallData {
  cards: Card[];
  /** False when the wall has more cards than were fetched, so its count is not known. */
  complete: boolean;
}

async function fetchWholeWall(key: string, kind: WallKind): Promise<WallData> {
  const cards: Card[] = [];
  let before: number | undefined;
  for (let i = 0; i < WALL_BATCHES; i++) {
    const rows = await fetchWall(key, kind, { before, limit: WALL_BATCH });
    cards.push(...rows);
    if (rows.length < WALL_BATCH) return { cards, complete: true };
    before = sortAt(rows[rows.length - 1]);
  }
  return { cards, complete: false };
}

interface MyPiece {
  post: Post;
  finished: boolean;
}

/**
 * `onList` is the person choosing the list. `onUnavailable` is the room failing on this device: the caller
 * shows the list and does not try the room again by itself.
 */
export function CornerRoom({ corner, def, userId, onList, onUnavailable }: { corner: CornerModel; def: CornerWorldDef; userId: string; onList: () => void; onUnavailable: () => void }) {
  const navigate = useNavigate();
  const { publicFeed, myPosts } = useContent();
  const key = `${corner.spaceSlug}/${corner.slug}`;
  const wallNames = wallLabels(corner.spaceSlug, corner.slug);
  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  // The room is a dusk scene in every theme, so everything over it uses the dark tokens. They resolve on the
  // root element (theme.css), so the class goes there while the world is open and is put back on the way out.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const was = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      root.classList.toggle("dark", was);
    };
  }, []);

  const [prefs, setPrefs] = useState<WorldPrefs>(() => readWorldPrefs(userId));
  const updatePrefs = (patch: Partial<WorldPrefs>) =>
    setPrefs((p) => {
      const next = { ...p, ...patch };
      writeWorldPrefs(userId, next);
      return next;
    });

  // ── The walls ────────────────────────────────────────────────────────────
  const [making, setMaking] = useState<WallData | null>(null);
  const [made, setMade] = useState<WallData | null>(null);
  const [chains, setChains] = useState<Chain[]>([]);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [finishedPursuits, setFinishedPursuits] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([fetchWholeWall(key, "making"), fetchWholeWall(key, "made"), fetchPassedAlong(key, userId).catch(() => [] as Chain[])]);
    setMaking(a);
    setMade(b);
    setChains(c);
  }, [key, userId]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    load().catch(() => {
      if (!cancelled) setFailed(true);
    });
    // Ask again now and then, and when the person comes back to the tab, so a new Moment turns up without a reload.
    const again = () => {
      if (!document.hidden) load().catch(() => {});
    };
    const timer = window.setInterval(again, REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [load, attempt]);

  // The viewer's own Moments in this Corner, any audience, newest first, one per Pursuit.
  const mine = useMemo(() => {
    const seen = new Set<string>();
    return [...myPosts]
      .filter((p) => isInCorner(p, corner.spaceSlug, corner.slug))
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((p) => {
        const k = p.pursuitId ?? `moment-${p.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }, [myPosts, corner]);
  const minePursuitIds = useMemo(() => [...new Set(mine.map((p) => p.pursuitId).filter((x): x is string => !!x))], [mine]);
  useEffect(() => {
    if (!supabase || minePursuitIds.length === 0) return setFinishedPursuits(new Set());
    let cancelled = false;
    void (async () => {
      const { data } = await supabase!.from("pursuits").select("id, finished_at").in("id", minePursuitIds);
      if (!cancelled) setFinishedPursuits(new Set((data ?? []).filter((r) => r.finished_at).map((r) => r.id as string)));
    })();
    return () => {
      cancelled = true;
    };
  }, [minePursuitIds]);
  const myPieces = useMemo<MyPiece[]>(() => mine.map((post) => ({ post, finished: !!post.pursuitId && finishedPursuits.has(post.pursuitId) })), [mine, finishedPursuits]);

  const plan = useMemo(() => {
    const room = (c: Card): RoomMoment => ({ postId: c.postId, pursuitId: c.pursuitId, mine: c.mine, inspiredByPostId: c.inspiredByPostId });
    return planRoom({
      making: (making?.cards ?? []).map(room),
      made: (made?.cards ?? []).map(room),
      mine: myPieces.map(({ post, finished }) => ({ postId: Number(post.id), pursuitId: post.pursuitId, mine: true, finished })),
      chains: chains.map((c) => c.links.map((l) => l.pursuitId)),
    });
  }, [making, made, myPieces, chains]);

  // ── The scene ────────────────────────────────────────────────────────────
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const [ready, setReady] = useState(false);
  const [entered, setEntered] = useState(false);
  const [hover, setHover] = useState<Spot | null>(null);
  const [said, setSaid] = useState<Record<string, { text: string; show: boolean }>>({});
  const signRefs = useRef<Partial<Record<Spot, HTMLButtonElement | null>>>({});
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const hintRef = useRef<HTMLDivElement>(null);
  const sayTimers = useRef<Record<string, number>>({});
  const openWallRef = useRef<(spot: Spot) => void>(() => {});

  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;
  const leaveWithNote = useCallback(() => {
    notify(WORLD_COPY.cantOpen);
    unavailableRef.current();
  }, []);
  // Back goes where the person came from; opened from a link, to the list of Corners.
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/corners"));

  const say = useCallback((who: string, text: string) => {
    setSaid((s) => ({ ...s, [who]: { text, show: true } }));
    window.clearTimeout(sayTimers.current[who]);
    // The words stay while the bubble fades out.
    sayTimers.current[who] = window.setTimeout(() => setSaid((s) => ({ ...s, [who]: { text, show: false } })), 4500);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!webglAvailable()) return leaveWithNote();
    let cancelled = false;
    let world: World | null = null;
    // Puts an element at a point on the canvas. `ax` and `ay` say which part of the element sits on the point
    // (0 its left or top edge, 1 its right or bottom). With `keepIn`, it is nudged sideways to stay on screen.
    const place = (el: HTMLElement | null | undefined, p: { x: number; y: number; visible: boolean }, ax: number, ay: number, keepIn = false) => {
      if (!el) return;
      const w = el.offsetWidth;
      let x = p.x - w * ax;
      if (keepIn) x = Math.max(8, Math.min(stage.clientWidth - w - 8, x));
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(p.y - el.offsetHeight * ay)}px)`;
      el.style.visibility = p.visible ? "visible" : "hidden";
    };
    const onFrame = (f: Frame) => {
      for (const spot of ["rack", "shelf", "yours"] as const) place(signRefs.current[spot], f.signs[spot], 0.5, 0.5, true);
      for (const [name, p] of Object.entries(f.characters)) place(bubbleRefs.current[name], p, 0.1, 1, true);
      // The one-time hint hangs under the first sign.
      place(hintRef.current, { ...f.signs.rack, y: f.signs.rack.y + 34 }, 0.5, 0, true);
    };
    import("../world/core/scene")
      .then(({ createWorld }) => {
        if (cancelled) return;
        const initial = readWorldPrefs(userId);
        world = createWorld(stage, {
          config: def,
          small: Math.min(window.innerWidth, window.innerHeight) < 700,
          reducedMotion,
          labels: { rack: wallNames.making, shelf: wallNames.made, yours: WORLD_COPY.yourShelf },
          mood: initial.mood,
          sound: initial.sound,
          music: initial.music,
          onFrame,
          onSay: say,
          onOpen: (spot) => openWallRef.current(spot),
          onHover: setHover,
          onLost: leaveWithNote,
        });
        if (world.firstFrameMs > FIRST_FRAME_LIMIT_MS) {
          world.dispose();
          world = null;
          return leaveWithNote();
        }
        worldRef.current = world;
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) leaveWithNote();
      });
    // Nothing is drawn, and nothing plays, while the tab is hidden.
    const onVisibility = () => worldRef.current?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    const timers = sayTimers.current;
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      Object.values(timers).forEach((t) => window.clearTimeout(t));
      worldRef.current = null;
      world?.dispose();
    };
    // Built once per Corner: the settings it starts with are read inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reducedMotion]);

  useEffect(() => {
    if (ready) worldRef.current?.setPlan(plan);
  }, [ready, plan]);
  useEffect(() => {
    if (ready) worldRef.current?.setHover(hover);
  }, [ready, hover]);

  // ── The panel ────────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<"walls" | "chat">("walls");
  const [shown, setShown] = useState<Record<WallKind, number>>({ making: PANEL_PAGE, made: PANEL_PAGE });
  const [wide, setWide] = useState(() => window.matchMedia(DESK).matches);
  useEffect(() => {
    const mq = window.matchMedia(DESK);
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!ready) return;
    worldRef.current?.setInset(panelOpen && wide ? PANEL_INSET : 0);
    worldRef.current?.setThreadsBright(panelOpen && tab === "walls");
  }, [ready, panelOpen, wide, tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panelOpen && !document.querySelector("[role=dialog]")) setPanelOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const openWall = (spot: Spot) => {
    if (!prefs.hintSeen) updatePrefs({ hintSeen: true });
    setTab("walls");
    setPanelOpen(true);
    const id = SPOTS.find((s) => s.spot === spot)?.section;
    window.setTimeout(() => (id ? document.getElementById(id) : null)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" }), 80);
  };
  openWallRef.current = openWall;

  // ── Moments, starting from a chain, logging ──────────────────────────────────
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [seed, setSeed] = useState<Post | null>(null);
  const [makeOpen, setMakeOpen] = useState(false);
  async function openCard(card: Card) {
    const known = [...publicFeed, ...myPosts].find((p) => p.id === card.postId);
    if (known) return setOpenPost(known);
    if (!supabase) return;
    const { data } = await supabase.from("posts").select(POST_COLUMNS).eq("id", card.postId).maybeSingle();
    if (!data) return;
    const post = rowToPost(data, card.authorName);
    setOpenPost(resolvePostMedia(post, await signMomentPaths(post.mediaPaths ?? [])));
  }
  async function makeFromChain(chain: Chain) {
    const link = chain.links[chain.links.length - 1];
    let caption = "";
    if (supabase) {
      const { data } = await supabase.from("posts").select("caption").eq("id", chain.lastPostId).maybeSingle();
      caption = (data?.caption as string | null) ?? "";
    }
    setSeed(seedFromCard({ postId: chain.lastPostId, authorId: link.authorId, authorName: link.name, caption, postedAt: Date.now(), mine: false, mediaType: "written", finisherStub: false, startedBecause: [] }, corner));
    setMakeOpen(true);
  }
  const logMoment = () => navigate(`/create?hobby=${encodeURIComponent(corner.spaceSlug)}&sub=${encodeURIComponent(corner.slug)}`);

  // The hint waits a few seconds, so the room and the welcome are seen first.
  const [hintDue, setHintDue] = useState(false);
  useEffect(() => {
    if (!entered) return;
    const t = window.setTimeout(() => setHintDue(true), 6500);
    return () => window.clearTimeout(t);
  }, [entered]);
  const enter = () => {
    setEntered(true);
    worldRef.current?.enter();
    const welcome = worldRef.current?.welcome;
    if (welcome) window.setTimeout(() => say(welcome.who, welcome.text), 1800);
  };
  const toggleSound = () => {
    const on = !prefs.sound;
    updatePrefs({ sound: on });
    worldRef.current?.sound.setSound(on);
    // A tap is what lets a browser start sound, so this is the moment to start it.
    if (on && entered) worldRef.current?.sound.start();
  };
  const toggleMusic = () => {
    const on = !prefs.music;
    updatePrefs({ music: on });
    worldRef.current?.sound.setMusic(on);
  };
  const setMood = (mood: WorldPrefs["mood"]) => {
    updatePrefs({ mood });
    worldRef.current?.setMood(mood);
  };

  const counts: Record<Spot, { n: number; exact: boolean }> = {
    rack: { n: making?.cards.length ?? 0, exact: !!making?.complete },
    shelf: { n: made?.cards.length ?? 0, exact: !!made?.complete },
    yours: { n: myPieces.length, exact: true },
  };
  const labels: Record<Spot, string> = { rack: wallNames.making, shelf: wallNames.made, yours: WORLD_COPY.yourShelf };
  const faces: Record<Spot, ReturnType<typeof wallFaces>> = { rack: wallFaces(making?.cards ?? []), shelf: wallFaces(made?.cards ?? []), yours: [] };
  const loaded = making !== null && made !== null;
  const showHint = hintDue && loaded && !prefs.hintSeen;
  const chip = "inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card/70 px-4 text-small font-semibold text-foreground backdrop-blur-xl hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const wallSection = (kind: WallKind, data: WallData | null, section: string, line: string) => {
    if (!data || data.cards.length === 0) return null;
    const title = kind === "making" ? wallNames.making : wallNames.made;
    return (
      <section id={section} aria-labelledby={`${section}-title`} className="scroll-mt-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`${section}-title`} className="text-title">
              {title}
            </h3>
            <p className="text-small text-muted-foreground">{line}</p>
          </div>
          <AvatarStack people={wallFaces(data.cards)} size="size-8" />
        </div>
        <ul className="grid gap-2">
          {data.cards.slice(0, shown[kind]).map((c) => (
            <WallCard key={c.postId} card={c} kind={kind} corner={corner} onOpen={() => void openCard(c)} />
          ))}
        </ul>
        {data.cards.length > shown[kind] && (
          <div className="mt-4">
            <Button variant="outline" onClick={() => setShown((s) => ({ ...s, [kind]: s[kind] + PANEL_PAGE }))}>
              Show more
            </Button>
          </div>
        )}
      </section>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden bg-background text-foreground" data-corner-world={corner.slug}>
      <div ref={stageRef} role="img" aria-label={def.copy.stageLabel} className="absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_45%,transparent_55%,var(--scrim-solid)_100%)] opacity-50" />

      {/* Top bar: the way out, the time of day, sound, and the Walls panel. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-2 px-4 pt-[calc(var(--safe-top)+0.75rem)]">
        <div className="pointer-events-auto flex items-center gap-2">
          <button type="button" onClick={goBack} aria-label={WORLD_COPY.back} className={`${chip} px-3.5`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          {/* The same Corner as a list: the page every other Corner has. */}
          <button type="button" onClick={onList} className={chip}>
            <LayoutList className="size-4" aria-hidden="true" />
            {WORLD_COPY.list}
          </button>
        </div>
        {entered && (
          // On a phone the time of day takes its own row under the buttons, so nothing sits on top of anything.
          <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2 max-tab:contents">
            <div role="group" aria-label={WORLD_COPY.timeOfDay} className="flex gap-1 rounded-full max-tab:order-last max-tab:w-full max-tab:justify-between border border-border bg-card/70 p-1 backdrop-blur-xl">
              {(["morning", "golden", "night", "clock"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={prefs.mood === m}
                  onClick={() => setMood(m)}
                  className={`min-h-9 whitespace-nowrap rounded-full px-2 text-caption font-semibold tab:px-3 tab:text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${prefs.mood === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {WORLD_COPY.moods[m]}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={prefs.sound} onClick={toggleSound} className={`${chip} max-tab:ml-auto`}>
              {prefs.sound ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
              {prefs.sound ? WORLD_COPY.soundOn : WORLD_COPY.soundOff}
            </button>
            <button type="button" aria-pressed={prefs.music} onClick={toggleMusic} className={`${chip} max-tab:hidden`}>
              <Music className="size-4" aria-hidden="true" />
              {prefs.music ? WORLD_COPY.musicOn : WORLD_COPY.musicOff}
            </button>
            <button type="button" aria-expanded={panelOpen} aria-controls="world-panel" onClick={() => setPanelOpen((o) => !o)} className={chip}>
              {WALL_COPY.walls}
            </button>
          </div>
        )}
      </div>

      {/* Signs: what each part of the room is, with how many pieces are there. Each opens its wall in the panel. */}
      {entered &&
        loaded &&
        SPOTS.map(({ spot, dot }) => {
          const line = signLine(def, spot, counts[spot].n, counts[spot].exact);
          return (
            <button
              key={spot}
              type="button"
              ref={(el) => {
                signRefs.current[spot] = el;
              }}
              onClick={() => openWall(spot)}
              onMouseEnter={() => setHover(spot)}
              onMouseLeave={() => setHover(null)}
              aria-label={line ? `${labels[spot]}, ${line}` : labels[spot]}
              style={{ visibility: "hidden" }}
              className={`absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap rounded-full border border-border bg-card/70 py-2 pl-3 pr-2 text-left shadow-overlay backdrop-blur-xl will-change-transform hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${hover === spot ? "bg-card ring-2 ring-ring" : ""}`}
            >
              <span aria-hidden="true" className={`size-2.5 rounded-full ${dot} ${showHint && !reducedMotion ? "animate-pulse" : ""}`} />
              <span className="flex flex-col leading-tight">
                <span className="text-small font-semibold">{labels[spot]}</span>
                {line && <span className="text-caption text-muted-foreground">{line}</span>}
              </span>
              {faces[spot].length > 0 && <AvatarStack people={faces[spot]} size="size-6" />}
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </button>
          );
        })}
      {showHint && (
        <div ref={hintRef} role="status" style={{ visibility: "hidden" }} className="absolute left-0 top-0 z-20 flex w-64 flex-col items-start gap-2 rounded-card border border-border bg-card p-3 text-small text-foreground shadow-overlay">
          <span>{def.copy.hint}</span>
          <Button size="sm" onClick={() => updatePrefs({ hintSeen: true })}>
            {WORLD_COPY.gotIt}
          </Button>
        </div>
      )}

      {/* What a character says. Always tagged as a character. */}
      {Object.entries(said).map(([who, { text, show }]) => (
        <div
          key={who}
          ref={(el) => {
            bubbleRefs.current[who] = el;
          }}
          aria-hidden={!show}
          style={{ visibility: "hidden" }}
          className={`pointer-events-none absolute left-0 top-0 z-10 max-w-52 rounded-card border border-border bg-card px-3 py-2 text-small shadow-overlay transition-opacity duration-base will-change-transform ${show ? "opacity-100" : "opacity-0"}`}
        >
          <span className="mb-1 flex items-center gap-2 text-caption text-muted-foreground">
            {who}
            <span className="rounded-full border border-border px-2">{WORLD_COPY.character}</span>
          </span>
          {text}
        </div>
      ))}

      {entered && !(panelOpen && !wide) && (
        <div className={`pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+1rem)] flex justify-center transition-[padding] duration-base ${panelOpen && wide ? "pr-[436px]" : ""}`}>
          <PillButton className="pointer-events-auto" onClick={logMoment}>
            <Plus className="size-4" aria-hidden="true" />
            {WALL_COPY.logAMoment}
          </PillButton>
        </div>
      )}

      {/* The panel: the same walls as the Corner page, and the Corner chat. A side panel on a desktop, a sheet on a phone. */}
      {panelOpen && (
        <aside
          id="world-panel"
          aria-label={corner.name}
          className="absolute inset-x-0 bottom-0 flex h-[min(74dvh,640px)] flex-col overflow-hidden rounded-t-card border border-border bg-card/90 pb-[var(--safe-bottom)] backdrop-blur-xl desk:inset-x-auto desk:bottom-4 desk:right-4 desk:top-20 desk:h-auto desk:w-[404px] desk:rounded-card"
        >
          <div className="flex items-center justify-between gap-3 px-4 pt-3">
            <h2 className="text-title">{corner.name}</h2>
            <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close" className="inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div role="tablist" aria-label={corner.name} className="flex gap-1 px-3 pb-2">
            {(["walls", "chat"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`world-tab-${id}`}
                aria-selected={tab === id}
                aria-controls={`world-tabpanel-${id}`}
                onClick={() => setTab(id)}
                className={`min-h-11 rounded-full px-4 text-small font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${tab === id ? "bg-surface-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {id === "walls" ? WALL_COPY.walls : CHAT_COPY.tab}
              </button>
            ))}
          </div>
          {tab === "walls" && (
            <div role="tabpanel" id="world-tabpanel-walls" aria-labelledby="world-tab-walls" className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pb-6">
              <section id="world-yours" aria-labelledby="world-yours-title" className="scroll-mt-4 rounded-card border border-border p-4">
                <h3 id="world-yours-title" className="text-title">
                  {WORLD_COPY.yourShelf}
                </h3>
                {myPieces.length === 0 ? (
                  <div className="mt-2 flex flex-col items-start gap-3">
                    <p className="text-small text-muted-foreground">{def.copy.yoursEmpty}</p>
                    <PillButton onClick={logMoment}>{WALL_COPY.logAMoment}</PillButton>
                  </div>
                ) : (
                  <>
                    <p className="mb-3 text-small text-muted-foreground">{def.copy.yoursNote}</p>
                    <ul className="flex flex-col gap-2">
                      {myPieces.map(({ post, finished }) => (
                        <li key={post.id}>
                          <button type="button" onClick={() => setOpenPost(post)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-control border border-border px-3 py-2 text-left hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <span className="line-clamp-2 min-w-0 break-words text-small">{post.caption?.trim() || corner.name}</span>
                            <span className="shrink-0 text-caption font-semibold text-muted-foreground">{finished ? wallNames.made : wallNames.making}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
              {failed ? (
                <ErrorNotice onRetry={() => setAttempt((n) => n + 1)} />
              ) : !loaded ? (
                <Skeleton className="h-64 w-full rounded-card" />
              ) : (
                <>
                  {wallSection("making", making, "world-making", WALL_COPY.stillMakingLine)}
                  {wallSection("made", made, "world-made", WALL_COPY.madeItLine)}
                  <PassedAlong chains={chains} onYou={(c) => void makeFromChain(c)} card />
                </>
              )}
            </div>
          )}
          {tab === "chat" && (
            <div role="tabpanel" id="world-tabpanel-chat" aria-labelledby="world-tab-chat" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
              <CornerChat corner={corner} compact />
            </div>
          )}
        </aside>
      )}

      {/* The way in. Sound can only start from this tap. */}
      {!entered && (
        <div className="absolute inset-0 flex items-center justify-center bg-scrim-solid/60 px-4 backdrop-blur-sm">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <h1 className="text-display text-balance">{corner.name}</h1>
            <p className="text-lead text-balance text-muted-foreground">{def.copy.intro}</p>
            <PillButton onClick={enter} disabled={!ready}>
              {WORLD_COPY.enter}
            </PillButton>
            <span className="text-caption text-muted-foreground">{WORLD_COPY.entryHint}</span>
          </div>
        </div>
      )}

      <PursuitDialog
        open={makeOpen}
        onOpenChange={(o) => {
          setMakeOpen(o);
          if (!o) load().catch(() => {});
        }}
        seedPost={seed}
      />
      <MomentDetail post={openPost} owned={!!openPost && openPost.userId === userId} onOpenChange={(o) => !o && setOpenPost(null)} />
    </div>,
    document.body,
  );
}
