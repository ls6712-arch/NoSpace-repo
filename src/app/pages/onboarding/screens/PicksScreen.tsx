import { useEffect, useMemo, useRef, useState } from "react";
import { ChoiceChip } from "../../../components/onboarding/ChoiceChip";
import { TransferButton } from "../../../components/onboarding/TransferButton";
import { TransferField } from "../../../components/onboarding/TransferField";
import { useAuth } from "../../../context/AuthContext";
import { isDiscoverable, matchCorners, useCorners } from "../../../context/CornersContext";
import { CURATED_CORNERS } from "../../../data/curatedCorners";
import { useInterests } from "../../../lib/interests";
import { savePrivate } from "../../../lib/onboardingRemote";
import { ERROR_LINE } from "../../../lib/stateCopy";
import { buildPickOptions, hasEnoughPicks, picksMissingLine } from "../../../lib/tasteModel";
import { fetchCornerActivity, fetchTaste, pickKey } from "../../../lib/tasteRemote";
import { useOnboarding } from "../OnboardingContext";
import { useArrival } from "../useArrival";
import { ScreenFrame } from "./ScreenFrame";

/**
 * Screen 7: "What would you say yes to?" Three or more Corners, no maximum.
 * The list is the friend's Corner (if they came from an invite, already
 * picked), then Corners with something real near them in the next 14 days,
 * then the curated ones. "Something else" searches the Corners that exist;
 * it never makes one. Each pick stamps Stubby, each un-pick unstamps it.
 */
export function PicksScreen() {
  const { next, react, inviteCode, redirectTo } = useOnboarding();
  const { user } = useAuth();
  const { city } = useInterests();
  const { allCorners } = useCorners();
  const arrival = useArrival(inviteCode, redirectTo);

  const [selected, setSelected] = useState<string[]>([]);
  const [activity, setActivity] = useState<ReadonlyMap<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hadSaved = useRef(false);
  const seeded = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all([user ? fetchTaste(user.id) : Promise.resolve(null), fetchCornerActivity(city)]).then(([taste, act]) => {
      if (!live) return;
      if (taste && taste.picks.length > 0) {
        hadSaved.current = true;
        setSelected(taste.picks);
      }
      setActivity(act);
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [user, city]);

  // The friend's Corner starts picked, once, and only when nothing was saved before. They can unpick it.
  useEffect(() => {
    if (!loaded || seeded.current || !arrival?.cornerKey) return;
    seeded.current = true;
    if (hadSaved.current) return;
    const key = arrival.cornerKey;
    setSelected((cur) => (cur.includes(key) ? cur : [key, ...cur]));
  }, [loaded, arrival?.cornerKey]);

  const curated = useMemo(
    () => CURATED_CORNERS.map((c) => ({ key: pickKey(c.spaceSlug, c.slug), name: c.name, emoji: c.emoji })),
    [],
  );
  const names = useMemo(() => new Map(allCorners.map((c) => [pickKey(c.spaceSlug, c.slug), c.name] as const)), [allCorners]);
  // Shown order is fixed by what is known now; picking never reshuffles it (picked extras follow at the end).
  const options = useMemo(
    () =>
      buildPickOptions({
        curated,
        activity,
        names,
        arrival: arrival?.cornerKey ? { key: arrival.cornerKey, going: arrival.name } : null,
        selected,
      }),
    [curated, activity, names, arrival, selected],
  );

  const found = useMemo(() => {
    if (!searching || !query.trim()) return [];
    const shown = new Set(options.map((o) => o.key));
    return matchCorners(allCorners.filter(isDiscoverable), query).filter((c) => !shown.has(pickKey(c.spaceSlug, c.slug)));
  }, [searching, query, allCorners, options]);

  const toggle = (key: string) => {
    setError(null);
    if (selected.includes(key)) {
      setSelected(selected.filter((k) => k !== key));
      react("unstamped");
    } else {
      setSelected([...selected, key]);
      react("stamped");
    }
  };

  const enough = hasEnoughPicks(selected.length);
  const save = async () => {
    if (saving || !enough) return;
    setSaving(true);
    setError(null);
    const saved = user ? await savePrivate(user.id, { picks: selected }) : { error: null };
    setSaving(false);
    if (saved.error) {
      setError(ERROR_LINE);
      return;
    }
    next();
  };

  return (
    <ScreenFrame
      title="What would you say yes to?"
      stickyFooter
      footer={
        <>
          {error && (
            <p role="alert" className="transfer-label text-small">
              {error}
            </p>
          )}
          <TransferButton onClick={() => void save()} disabled={saving || !enough}>
            {enough ? "Next" : picksMissingLine(selected.length)}
          </TransferButton>
        </>
      }
    >
      <ul className="flex flex-col gap-2" aria-label="Corners">
        {options.map((o) => (
          <li key={o.key}>
            <ChoiceChip pressed={selected.includes(o.key)} onToggle={() => toggle(o.key)} sub={o.going ? `${o.going}’s going` : undefined}>
              {o.emoji ? `${o.emoji} ${o.name}` : o.name}
            </ChoiceChip>
          </li>
        ))}
      </ul>
      {!searching ? (
        <button type="button" className="transfer-link self-start" onClick={() => setSearching(true)}>
          + Something else
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          <TransferField label="Find a Corner" autoComplete="off" maxLength={60} value={query} onChange={(e) => setQuery(e.target.value)} />
          {found.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Matching Corners">
              {found.map((c) => {
                const key = pickKey(c.spaceSlug, c.slug);
                return (
                  <li key={key}>
                    <ChoiceChip pressed={selected.includes(key)} onToggle={() => toggle(key)}>
                      {c.name}
                    </ChoiceChip>
                  </li>
                );
              })}
            </ul>
          )}
          {query.trim() && found.length === 0 && <p className="text-small transfer-muted">No Corner by that name.</p>}
        </div>
      )}
    </ScreenFrame>
  );
}
