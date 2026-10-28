import { useEffect, useState } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { PillButton } from "../ui/PillButton";
import { MoodsCityForm } from "../interests/MoodsCityForm";
import { useInterests } from "../../lib/interests";
import { ERROR_LINE } from "../../lib/stateCopy";
import type { MoodId } from "../../data/moods";

/** Changes what you want more of and your city, from Discover. The promise onboarding makes: change it any time. */
export function InterestsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const interests = useInterests();
  const [moods, setMoods] = useState<MoodId[]>(interests.moods);
  const [city, setCity] = useState(interests.city);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start from what is saved each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setMoods(interests.moods);
    setCity(interests.city);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    if (saving || moods.length === 0) return;
    setSaving(true);
    const failed = await interests.save({ city, moods });
    setSaving(false);
    if (failed) {
      setError(ERROR_LINE);
      return;
    }
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="What do you want more of?"
      footer={
        <div className="flex flex-col items-center gap-2">
          {error && (
            <p role="alert" className="text-caption text-accent-text">
              {error}
            </p>
          )}
          {moods.length === 0 && <p className="text-caption text-muted-foreground">Pick at least one</p>}
          <PillButton className="w-full" disabled={moods.length === 0 || saving} onClick={() => void save()}>
            Save changes
          </PillButton>
        </div>
      }
    >
      <MoodsCityForm moods={moods} city={city} onMoods={setMoods} onCity={setCity} />
    </BottomSheet>
  );
}
