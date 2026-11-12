import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Chip } from "../ui/Chip";
import { MoodsCityForm } from "../interests/MoodsCityForm";
import type { MoodId } from "../../data/moods";
import { track } from "../../lib/analytics";
import { GUEST_COPY } from "../../lib/guestCopy";
import { nearestNeighborhood } from "../../lib/neighborhood";
import { cleanCityName, type Taste, type Timing } from "../../lib/stubbyAsk";

/** The browser's position, once, read on this device only. Null when denied, missing or slow. */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000 },
    );
  });
}

/** An approximate city from the request's IP (Vercel's geolocation headers, api/geo.ts). Never coordinates. */
async function guessCity(): Promise<string | null> {
  try {
    const res = await fetch("/api/geo", { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const b = (await res.json()) as { city?: unknown };
    return typeof b.city === "string" ? cleanCityName(b.city) : null;
  } catch {
    return null;
  }
}

/**
 * Three quick things before the first ask, so Stubby's first picks fit: the city (guessed from the
 * IP and editable; or the browser's location, matched on this device to a neighborhood name and
 * then dropped), the 8 mood chips, and when. Shown only while the taste profile is empty. Skip
 * is always there and saves nothing.
 */
export function ContextCard({ onDone, onSkip }: { onDone: (t: Taste) => void; onSkip: () => void }) {
  const [city, setCity] = useState("");
  const [moods, setMoods] = useState<MoodId[]>([]);
  const [timing, setTiming] = useState<Timing | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    track({ name: "stubby_context_shown" });
    let live = true;
    void guessCity().then((c) => {
      if (live && c) setCity((now) => now || c);
    });
    return () => {
      live = false;
    };
  }, []);

  const locate = async () => {
    setLocating(true);
    const pos = await currentPosition();
    setLocating(false);
    // Matched here, on this device; the coordinates go nowhere and are dropped now.
    const place = pos ? nearestNeighborhood(pos) : null;
    if (place) setCity(place.name);
  };

  const done = () => {
    const t: Taste = { city: cleanCityName(city), interests: moods, timing };
    track({ name: "stubby_context_completed", interests: moods.length, city: !!t.city, timing: !!timing });
    onDone(t);
  };

  const timings: { id: Timing; label: string }[] = [
    { id: "tonight", label: GUEST_COPY.context.tonight },
    { id: "weekend", label: GUEST_COPY.context.weekend },
    { id: "anytime", label: GUEST_COPY.context.anytime },
  ];

  return (
    <section data-context-card="" aria-label={GUEST_COPY.context.line} className="mb-6 flex flex-col gap-6 rounded-card border border-border bg-card p-4 tab:p-6">
      <p className="text-lead font-semibold">{GUEST_COPY.context.line}</p>
      <div className="flex flex-col gap-3">
        <p className="text-small text-muted-foreground">{GUEST_COPY.context.interests}</p>
        <MoodsCityForm moods={moods} city={city} onMoods={setMoods} onCity={setCity} />
        <div className="flex flex-col gap-1">
          <Button type="button" variant="outline" size="sm" className="w-fit" disabled={locating} onClick={() => void locate()}>
            {GUEST_COPY.context.useLocation}
          </Button>
          <p className="text-caption text-muted-foreground">{GUEST_COPY.context.locationNote}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-small text-muted-foreground">{GUEST_COPY.context.timing}</p>
        <div role="group" aria-label={GUEST_COPY.context.timing} className="flex flex-wrap gap-2">
          {timings.map((t) => (
            <Chip key={t.id} selected={timing === t.id} onClick={() => setTiming((now) => (now === t.id ? null : t.id))}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={done}>
          {GUEST_COPY.context.use}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            track({ name: "stubby_context_skipped" });
            onSkip();
          }}
        >
          {GUEST_COPY.context.skip}
        </Button>
      </div>
    </section>
  );
}
