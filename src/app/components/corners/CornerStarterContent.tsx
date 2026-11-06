import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { ImageWithFallback } from "../ImageWithFallback";
import { SuggestionPhoto } from "../home/SuggestionPhoto";
import { formatDuration } from "../../lib/dates";
import { SECTION_GAP } from "../../lib/pageGrid";
import { starterContentFor, starterPursuitPath, type StarterActivity } from "../../lib/starterContent";

function Activity({ item }: { item: StarterActivity }) {
  const needs = item.requirements;
  return <article className="rounded-card border border-border bg-card p-4">
    <details>
      <summary className="flex min-h-11 cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span><span className="block font-semibold">{item.title}</span><span className="mt-1 block text-small text-muted-foreground">About {formatDuration(item.duration.min_minutes)} to {formatDuration(item.duration.max_minutes)}</span></span>
        <ChevronDown className="mt-1 size-5 shrink-0" aria-hidden="true"/>
      </summary>
      <p className="mt-4 text-small text-muted-foreground">{item.summary}</p>
      <p className="mt-3 text-small text-muted-foreground">{item.settings.map(setting => setting === "home" ? "At home" : "Outside").join(" · ")}</p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-small">{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
      {needs.required.length > 0 && <div className="mt-4"><h3 className="text-small font-semibold">What you’ll need</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-small">{needs.required.map(item => <li key={item}>{item}</li>)}</ul></div>}
      {needs.choose_one_groups.map(group => <div className="mt-4" key={group.id}><h3 className="text-small font-semibold">{group.label}</h3><ul className="mt-2 list-disc space-y-2 pl-5 text-small">{group.options.map(option => <li key={option.label}><span className="font-medium">{option.label}: </span>{option.required_items.join(", ")}</li>)}</ul></div>)}
      {needs.optional.length > 0 && <p className="mt-4 text-small"><span className="font-semibold">Optional: </span>{needs.optional.join(", ")}</p>}
      <p className="mt-4 text-small text-muted-foreground">{item.cost_note}</p>
      <p className="mt-4 text-small"><span className="font-semibold">With someone: </span>{item.shared_version}</p>
    </details>
  </article>;
}

/** Editorial ideas and outbound resources, separate from members and their progress. */
export function CornerStarterContent({ spaceSlug, slug, restricted }: { spaceSlug: string; slug: string; restricted: boolean }) {
  const content = starterContentFor(spaceSlug, slug);
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const cover = content.cover;
  return <>
    {content.activities.length > 0 && <section className={SECTION_GAP} id="corner-activities" aria-labelledby="activities-title">
      <h2 className="mb-4 text-title" id="activities-title">Things to try</h2>
      <div className="grid items-start gap-4 tab:grid-cols-2 desk:grid-cols-3">{content.activities.map(item => <Activity key={item.id} item={item}/>)}</div>
    </section>}
    {content.pursuits.length > 0 && <section className={SECTION_GAP} id="corner-starter-pursuits" aria-labelledby="starter-pursuits-title">
      <h2 className="mb-4 text-title" id="starter-pursuits-title">Pursuit ideas</h2>
      {content.pursuits.map(item => {
        const path = starterPursuitPath(item);
        const to = restricted ? `/login?${new URLSearchParams({ redirect: path })}` : path;
        return <article key={item.id} className="grid gap-5 rounded-card border border-border bg-card p-5 tab:grid-cols-[160px_minmax(0,1fr)]">
          <div>
            {cover ? <ImageWithFallback src={`${import.meta.env.BASE_URL}${cover.default_path}`} srcSet={cover.variants.map(v => `${import.meta.env.BASE_URL}${v.path} ${v.width}w`).join(", ")} sizes="(min-width: 744px) 160px, calc(100vw - 88px)" alt={cover.alt} aspect="8 / 5" className="w-full rounded-control" onLoad={() => setPhotoLoaded(true)} onFail={() => setPhotoLoaded(false)}/> : <SuggestionPhoto corner={{ spaceSlug, slug }} width={400} className="aspect-[8/5] w-full rounded-control"/>}
            {cover && photoLoaded && <a className="mt-2 inline-flex min-h-11 items-center text-caption text-muted-foreground underline" href={cover.source} target="_blank" rel="noopener noreferrer">Photo: {cover.credit}</a>}
          </div>
          <div className="min-w-0">
            <h3 className="text-lead font-semibold">{item.title}</h3><p className="mt-2 text-small text-muted-foreground">{item.description}</p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-small">{item.milestones.map(step => <li key={step.title}><span className="font-semibold">{step.title}. </span>{step.instruction}</li>)}</ol>
            <Link to={to} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-5 text-small font-semibold text-background">Start a Pursuit<ArrowUpRight className="size-4" aria-hidden="true"/></Link>
          </div>
        </article>;
      })}
    </section>}
    {content.resources.length > 0 && <section className={SECTION_GAP} id="corner-resources" aria-labelledby="resources-title">
      <h2 className="mb-4 text-title" id="resources-title">Resources</h2>
      <div className="grid gap-4 tab:grid-cols-2">{content.resources.map(resource => <article key={resource.id} className="flex flex-col rounded-card border border-border bg-card p-4">
        <h3 className="font-semibold">{resource.name}</h3><p className="mt-2 text-small text-muted-foreground">{resource.description}</p>
        <a href={resource.url} aria-label={`Visit website: ${resource.name}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center gap-2 self-start text-small font-semibold text-accent-text underline underline-offset-4">Visit website<ArrowUpRight className="size-4" aria-hidden="true"/></a>
      </article>)}</div>
    </section>}
  </>;
}
