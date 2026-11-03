import { useEffect, useId, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../context/AuthContext";
import { emptyCapability, type CapabilityProfile } from "../../lib/capabilityProfile";
import { deleteCapability, fetchCapability, saveCapability } from "../../lib/capabilityProfileRemote";
import { fetchPasses, fetchTaste, type Taste } from "../../lib/tasteRemote";
import type { Pass } from "../../lib/tasteModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/** The same optional editor in onboarding and account settings. Nothing is learned by default. */
export function CapabilityEditor() {
  const { user } = useAuth();
  if (!user || user.is_anonymous) return null;
  return <CapabilityForm key={user.id} userId={user.id} />;
}

function CapabilityForm({ userId }: { userId: string }) {
  const id = useId();
  const [profile, setProfile] = useState<CapabilityProfile>(emptyCapability);
  const [taste, setTaste] = useState<Taste | null>(null);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    let live = true;
    setLoaded(false); setLoading(true); setProfile(emptyCapability()); setTaste(null); setPasses([]); setMessage(null);
    void Promise.all([fetchCapability(undefined, userId), fetchTaste(userId), fetchPasses(userId)]).then(([c, t, p]) => {
      if (live) { setProfile(c); setTaste(t); setPasses(p); setLoaded(true); }
    }).catch(() => { if (live) setMessage("Stubby couldn’t load your saved information. Try again later."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [userId]);
  const patch = (p: Partial<CapabilityProfile>) => { setProfile(c => ({ ...c, ...p })); setMessage(null); };
  const submit = async () => {
    setBusy(true); setMessage(null);
    try { await saveCapability(profile, undefined, userId); setMessage("Your changes are saved."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Your changes weren’t saved. Try again."); }
    finally { setBusy(false); }
  };
  const forget = async () => {
    setBusy(true); setMessage(null);
    try { await deleteCapability(undefined, userId); setProfile(emptyCapability()); setConfirmDelete(false); setMessage("Stubby’s saved information and feedback are deleted. Your onboarding answers are unchanged."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Your saved information wasn’t deleted. Try again."); }
    finally { setBusy(false); }
  };
  return <details className="rounded-control border border-border bg-card p-4">
    <summary className="min-h-11 cursor-pointer text-body font-semibold">What Stubby knows</summary>
    <p className="mb-3 text-small text-muted-foreground">Optional. Choose what Stubby uses for suggestions. You can change or delete it here.</p>
    {loading && <p role="status">Loading…</p>}
    {message && <p role="status" className="mb-3 text-small">{message}</p>}
    {!loading && loaded && <fieldset disabled={busy} className="flex flex-col gap-4">
      {([ ["memory", "Use my saved information"], ["onboarding", "Use my onboarding answers"], ["feedback", "Learn from my feedback"] ] as const).map(([key, label]) =>
        <Label key={key} className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={profile.consent[key]} onChange={e => patch({ consent: { ...profile.consent, [key]: e.target.checked } })} />{label}</Label>)}
      <p className="text-small text-muted-foreground">Saved information is used only when the first option is on. Feedback stays separate from what you tell Stubby.</p>
      <Label htmlFor={`${id}-tz`}>Timezone</Label>
      <Input id={`${id}-tz`} value={profile.timeZone} onChange={e => patch({ timeZone: e.target.value })} maxLength={80} />
      <Label htmlFor={`${id}-budget`}>Budget for an activity in dollars</Label>
      <Input id={`${id}-budget`} type="number" min={0} max={10000} step="0.01" value={profile.perActivityBudget ?? ""} onChange={e => patch({ perActivityBudget: e.target.value === "" ? null : Number(e.target.value) })} />
      {([ ["equipment", "Equipment and resources"], ["goals", "Goals"], ["preferences", "What you prefer"] ] as const).map(([key, label]) => <div key={key}>
        <Label htmlFor={`${id}-${key}`}>{label}</Label>
        <p className="text-small text-muted-foreground">One entry per line. Leave blank to skip.</p>
        <textarea id={`${id}-${key}`} rows={3} maxLength={2400} className="w-full rounded-control border border-border bg-background p-3 text-body" value={profile[key].join("\n")} onChange={e => patch({ [key]: e.target.value.split("\n") })} />
      </div>)}
      <fieldset className="flex flex-col gap-2"><legend>Memberships and subscriptions</legend>
        <p className="text-small text-muted-foreground">What you tell us is not proof of a discount or entry. Check with the provider before you go.</p>
        {profile.memberships.map((m, i) => <div key={i} className="flex flex-col gap-2">
          <Label htmlFor={`${id}-member-${i}`}>Name</Label>
          <Input id={`${id}-member-${i}`} maxLength={120} value={m.name} onChange={e => patch({ memberships: profile.memberships.map((x, n) => n === i ? { ...x, name: e.target.value } : x) })} />
          <Label htmlFor={`${id}-expiry-${i}`}>Expiry date, if known</Label>
          <Input id={`${id}-expiry-${i}`} type="date" value={m.expiresOn ?? ""} onChange={e => patch({ memberships: profile.memberships.map((x, n) => n === i ? { ...x, expiresOn: e.target.value || null } : x) })} />
          <Button variant="outline" onClick={() => patch({ memberships: profile.memberships.filter((_, n) => n !== i) })}>Remove</Button>
        </div>)}
        <Button variant="outline" disabled={profile.memberships.length >= 20} onClick={() => patch({ memberships: [...profile.memberships, { name: "", expiresOn: null, status: "self_reported" }] })}>Add membership</Button>
      </fieldset>
      {taste && <div className="text-small">
        <p>Usual free times: {taste.windows.join(", ") || "Not set"}</p>
        <p>Monthly budget: {taste.budget === null ? "Not set" : `$${taste.budget}`}</p>
        <p>Passes: {passes.map(p => p.place ? `${p.label} (${p.place})` : p.label).join(", ") || "Not set"}</p>
        <Link to="/onboarding?step=picks" className="underline">Edit onboarding answers</Link>
      </div>}
      <Button onClick={() => void submit()}>Save changes</Button>
      {!confirmDelete ? <Button variant="outline" onClick={() => setConfirmDelete(true)}>Delete saved information</Button> : <div>
        <p className="mb-2 text-small">Delete Stubby’s saved information and feedback? This keeps your onboarding answers.</p>
        <Button variant="outline" onClick={() => void forget()}>Delete</Button>
        <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
      </div>}
    </fieldset>}
  </details>;
}
