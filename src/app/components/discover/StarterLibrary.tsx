import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { ArrowUpRight, X } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { starterPursuitPath, type CornerResource, type StarterPursuit } from "../../lib/starterContent";
import { matchesStarter, publicStarterLibrary, readStarterBrowse, starterBrowseParams, starterCornerLabel, starterCover, starterPreviews, type StarterCollection } from "../../lib/starterLibrary";
import { restoreFocus } from "../../lib/returnFocus";

const actionClass = "inline-flex min-h-11 shrink-0 items-center text-small font-semibold text-accent-text underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring";
const fieldClass = "min-h-12 min-w-0 rounded-control border border-input bg-card px-3 text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";
// Public view state only, bounded and confined to this tab. Returning from the
// creation form restores the same collection entry without storing account data.
const collectionScrolls = new Map<string, number>();

function ResourceCard({ item, corner }: { item: CornerResource; corner?: string }) {
  return <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit website: ${item.name}`} className="block rounded-card border border-border bg-card p-4 outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring">
    <div className="flex items-start justify-between gap-3">
      <h3 className="min-w-0 text-body font-semibold">{item.name}</h3>
      <span className="shrink-0 rounded-full bg-surface-muted px-2 py-1 text-caption text-muted-foreground">{starterCornerLabel(corner || item.corner_keys[0])}</span>
    </div>
    <p className="mt-2 text-small text-muted-foreground">{item.description}</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="min-w-0 break-all text-caption text-muted-foreground">{new URL(item.url).hostname.replace(/^www\./, "")}</span>
      <span className="inline-flex min-h-11 items-center gap-1 text-small font-semibold text-accent-text">Visit website<ArrowUpRight className="size-4" aria-hidden="true"/></span>
    </div>
  </a>;
}

function PursuitCard({ item, restricted }: { item: StarterPursuit; restricted: boolean }) {
  const cover = starterCover(item.corner_key);
  const [loaded, setLoaded] = useState(false);
  const [spaceSlug, slug] = item.corner_key.split("/");
  const path = starterPursuitPath(item);
  const to = restricted ? `/login?${new URLSearchParams({ redirect: path })}` : path;
  return <article className="rounded-card border border-border bg-card p-4">
    <div className="flex items-start gap-3">
      {cover ? <ImageWithFallback src={`${import.meta.env.BASE_URL}${cover.default_path}`} srcSet={cover.variants.map(v => `${import.meta.env.BASE_URL}${v.path} ${v.width}w`).join(", ")} sizes="72px" alt={cover.alt} className="h-20 w-[72px] shrink-0 rounded-control" onLoad={() => setLoaded(true)} onFail={() => setLoaded(false)}/> : <SuggestionPhoto corner={{ spaceSlug, slug }} width={72} className="h-20 w-[72px] shrink-0 rounded-control"/>}
      <div className="min-w-0"><span className="inline-block rounded-full bg-surface-muted px-2 py-1 text-caption text-muted-foreground">{starterCornerLabel(item.corner_key)}</span><h3 className="mt-2 text-body font-semibold">{item.title}</h3></div>
    </div>
    <p className="mt-3 text-small text-muted-foreground">{item.description}</p>
    <ol className="mt-3 list-decimal space-y-1 pl-5 text-small">{item.milestones.map(step => <li key={step.title}>{step.title}</li>)}</ol>
    <Link to={to} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-small font-semibold text-background outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card">Start a Pursuit<ArrowUpRight className="size-4" aria-hidden="true"/></Link>
    {cover && <p className={`mt-2 text-caption text-muted-foreground${loaded ? "" : " invisible"}`}>Photo: {cover.credit}</p>}
  </article>;
}

/** Public previews, independent of account reads and the Corner carousel's results. */
export function StarterLibrary({ restricted }: { restricted: boolean }) {
  const library = useMemo(publicStarterLibrary, []);
  const previews = useMemo(() => starterPreviews(library), [library]);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { kind, query, corner } = readStarterBrowse(params, library);
  const opener = useRef<HTMLAnchorElement | null>(null);
  const fallbackOpener = useRef<StarterCollection | null>(null);
  if (kind) fallbackOpener.current = kind;
  const displayKind = kind ?? fallbackOpener.current ?? "resources";
  const restoreCollectionScroll = useCallback((node: HTMLDivElement | null) => {
    if (node && kind) node.scrollTop = collectionScrolls.get(location.key) ?? 0;
  }, [location.key, kind]);
  const resources = library.resources.filter(item => matchesStarter(item, query, corner));
  const pursuits = library.pursuits.filter(item => matchesStarter(item, query, corner));
  const empty = displayKind === "resources" ? resources.length === 0 : pursuits.length === 0;

  const close = () => {
    if (location.state?.discoverCollectionEntry) navigate(-1);
    else setParams(starterBrowseParams(params, null), { replace: true, preventScrollReset: true, state: location.state });
  };
  // The params as of the last change, until a render catches up. setSearchParams(fn) hands fn the params of the
  // last render, so two changes in quick succession (clear the search, then pick a Corner) made the second one start
  // from stale params and write the cleared search back into the URL.
  const pendingParams = useRef<URLSearchParams | null>(null);
  useEffect(() => { pendingParams.current = null; }, [params]);
  const change = (key: "browseQuery" | "browseCorner", value: string) => {
    const next = new URLSearchParams(pendingParams.current ?? params);
    if (value) next.set(key, value); else next.delete(key);
    pendingParams.current = next;
    setParams(next, { replace: true, preventScrollReset: true, state: location.state });
  };
  const browse = (collection: StarterCollection, label: string) => <Link
    id={`browse-${collection}`}
    to={`?${starterBrowseParams(params, collection)}`}
    state={{ ...location.state, discoverCollectionEntry: true }}
    preventScrollReset
    onClick={(event: MouseEvent<HTMLAnchorElement>) => { opener.current = event.currentTarget; }}
    className={actionClass}
  >{label}</Link>;

  return <>
    <div className="grid gap-8 tab:grid-cols-2" data-discover-starter-previews>
      {previews.resources.length > 0 && <section id="discover-resources" aria-labelledby="discover-resources-title" className="min-w-0 scroll-mt-24">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 id="discover-resources-title" className="text-lead">Resources</h2><p className="text-small text-muted-foreground">Browse art, find a book, or try a lesson.</p></div>
          {browse("resources", "See all resources")}
        </div>
        <div className="grid gap-3">{previews.resources.map((item, i) => <div key={item.id} className={i >= 2 ? "hidden tab:block" : ""}><ResourceCard item={item}/></div>)}</div>
      </section>}
      {previews.pursuits.length > 0 && <section id="discover-pursuit-ideas" aria-labelledby="discover-pursuit-ideas-title" className="min-w-0 scroll-mt-24">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0"><h2 id="discover-pursuit-ideas-title" className="text-lead">Pursuit ideas</h2><p className="text-small text-muted-foreground">Pick a goal. Make the steps your own.</p></div>
          {browse("pursuits", "See all ideas")}
        </div>
        <div className="grid gap-3">{previews.pursuits.map((item, i) => <div key={item.id} className={i >= 1 ? "hidden tab:block" : ""}><PursuitCard item={item} restricted={restricted}/></div>)}</div>
      </section>}
    </div>
    <Dialog open={kind !== null} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent showCloseButton={false}
        className="inset-x-0 bottom-0 top-auto left-0 flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-b-none p-0 tab:inset-x-auto tab:bottom-auto tab:left-1/2 tab:top-1/2 tab:w-[calc(100%-3rem)] tab:max-w-4xl tab:-translate-x-1/2 tab:-translate-y-1/2 tab:rounded-card"
        onOpenAutoFocus={event => { event.preventDefault(); document.querySelector<HTMLElement>("[data-starter-collection-title]")?.focus({ preventScroll: true }); }}
        onCloseAutoFocus={event => {
          event.preventDefault();
          if (!restoreFocus(opener.current)) restoreFocus(document.getElementById(`browse-${fallbackOpener.current}`));
        }}>
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 tab:px-6">
          <div className="min-w-0"><DialogTitle data-starter-collection-title tabIndex={-1} className="text-title outline-none">{displayKind === "resources" ? "Resources" : "Pursuit ideas"}</DialogTitle><DialogDescription className="mt-1">Choose a Corner if you want to narrow it down.</DialogDescription></div>
          <DialogClose aria-label="Close collection" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-input outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="size-5" aria-hidden="true"/></DialogClose>
        </div>
        <div ref={restoreCollectionScroll} onScroll={event => {
          if (!kind) return;
          collectionScrolls.set(location.key, event.currentTarget.scrollTop);
          if (collectionScrolls.size > 50) collectionScrolls.delete(collectionScrolls.keys().next().value!);
        }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 pb-[max(1rem,var(--safe-bottom,0px))] tab:px-6" data-starter-collection-scroll>
          <div className="mb-5 grid gap-3 tab:grid-cols-2">
            <label className="grid gap-2 text-small font-semibold">{displayKind === "resources" ? "Search resources" : "Search Pursuit ideas"}<input type="search" value={query} maxLength={160} onChange={event => change("browseQuery", event.target.value)} placeholder="Search by name or interest" className={fieldClass}/></label>
            <label className="grid gap-2 text-small font-semibold">Corner<select value={corner} onChange={event => change("browseCorner", event.target.value)} className={fieldClass}><option value="">All Corners</option>{library.corners.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
          </div>
          {(query || corner) && <button type="button" className={`${actionClass} mb-3`} onClick={() => setParams(starterBrowseParams(params, kind), { replace: true, preventScrollReset: true, state: location.state })}>Clear filters</button>}
          {empty ? <p role="status" className="rounded-card border border-border bg-surface-muted p-4 text-small">No matches. Try another word or Corner.</p> : <div className="grid items-start gap-3 tab:grid-cols-2" data-starter-collection-results>
            {displayKind === "resources" ? resources.map(item => <ResourceCard key={item.id} item={item} corner={corner}/>) : pursuits.map(item => <PursuitCard key={item.id} item={item} restricted={restricted}/>)}
          </div>}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
