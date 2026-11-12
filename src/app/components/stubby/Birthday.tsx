import { useId, useState } from "react";
import { Link } from "react-router";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { SUPPORT_CONTACT } from "../../config";
import { useAuth } from "../../context/AuthContext";
import { ADULT_AGE, MIN_AGE, checkBirthdate } from "../../lib/age";
import { setMyBirthday } from "../../lib/birthday";
import { BIRTHDAY_COPY } from "../../lib/guestCopy";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Under the picks, when Stubby left 21+ things out because no birthday is on file. Never for a
 * guest, and never for someone with a birthday on file (an under-21 member doesn't see it).
 */
export function AdultPrompt({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const { refreshProfile } = useAuth();
  return (
    <div data-adult-prompt="" className="mt-4 flex flex-wrap items-center gap-3 rounded-card border border-border bg-card p-4">
      <p className="min-w-0 flex-1 text-small">{BIRTHDAY_COPY.adultPrompt(ADULT_AGE)}</p>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {BIRTHDAY_COPY.add}
      </Button>
      <BirthdaySheet
        open={open}
        onOpenChange={setOpen}
        onAdded={(result) => {
          onAdded();
          // Under 18: the account is now Stubby only; the profile says so and Root reads it.
          if (result === "under_18") void refreshProfile();
        }}
      />
    </div>
  );
}

/** The support link, from the one place it is set (config.ts). */
export function SupportLink() {
  return (
    <a href={SUPPORT_CONTACT.href} target="_blank" rel="noopener noreferrer" className="text-small font-semibold text-accent-text underline underline-offset-4">
      {SUPPORT_CONTACT.label}
    </a>
  );
}

type Step = "date" | "under_18" | "locked";

/**
 * Onboarding's birthday question, as a sheet. One try: the database locks the answer. An under-18
 * date says so calmly and keeps the account (Stubby only); a birthday already on file says how to
 * reach support.
 */
export function BirthdaySheet({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (open: boolean) => void; onAdded: (result: "ok" | "under_18") => void }) {
  const fieldId = useId();
  const hintId = useId();
  const [birthdate, setBirthdate] = useState("");
  const [step, setStep] = useState<Step>("date");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    onOpenChange(false);
    // Under 18: reported once the message has been read (Done), so it isn't taken away early.
    if (step === "under_18") onAdded("under_18");
    setStep("date");
    setError(null);
    setBirthdate("");
  };

  const save = async () => {
    if (saving || !birthdate) return;
    // Checked here first for the message only; the database decides.
    if (checkBirthdate(birthdate) === "invalid") {
      setError(BIRTHDAY_COPY.badDate);
      return;
    }
    setSaving(true);
    const r = await setMyBirthday(birthdate);
    setSaving(false);
    if (r === "ok") {
      onAdded("ok");
      close();
    } else if (r === "under_18") {
      setStep("under_18");
    } else if (r === "locked") {
      setStep("locked");
    } else if (r === "invalid") {
      setError(BIRTHDAY_COPY.badDate);
    } else {
      setError(BIRTHDAY_COPY.saveFailed);
    }
  };

  if (step === "under_18") {
    return (
      <BottomSheet open={open} onOpenChange={(o) => !o && close()} title={BIRTHDAY_COPY.under18(MIN_AGE)} description={BIRTHDAY_COPY.under18Note}>
        <div className="flex flex-col gap-2.5 pb-2" data-birthday-under-18="">
          <Button size="lg" className="w-full" onClick={close}>
            {BIRTHDAY_COPY.done}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  if (step === "locked") {
    return (
      <BottomSheet open={open} onOpenChange={(o) => !o && close()} title={BIRTHDAY_COPY.title} description={BIRTHDAY_COPY.locked}>
        <div className="flex flex-col items-center gap-4 pb-2" data-birthday-locked="">
          <SupportLink />
          <Button size="lg" className="w-full" onClick={close}>
            {BIRTHDAY_COPY.done}
          </Button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && close()} title={BIRTHDAY_COPY.title}>
      <form
        className="flex flex-col gap-3 pb-2"
        data-birthday-sheet=""
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Label htmlFor={fieldId}>{BIRTHDAY_COPY.label}</Label>
        <Input
          id={fieldId}
          type="date"
          autoComplete="bday"
          min="1900-01-01"
          max={todayIso()}
          value={birthdate}
          aria-describedby={hintId}
          onChange={(e) => {
            setBirthdate(e.target.value);
            setError(null);
          }}
          className="h-12 text-body"
        />
        <p id={hintId} className="text-small text-muted-foreground">
          {BIRTHDAY_COPY.hint}
        </p>
        {error && (
          <p role="alert" className="text-small text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={saving || !birthdate}>
          {BIRTHDAY_COPY.add}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={close}>
          {BIRTHDAY_COPY.notNow}
        </Button>
      </form>
    </BottomSheet>
  );
}

/**
 * An account dropped to Stubby only by an under-18 birthday, on any other page: the same calm
 * line, and the way back. It is not deleted; the database keeps it out of member features.
 */
export function Under18Screen() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4" data-under-18="">
      <div className="glass-panel shadow-card w-full max-w-md rounded-card p-8 text-center tab:p-10">
        <h2 className="mb-3 text-title" style={{ fontFamily: "var(--font-serif)" }}>
          {BIRTHDAY_COPY.under18(MIN_AGE)}
        </h2>
        <p className="mb-7 text-small leading-relaxed text-muted-foreground">{BIRTHDAY_COPY.under18Note}</p>
        <Link to="/calendar">
          <Button className="w-full" size="lg">
            {BIRTHDAY_COPY.backToStubby}
          </Button>
        </Link>
      </div>
    </div>
  );
}
