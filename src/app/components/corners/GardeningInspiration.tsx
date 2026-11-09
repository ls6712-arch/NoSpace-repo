import { useState } from "react";
import { gardeningCornerPilot } from "../../data/gardeningCornerPilot";

/** Editorial inspiration is separate from member-created Wall moments. */
export function GardeningInspiration() {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [active, setActive] = useState("all");
  const categories = ["all", "start", "indoor", "edible", "creative", "outdoor"] as const;
  const visible = gardeningCornerPilot.imageCards.filter(card =>
    (active === "all" || card.collection === active) && !failed.has(card.id)
  );
  // Do not display empty cards when the corresponding original files have not
  // been deployed. Images are never fetched from arbitrary user-supplied URLs.
  return (
    <section aria-labelledby="gardening-inspiration-title" className="my-8">
      <h2 id="gardening-inspiration-title" className="text-title mb-2">Grow something</h2>
      <p className="text-body text-muted-foreground mb-4">{gardeningCornerPilot.intro}</p>
      <div className="flex gap-2 overflow-x-auto pb-3" aria-label="Filter gardening ideas">
        {categories.map(category => (
          <button key={category} type="button" aria-pressed={active === category}
            onClick={() => setActive(category)}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm ${active === category ? "bg-foreground text-background" : "bg-card"}`}>
            {category === "all" ? "All ideas" : category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4">
        {visible.map(card => (
          <article key={card.id} className="w-[220px] shrink-0 snap-start overflow-hidden rounded-card border border-border bg-card tab:w-[260px]">
            <img src={card.imagePath} alt={card.alt} loading="lazy" decoding="async"
              className="aspect-[4/3] w-full object-cover"
              onError={() => setFailed(previous => new Set(previous).add(card.id))} />
            <div className="p-3"><h3 className="text-body font-semibold">{card.title}</h3></div>
          </article>
        ))}
      </div>
      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          Gardening inspiration images are being prepared.
        </p>
      )}
      <div className="mt-6 grid gap-4 tab:grid-cols-2">
        <section className="rounded-card border border-border p-4">
          <h3 className="font-semibold mb-3">Start here</h3>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {gardeningCornerPilot.starterChecklist.map(step => <li key={step}>{step}</li>)}
          </ol>
        </section>
        <section className="rounded-card border border-border p-4">
          <h3 className="font-semibold mb-3">Garden notes</h3>
          <blockquote className="text-lg italic">{gardeningCornerPilot.quotes[0].text}</blockquote>
          <p className="text-xs text-muted-foreground mt-2">— Soosh Garden Notes</p>
        </section>
      </div>
      <div className="mt-5 grid gap-3 tab:grid-cols-2">
        {gardeningCornerPilot.lists.map(list => (
          <section key={list.title} className="rounded-card border border-border p-4">
            <h3 className="font-semibold mb-2">{list.title}</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">{list.items.map(item => <li key={item}>{item}</li>)}</ul>
            {"note" in list && <p className="mt-2 text-xs text-muted-foreground">{list.note}</p>}
          </section>
        ))}
      </div>
      <h3 className="font-semibold mt-6 mb-3">Different perspectives</h3>
      <div className="grid gap-3 tab:grid-cols-2">
        {gardeningCornerPilot.perspectives.map(p => (
          <section key={p.label} className="rounded-card border border-border p-4">
            <p className="text-xs text-muted-foreground">{p.label} · Soosh editorial perspective</p>
            <h4 className="font-semibold my-2">{p.question}</h4><p className="text-sm">{p.answer}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
