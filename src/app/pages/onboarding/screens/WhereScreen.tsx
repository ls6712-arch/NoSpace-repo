import { useState } from "react";
import { TransferButton } from "../../../components/onboarding/TransferButton";
import { TransferField } from "../../../components/onboarding/TransferField";
import { useAuth } from "../../../context/AuthContext";
import { useInterests } from "../../../lib/interests";
import { nearestNeighborhood, placeFromTyped, suggestNeighborhoods } from "../../../lib/neighborhood";
import { savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

/** The one browser position read. Resolves to null when it is denied, unavailable or too slow. */
function currentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600000 },
    );
  });
}

/**
 * Screen 6: a neighborhood, or the browser's location (read here, matched to
 * the nearest New York neighborhood and never sent anywhere). Anything typed
 * that is not a known neighborhood is kept as the city, so people outside
 * New York get in too. If location is denied the field stays; there is no nagging.
 */
export function WhereScreen() {
  const { next, setStubby } = useOnboarding();
  const { user } = useAuth();
  const interests = useInterests();
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const place = placeFromTyped(typed);
  const suggestions = suggestNeighborhoods(typed);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    setNote(null);
    setStubby("thinking");
    const pos = await currentPosition();
    setStubby("idle");
    setLocating(false);
    if (!pos) {
      setNote("Location is off. Type your neighborhood instead.");
      return;
    }
    const found = nearestNeighborhood(pos);
    if (!found) {
      setNote("That’s outside New York. Type your city instead.");
      return;
    }
    setTyped(found.name);
  };

  const save = async () => {
    if (saving || !place) return;
    setSaving(true);
    setError(null);
    // The city goes through the same path Discover reads (this device first), then the area beside it.
    const cityError = await interests.save({ city: place.city, moods: interests.moods });
    const areaSaved = user ? await savePrivate(user.id, { area: place.area }) : { error: null };
    setSaving(false);
    if (cityError || areaSaved.error) {
      setError(ERROR_LINE);
      return;
    }
    next();
  };

  return (
    <ScreenFrame
      title="Where are you?"
      hero={<StepStubby size={140} />}
      footer={
        <>
          {error && (
            <p role="alert" className="transfer-label text-small">
              {error}
            </p>
          )}
          <TransferButton onClick={() => void save()} disabled={saving || !place}>
            {place ? "Next" : "Add a neighborhood"}
          </TransferButton>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TransferField
          label="Neighborhood or city"
          autoComplete="off"
          maxLength={80}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setNote(null);
            setError(null);
          }}
          hint={note ?? undefined}
        />
        {suggestions.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Neighborhoods">
            {suggestions.map((n) => (
              <li key={n.name}>
                <button type="button" className="transfer-suggestion" onClick={() => setTyped(n.name)}>
                  {n.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="transfer-link self-start" disabled={locating} onClick={() => void locate()}>
          Use my location
        </button>
      </form>
    </ScreenFrame>
  );
}
