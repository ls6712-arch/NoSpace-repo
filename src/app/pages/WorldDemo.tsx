import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { PageShell } from "../components/layout/PageShell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { plural } from "../lib/plural";
import {
  EMPTY_WORLD,
  TRAIL_LENGTH,
  addThings,
  bringHome,
  broughtHomeOn,
  currentStop,
  emptyBag,
  initials,
  loadWorld,
  packBag,
  saveWorld,
  stopsFor,
  trailFinished,
  uncovered,
  type Coat,
  type Keepsake,
  type Pet,
  type PetKind,
  type Thing,
  type WorldState,
} from "../world/demo/worldDemoStore";

/**
 * The world demo, on staging only (see worldDemoEnabled in config.ts).
 * Say what you want to do, pack a bag, go and do it, unpack, and a keepsake
 * lands on a shelf. It keeps everything in this browser and never calls the
 * database, so it is safe to play with next to real accounts.
 */

type View = "home" | "pack" | "unpack" | "shelf";

const COATS: { id: Coat; label: string; color: string }[] = [
  { id: "yellow", label: "Golden", color: "var(--yellow)" },
  { id: "peach", label: "Peach", color: "var(--peach)" },
  { id: "sage", label: "Sage", color: "var(--pastel-sage)" },
  { id: "stone", label: "Grey", color: "var(--pastel-stone)" },
];
const KINDS: { id: PetKind; label: string }[] = [
  { id: "dog", label: "Dog" },
  { id: "cat", label: "Cat" },
  { id: "rabbit", label: "Rabbit" },
];
const WHENS = ["Tonight", "Tomorrow", "This weekend"];
const FORM_LINES = ["Your first one. It's yours for good.", "Look closer. This one's changed.", "Ten of these. It's grown again.", "Twenty five. This is its last form."];

function today(): string {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Shrinks a picture to a small JPEG so a shelf of them fits in the browser. */
function shrink(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 480 / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function WorldDemo() {
  const [world, setWorld] = useState<WorldState>(() => loadWorld(storage()));
  const [view, setView] = useState<View>("home");
  const [unpacking, setUnpacking] = useState<string>("");
  const [justHome, setJustHome] = useState<Keepsake | null>(null);

  const update = (next: WorldState) => setWorld(saveWorld(storage(), next));
  const day = today();
  const litToday = broughtHomeOn(world, day);
  const bagThing = world.bag ? world.things.find((t) => t.id === world.bag?.thingId) ?? null : null;

  if (!world.pet) return <Shell><PetSetup onDone={(pet) => update({ ...world, pet })} /></Shell>;

  return (
    <Shell>
      {view === "home" && (
        <Home
          world={world}
          pet={world.pet}
          litToday={litToday}
          bagThing={bagThing}
          justHome={justHome}
          onSay={(said) => update(addThings(world, said))}
          onPack={() => setView("pack")}
          onUnpack={(thing) => {
            setUnpacking(thing);
            setJustHome(null);
            setView("unpack");
          }}
          onEmptyBag={() => update(emptyBag(world))}
          onShelf={() => setView("shelf")}
        />
      )}
      {view === "pack" && (
        <Pack
          things={world.things.filter((t) => !trailFinished(t))}
          onBack={() => setView("home")}
          onPack={(thingId, when, withName) => {
            update(packBag(world, thingId, when, withName));
            setView("home");
          }}
        />
      )}
      {view === "unpack" && (
        <Unpack
          thing={unpacking}
          withName={bagThing && bagThing.name === unpacking ? world.bag?.withName ?? "" : ""}
          onBack={() => setView("home")}
          onBring={(detail, photo, withName) => {
            const { state, keepsake } = bringHome(world, { thing: unpacking, detail, photo, withName, day });
            update(state);
            setJustHome(keepsake);
            setView("home");
          }}
        />
      )}
      {view === "shelf" && (
        <Shelf
          world={world}
          pet={world.pet}
          onBack={() => setView("home")}
          onStartOver={() => {
            update(EMPTY_WORLD);
            setJustHome(null);
            setView("home");
          }}
        />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <PageShell title="The world" subtitle="A demo. Everything here stays in this browser.">
      <div className="flex w-full max-w-md flex-col gap-6 pb-20">{children}</div>
    </PageShell>
  );
}

function PetSetup({ onDone }: { onDone: (pet: Pet) => void }) {
  const [kind, setKind] = useState<PetKind>("dog");
  const [coat, setCoat] = useState<Coat>("yellow");
  const [name, setName] = useState("");
  const pet: Pet = { kind, coat, name: name.trim() || "Mochi" };
  return (
    <>
      <Scene lit={0} pet={pet} places={[]} />
      <div className="flex flex-col gap-2">
        <h1 className="text-title font-bold text-foreground">Who's coming with you?</h1>
        <p className="text-body text-muted-foreground">Pick a pet. It walks every trail with you and carries what you bring home.</p>
      </div>
      <Choice label="Kind">
        {KINDS.map((k) => (
          <Pick key={k.id} on={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</Pick>
        ))}
      </Choice>
      <Choice label="Coat">
        {COATS.map((c) => (
          <Pick key={c.id} on={coat === c.id} onClick={() => setCoat(c.id)}>
            <span aria-hidden="true" className="size-3 rounded-full border border-foreground" style={{ background: c.color }} />
            {c.label}
          </Pick>
        ))}
      </Choice>
      <label className="flex flex-col gap-2 text-small font-semibold text-foreground">
        Name
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mochi" maxLength={20} />
      </label>
      <Button size="lg" onClick={() => onDone(pet)}>This is them</Button>
    </>
  );
}

function Home(props: {
  world: WorldState;
  pet: Pet;
  litToday: number;
  bagThing: Thing | null;
  justHome: Keepsake | null;
  onSay: (said: string) => void;
  onPack: () => void;
  onUnpack: (thing: string) => void;
  onEmptyBag: () => void;
  onShelf: () => void;
}) {
  const { world, pet, litToday, bagThing, justHome } = props;
  const [said, setSaid] = useState("");
  const [did, setDid] = useState("");
  const open = world.things.filter((t) => !trailFinished(t));
  const places = useMemo(() => uncovered(world), [world]);

  const say = (e: FormEvent) => {
    e.preventDefault();
    if (said.trim()) props.onSay(said);
    setSaid("");
  };
  const didIt = (e: FormEvent) => {
    e.preventDefault();
    if (did.trim()) props.onUnpack(did.trim());
    setDid("");
  };

  return (
    <>
      <Scene lit={litToday} pet={pet} places={places} bag={!!world.bag} />

      {justHome ? (
        <Card>
          <KeepsakeArt keepsake={justHome} />
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-bold text-foreground">{FORM_LINES[justHome.form]}</h1>
            <p className="text-body text-muted-foreground">
              {justHome.withName ? `Half's with you. Half's with ${justHome.withName}.` : `${pet.name} carried it home.`}
            </p>
          </div>
          <Button size="lg" onClick={props.onShelf}>See it on your Shelf</Button>
        </Card>
      ) : world.bag && bagThing ? (
        <Card>
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-bold text-foreground">Bag's by the door.</h1>
            <p className="text-body text-muted-foreground">
              {currentStop(bagThing)}. {world.bag.when}{world.bag.withName ? `, with ${world.bag.withName}` : ""}.
            </p>
          </div>
          <Button size="lg" onClick={() => props.onUnpack(bagThing.name)}>Unpack</Button>
          <Button variant="link" onClick={props.onEmptyBag}>Not tonight</Button>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col gap-1">
            <h1 className="text-title font-bold text-foreground">
              {open.length ? "Pack a bag. Go do it. Bring something home." : "What do you want to do?"}
            </h1>
            <p className="text-body text-muted-foreground">
              {open.length ? `${pet.name} is waiting by the door.` : "Anything at all. Say a few and each one becomes a trail."}
            </p>
          </div>
          {open.length > 0 && <Button size="lg" onClick={props.onPack}>Pack a bag</Button>}
        </Card>
      )}

      <form onSubmit={say} className="flex flex-col gap-2">
        <label htmlFor="world-say" className="text-small font-semibold text-foreground">Say what you want to do</label>
        <div className="flex gap-2">
          <Input id="world-say" value={said} onChange={(e) => setSaid(e.target.value)} placeholder="Learn chess, bake bread and walk more" />
          <Button type="submit" variant="outline">Add</Button>
        </div>
      </form>

      {open.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lead font-bold text-foreground">To try</h2>
          {open.map((t) => (
            <Trail key={t.id} thing={t} />
          ))}
        </section>
      )}

      <form onSubmit={didIt} className="flex flex-col gap-2">
        <label htmlFor="world-did" className="text-small font-semibold text-foreground">Did something today without planning it?</label>
        <div className="flex gap-2">
          <Input id="world-did" value={did} onChange={(e) => setDid(e.target.value)} placeholder="Went for a long walk" />
          <Button type="submit" variant="outline">I did this</Button>
        </div>
      </form>

      <Button variant="outline" size="lg" onClick={props.onShelf}>
        Your Shelf: {plural(world.keepsakes.length, "keepsake")}
      </Button>
    </>
  );
}

function Trail({ thing }: { thing: Thing }) {
  const stops = stopsFor(thing.name);
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card p-4">
      <div className="text-body font-semibold text-foreground">{thing.name}</div>
      <ol className="flex items-center gap-1" aria-label={`Trail for ${thing.name}`}>
        {stops.map((stop, i) => {
          const done = i < thing.stopsDone;
          const here = i === thing.stopsDone;
          return (
            <li key={stop} className="flex flex-1 items-center gap-1">
              <span
                aria-label={done ? `Stop ${i + 1}, done` : here ? `Stop ${i + 1}, you are here` : `Stop ${i + 1}, hidden`}
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-caption font-bold ${
                  done ? "border-foreground bg-accent text-accent-foreground" : here ? "border-foreground bg-card text-foreground" : "border-dashed border-border text-muted-foreground"
                }`}
              >
                {done ? "✓" : here ? i + 1 : "?"}
              </span>
              {i < TRAIL_LENGTH - 1 && <span aria-hidden="true" className={`h-px flex-1 ${done ? "bg-foreground" : "bg-border"}`} />}
            </li>
          );
        })}
      </ol>
      <p className="text-small text-muted-foreground">Next: {currentStop(thing)}. The stop after stays hidden until you get there.</p>
    </div>
  );
}

function Pack({ things, onBack, onPack }: { things: Thing[]; onBack: () => void; onPack: (thingId: string, when: string, withName: string) => void }) {
  const [thingId, setThingId] = useState(things[0]?.id ?? "");
  const [when, setWhen] = useState(WHENS[0]);
  const [withName, setWithName] = useState("");
  const picked = things.find((t) => t.id === thingId);
  return (
    <>
      <Back onBack={onBack} />
      <h1 className="text-title font-bold text-foreground">Pack one thing</h1>
      <Choice label="Which one">
        {things.map((t) => (
          <Pick key={t.id} on={thingId === t.id} onClick={() => setThingId(t.id)}>{t.name}</Pick>
        ))}
      </Choice>
      {picked && <p className="text-body text-muted-foreground">The stop you'll pack: {currentStop(picked)}.</p>}
      <Choice label="When">
        {WHENS.map((w) => (
          <Pick key={w} on={when === w} onClick={() => setWhen(w)}>{w}</Pick>
        ))}
      </Choice>
      <label className="flex flex-col gap-2 text-small font-semibold text-foreground">
        Come along? Name a friend, or leave it empty
        <Input value={withName} onChange={(e) => setWithName(e.target.value)} placeholder="Priya" maxLength={30} />
      </label>
      <Button size="lg" disabled={!picked} onClick={() => picked && onPack(picked.id, when, withName)}>Pack it</Button>
    </>
  );
}

function Unpack(props: { thing: string; withName: string; onBack: () => void; onBring: (detail: string, photo: string | null, withName: string) => void }) {
  const [detail, setDetail] = useState("");
  const [withName, setWithName] = useState(props.withName);
  const [photo, setPhoto] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0];
    if (!chosen) return;
    const small = await shrink(chosen);
    if (alive.current) setPhoto(small);
  };

  return (
    <>
      <Back onBack={props.onBack} />
      <div className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-foreground">You're back. What did you bring?</h1>
        <p className="text-body text-muted-foreground">{props.thing}</p>
      </div>
      <div className="flex flex-col gap-2">
        {photo ? (
          <ImageWithFallback src={photo} alt="Your picture" className="aspect-[4/3] w-full rounded-card object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center rounded-card border border-dashed border-border bg-card text-small text-muted-foreground">
            No picture yet
          </div>
        )}
        <input ref={file} type="file" accept="image/*" className="sr-only" onChange={pick} aria-label="Add a picture" />
        <Button variant="outline" onClick={() => file.current?.click()}>{photo ? "Choose another picture" : "Add a picture"}</Button>
      </div>
      <label className="flex flex-col gap-2 text-small font-semibold text-foreground">
        One thing about it
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Collapsed twice. Third one stood." maxLength={80} />
      </label>
      <label className="flex flex-col gap-2 text-small font-semibold text-foreground">
        Who was there? Leave it empty if it was just you
        <Input value={withName} onChange={(e) => setWithName(e.target.value)} placeholder="Priya" maxLength={30} />
      </label>
      <Button size="lg" onClick={() => props.onBring(detail, photo, withName)}>Bring it home</Button>
    </>
  );
}

function Shelf({ world, pet, onBack, onStartOver }: { world: WorldState; pet: Pet; onBack: () => void; onStartOver: () => void }) {
  const [turned, setTurned] = useState<string | null>(null);
  const finished = world.things.filter(trailFinished);
  return (
    <>
      <Back onBack={onBack} />
      <div className="flex items-center gap-3">
        <div className="size-16 shrink-0"><PetArt pet={pet} /></div>
        <div>
          <h1 className="text-title font-bold text-foreground">You and {pet.name}</h1>
          <p className="text-small text-muted-foreground">{plural(world.keepsakes.length, "keepsake")} brought home</p>
        </div>
      </div>

      {finished.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lead font-bold text-foreground">Finished</h2>
          {finished.map((t) => (
            <div key={t.id} className="rounded-card border border-foreground bg-card p-4 text-body font-semibold text-foreground">
              {t.name}: you walked the whole thing.
            </div>
          ))}
        </section>
      )}

      {world.keepsakes.length === 0 ? (
        <p className="text-body text-muted-foreground">Nothing here yet. That changes tonight.</p>
      ) : (
        <div className="grid grid-cols-3 overflow-hidden rounded-card">
          {world.keepsakes.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setTurned(turned === k.id ? null : k.id)}
              aria-label={turned === k.id ? `Show the picture for ${k.thing}` : `Show the keepsake for ${k.thing}`}
              className="aspect-square bg-card"
            >
              {k.photo && turned !== k.id ? <ImageWithFallback src={k.photo} alt="" className="size-full object-cover" /> : <KeepsakeArt keepsake={k} tile />}
            </button>
          ))}
        </div>
      )}
      {world.keepsakes.length > 0 && <p className="text-small text-muted-foreground">Tap a picture to turn it over and see its keepsake.</p>}

      <Button variant="link" onClick={onStartOver}>Start the demo over</Button>
    </>
  );
}

/** A keepsake: a tag that grows a ring each time its form changes, in two halves when it was done with someone. */
function KeepsakeArt({ keepsake, tile = false }: { keepsake: Keepsake; tile?: boolean }) {
  const joined = !!keepsake.withName;
  const rings = keepsake.form + 1;
  return (
    <div className={tile ? "flex size-full items-stretch p-2" : "flex h-40 w-full items-stretch"} style={{ background: "var(--surface-muted)" }}>
      <div className={`relative flex flex-1 flex-col items-center justify-center gap-1 border border-foreground bg-card p-2 ${joined ? "rounded-l-control border-r-0" : "rounded-control"}`}>
        <span className="relative flex items-center justify-center">
          {Array.from({ length: rings }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute rounded-full border border-foreground"
              style={{ width: `${1.25 + i * 0.6}rem`, height: `${1.25 + i * 0.6}rem`, background: i === 0 ? "var(--accent)" : "transparent" }}
            />
          ))}
          <span className="invisible size-12" />
        </span>
        <span className="line-clamp-2 text-center text-caption font-semibold text-foreground">{keepsake.detail || keepsake.thing}</span>
      </div>
      {joined && (
        <div className="flex w-1/3 flex-col items-center justify-center gap-1 rounded-r-control border border-dashed border-foreground p-1" style={{ background: "var(--peach)" }}>
          <span className="text-small font-bold" style={{ color: "var(--ink)" }}>{initials(keepsake.withName)}</span>
          <span className="text-caption" style={{ color: "var(--ink)" }}>their half</span>
        </div>
      )}
    </div>
  );
}

/** The town at dusk. Each thing done lights a window; anything brought home today lights the lamp. */
function Scene({ lit, pet, places, bag = false }: { lit: number; pet: Pet; places: string[]; bag?: boolean }) {
  const houses = [0, 1, 2, 3, 4, 5];
  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative overflow-hidden rounded-card"
        style={{ aspectRatio: "16 / 11", background: "linear-gradient(to bottom, var(--gen-art-night) 0%, var(--plum) 55%, var(--peach) 100%)" }}
        role="img"
        aria-label={`The town at dusk. ${lit > 0 ? "The lamp is lit." : "The lamp is not lit yet."} ${pet.name} is by the door.`}
      >
        <div className="absolute inset-x-0 flex items-end justify-around px-3" style={{ bottom: "22%" }}>
          {houses.map((i) => (
            <div key={i} className="flex flex-col items-center justify-end" style={{ width: "13%", height: `${2.6 + ((i * 7) % 4) * 0.7}rem`, background: "var(--gen-art-night)" }}>
              <span
                className="mb-2 block size-2"
                style={{ background: i < places.length ? "var(--yellow)" : "var(--gen-art-denim)", opacity: i < places.length ? 1 : 0.5 }}
              />
            </div>
          ))}
        </div>
        <div className="absolute" style={{ left: "8%", bottom: "22%", width: "0.2rem", height: "42%", background: "var(--gen-art-night)" }} />
        <div
          className="absolute rounded-full"
          style={{
            left: "calc(8% - 0.65rem)",
            bottom: "62%",
            width: "1.5rem",
            height: "1.5rem",
            background: lit > 0 ? "var(--yellow)" : "var(--gen-art-denim)",
            boxShadow: lit > 0 ? "0 0 2.5rem 1rem color-mix(in srgb, var(--yellow) 55%, transparent)" : "none",
          }}
        />
        <div className="absolute inset-x-0 bottom-0" style={{ height: "22%", background: "var(--gen-art-night)" }} />
        <div className="absolute flex items-end gap-1" style={{ right: "12%", bottom: "14%", width: "30%" }}>
          <PetArt pet={pet} />
          {bag && (
            <svg viewBox="0 0 24 28" aria-hidden="true" className="w-1/4">
              <path d="M7 10q5-11 10 0" fill="none" style={{ stroke: "var(--gen-art-cream)" }} strokeWidth="2.5" strokeLinecap="round" />
              <rect x="3" y="10" width="18" height="16" rx="4" style={{ fill: "var(--gen-art-cream)" }} />
            </svg>
          )}
        </div>
      </div>
      {places.length > 0 && (
        <p className="text-small text-muted-foreground">
          Uncovered so far: {places.join(", ")}. {lit > 0 ? "You lit the lamp tonight." : "The lamp is waiting."}
        </p>
      )}
    </div>
  );
}

function PetArt({ pet }: { pet: Pet }) {
  const coat = COATS.find((c) => c.id === pet.coat)?.color ?? "var(--yellow)";
  const ink = { fill: "var(--gen-art-ink)" };
  const body = { fill: coat, stroke: "var(--gen-art-ink)", strokeWidth: 3 };
  return (
    <svg viewBox="0 0 100 80" role="img" aria-label={pet.name} className="w-full">
      <path d="M16 46q-10-6-7-18" fill="none" style={{ stroke: "var(--gen-art-ink)" }} strokeWidth="3" strokeLinecap="round" />
      <rect x="22" y="58" width="8" height="18" rx="4" style={body} />
      <rect x="52" y="58" width="8" height="18" rx="4" style={body} />
      <rect x="14" y="38" width="56" height="30" rx="15" style={body} />
      <circle cx="74" cy="32" r="16" style={body} />
      {pet.kind === "dog" && <ellipse cx="63" cy="27" rx="5" ry="10" transform="rotate(18 63 27)" style={ink} />}
      {pet.kind === "cat" && (
        <>
          <path d="M62 22l2-14 10 9z" style={body} />
          <path d="M78 17l10-9 0 15z" style={body} />
        </>
      )}
      {pet.kind === "rabbit" && (
        <>
          <ellipse cx="68" cy="8" rx="4" ry="12" style={body} />
          <ellipse cx="80" cy="8" rx="4" ry="12" style={body} />
        </>
      )}
      <circle cx="78" cy="30" r="2.2" style={ink} />
      <circle cx="88" cy="36" r="2.8" style={ink} />
    </svg>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-card border border-border bg-card p-4">{children}</div>;
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-small font-semibold text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Pick({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`flex min-h-11 items-center gap-2 rounded-control border px-3 text-small font-semibold text-foreground ${on ? "border-foreground bg-accent/15" : "border-border bg-card"}`}
    >
      {children}
    </button>
  );
}

function Back({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="link" className="self-start px-0" onClick={onBack}>
      Back
    </Button>
  );
}
