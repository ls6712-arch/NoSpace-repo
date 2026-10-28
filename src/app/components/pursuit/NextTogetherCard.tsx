import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { PillButton } from "../ui/PillButton";
import { BottomSheet } from "../ui/BottomSheet";
import { AvatarStack, type StackPerson } from "../ui/AvatarStack";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { fetchNextSession, saveSession, setImIn, type PursuitSession } from "../../lib/openPursuits";
import { profilesById } from "../../lib/pursuitsRemote";
import { formatDateTime } from "../../lib/dates";
import { haptic, PAGE_FROM, PAGE_TO, page } from "../../lib/motionTokens";
import { plural } from "../../lib/plural";

/**
 * "Next together": the group's next shared session (screen 5), on an accent
 * card, with an I'm in button that toggles to "You're in" and puts you in the
 * avatar stack. The host sets the session; everyone else only answers. Nothing
 * shows when there is no session and you are not the host.
 */
export function NextTogetherCard({ pursuitId, userId, isOwner }: { pursuitId: string; userId?: string; isOwner: boolean }) {
  const [session, setSession] = useState<PursuitSession | null | undefined>(undefined);
  const [people, setPeople] = useState<StackPerson[]>([]);
  const [setting, setSetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const s = await fetchNextSession(pursuitId);
    setSession(s);
    if (s && s.going.length > 0) {
      const byId = await profilesById(s.going.map((g) => g.userId));
      setPeople(s.going.map((g) => ({ name: byId.get(g.userId)?.displayName ?? "Someone", avatarUrl: byId.get(g.userId)?.avatarUrl })));
    } else {
      setPeople([]);
    }
  }, [pursuitId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (session === undefined) return null;
  if (!session && !isOwner) return null;

  const going = !!userId && !!session?.going.some((g) => g.userId === userId);

  const toggle = async () => {
    if (!session || !userId) return;
    const next = !going;
    haptic();
    // Show it at once; put it back if the write fails.
    setSession({ ...session, going: next ? [...session.going, { userId }] : session.going.filter((g) => g.userId !== userId) });
    const failed = await setImIn(session.id, userId, next);
    if (failed) {
      setError(failed);
      setSession(session);
    } else {
      setError(null);
      void load();
    }
  };

  return (
    <motion.section
      initial={PAGE_FROM}
      animate={PAGE_TO}
      transition={page}
      aria-label="Next together"
      className="mb-6 rounded-card bg-accent p-4 text-accent-foreground"
    >
      {session ? (
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-small">Next together</p>
            <p className="font-[family-name:var(--font-display)] text-lead leading-tight font-extrabold">
              {formatDateTime(session.startsAt)}
              {session.place ? ` · ${session.place}` : ""}
            </p>
            <p className="mt-1 text-small">
              {[session.going.length > 0 ? `${session.going.length} going` : "", session.note ?? ""].filter(Boolean).join(" · ")}
            </p>
            {people.length > 0 && <AvatarStack people={people} total={session.going.length} size="size-7" className="mt-2" />}
          </div>
          {userId && (
            <PillButton variant="ink" done={going} doneLabel="You’re in" onClick={() => void toggle()}>
              I’m in
            </PillButton>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-small">Next together</p>
          <PillButton variant="ink" onClick={() => setSetting(true)}>
            Set next session
          </PillButton>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-caption">
          {error}
        </p>
      )}
      {isOwner && session && (
        <button type="button" onClick={() => setSetting(true)} className="mt-2 min-h-11 text-small font-semibold underline underline-offset-4">
          Set next session
        </button>
      )}
      {isOwner && userId && (
        <SetSessionSheet
          open={setting}
          onOpenChange={setSetting}
          onSave={async (fields) => {
            const failed = await saveSession(pursuitId, userId, fields);
            if (!failed) await load();
            return failed;
          }}
        />
      )}
    </motion.section>
  );
}

function SetSessionSheet({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (fields: { startsAt: number; place?: string; note?: string }) => Promise<string | null>;
}) {
  const [when, setWhen] = useState("");
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startsAt = when ? new Date(when).getTime() : NaN;
  const valid = Number.isFinite(startsAt) && startsAt > Date.now();

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Next together"
      footer={
        <div className="flex flex-col items-center gap-2">
          {error && (
            <p role="alert" className="text-caption text-accent-text">
              {error}
            </p>
          )}
          <PillButton
            className="w-full"
            disabled={!valid || saving}
            onClick={async () => {
              setSaving(true);
              const failed = await onSave({ startsAt, place, note });
              setSaving(false);
              if (failed) setError(failed);
              else {
                setWhen("");
                setPlace("");
                setNote("");
                setError(null);
                onOpenChange(false);
              }
            }}
          >
            Save changes
          </PillButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="session-when">When</Label>
          <Input id="session-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-12" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="session-place">Where</Label>
          <Input id="session-place" value={place} maxLength={120} onChange={(e) => setPlace(e.target.value)} className="h-12" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="session-note">Note</Label>
          <Input id="session-note" value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} className="h-12" />
          <p className="text-caption text-muted-foreground">{`${plural(140 - note.length, "character")} left`}</p>
        </div>
      </div>
    </BottomSheet>
  );
}
