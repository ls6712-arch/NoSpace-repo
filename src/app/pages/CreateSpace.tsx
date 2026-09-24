import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ImagePlus, MapPin, Save, Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

const DRAFT_KEY = "sushii.space-draft.v1";
const TYPES = ["Interest", "Creator", "Studio", "Community", "Business", "Other"];
const MODES = ["Online", "Physical", "Both"];
const STEPS = ["Basics", "Type", "Image", "Location", "Community", "Preview"];

type Draft = {
  name: string;
  description: string;
  category: string;
  interests: string;
  coverImage: string;
  profileImage: string;
  mode: string;
  location: string;
  capacity: string;
  amenities: string;
  accessibility: string;
  rules: string;
  rental: boolean;
  hourlyPrice: string;
  minimumDuration: string;
};

const EMPTY: Draft = {
  name: "",
  description: "",
  category: "Interest",
  interests: "",
  coverImage: "",
  profileImage: "",
  mode: "Online",
  location: "",
  capacity: "",
  amenities: "",
  accessibility: "",
  rules: "",
  rental: false,
  hourlyPrice: "",
  minimumDuration: "1 hour",
};

function loadDraft(): Draft {
  if (typeof window === "undefined") return EMPTY;
  try {
    return { ...EMPTY, ...(JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "{}") as Partial<Draft>) };
  } catch {
    return EMPTY;
  }
}

export function CreateSpace() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(loadDraft);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const patch = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }));
  const canContinue = useMemo(() => {
    if (step === 0) return draft.name.trim().length > 1 && draft.description.trim().length > 5;
    if (step === 3) return draft.mode === "Online" || draft.location.trim().length > 2;
    return true;
  }, [draft, step]);

  const next = () => {
    if (!canContinue) return;
    setNotice(null);
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };
  const back = () => (step === 0 ? navigate(-1) : setStep((current) => current - 1));
  const saveDraft = () => setNotice("Draft saved on this device. Backend persistence is isolated for the existing account layer.");
  const publish = () => setNotice("Ready to publish when Space persistence is connected. Nothing has been sent yet.");

  return (
    <div className="min-h-screen bg-surface pb-24">
      <div className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between border-b border-border pb-5"><button type="button" onClick={back} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back</button><Link to="/discover" className="text-lg" style={{ fontFamily: "var(--font-serif)" }}>Sushii</Link><Button variant="outline" size="sm" onClick={saveDraft}><Save className="size-3.5" /> Save draft</Button></div>
        <div className="grid gap-10 pt-12 lg:grid-cols-[220px_1fr] lg:pt-20">
          <aside><p className="ns-section-kicker mb-4">CREATE A SPACE</p><h1 className="text-4xl leading-tight sm:text-5xl" style={{ fontFamily: "var(--font-serif)" }}>Make room for <em className="text-accent">something shared.</em></h1><p className="mt-5 text-sm leading-relaxed text-muted-foreground">Build a place around an interest, a practice, a creator, or a physical room.</p><ol className="mt-10 space-y-1">{STEPS.map((label, index) => <li key={label}><button type="button" onClick={() => index <= step && setStep(index)} className={`flex w-full items-center gap-3 border-b border-border py-3 text-left text-xs ${index === step ? "text-foreground" : index < step ? "text-accent" : "text-muted-foreground"}`}><span className={`flex size-6 items-center justify-center rounded-full border text-[10px] ${index === step ? "border-accent bg-accent/10" : "border-border"}`}>{index < step ? <Check className="size-3" /> : String(index + 1).padStart(2, "0")}</span>{label}</button></li>)}</ol></aside>
          <main className="min-w-0 border-t border-border pt-8 lg:border-t-0 lg:pt-0"><div className="flex items-center justify-between text-[11px] uppercase tracking-[.16em] text-muted-foreground"><span>STEP {String(step + 1).padStart(2, "0")} OF {String(STEPS.length).padStart(2, "0")}</span><span>Saved locally for this prototype</span></div>{step === 0 && <Basics draft={draft} patch={patch} />}{step === 1 && <TypeStep draft={draft} patch={patch} />}{step === 2 && <ImageStep draft={draft} patch={patch} />}{step === 3 && <LocationStep draft={draft} patch={patch} />}{step === 4 && <CommunityStep draft={draft} patch={patch} />}{step === 5 && <PreviewStep draft={draft} />}{notice && <p className="mt-6 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{notice}</p>}<div className="mt-10 flex items-center justify-between gap-3"><Button variant="outline" onClick={back}>Back</Button>{step === STEPS.length - 1 ? <Button variant="brand" onClick={publish}>Publish Space <ArrowRight className="size-4" /></Button> : <Button variant="brand" onClick={next} disabled={!canContinue}>Continue <ArrowRight className="size-4" /></Button>}</div></main>
        </div>
      </div>
    </div>
  );
}

function Intro({ kicker, title, copy }: { kicker: string; title: string; copy: string }) { return <div className="mb-8"><p className="ns-section-kicker mb-3">{kicker}</p><h2 className="text-4xl leading-tight" style={{ fontFamily: "var(--font-serif)" }}>{title}</h2><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{copy}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-xs uppercase tracking-[.14em] text-muted-foreground">{label}</span>{children}</label>; }
function Textarea({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (value: string) => void; placeholder: string; rows?: number }) { return <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={rows} className="w-full resize-y rounded-xl border border-input bg-card px-3 py-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />; }
function Basics({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) { return <section><Intro kicker="BASIC INFORMATION" title="Start with the basics." copy="Give people a clear first impression. These details can be refined later." /><div className="space-y-5"><Field label="Name"><Input value={draft.name} onChange={(event) => patch({ name: event.target.value.slice(0, 80) })} placeholder="The Mud Room" autoFocus /></Field><Field label="Description"><Textarea value={draft.description} onChange={(value) => patch({ description: value.slice(0, 300) })} placeholder="A place for people who love making things with clay." /></Field><Field label="Category"><Input value={draft.category} onChange={(event) => patch({ category: event.target.value.slice(0, 60) })} placeholder="Studio, community, interest, or place" /></Field><Field label="Interests and tags"><Input value={draft.interests} onChange={(event) => patch({ interests: event.target.value.slice(0, 240) })} placeholder="pottery, ceramics, making" /></Field></div></section>; }
function TypeStep({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) { return <section><Intro kicker="CHOOSE A TYPE" title="What kind of Space is this?" copy="Choose the closest starting point. You can shape the details as the Space grows." /><div className="grid gap-3 sm:grid-cols-2">{TYPES.map((type) => <button key={type} type="button" onClick={() => patch({ category: type })} className={`rounded-2xl border p-5 text-left transition-colors ${draft.category === type ? "border-accent bg-accent/10" : "border-border bg-card hover:border-accent/50"}`}><span className="flex size-8 items-center justify-center rounded-full border border-accent/40 text-accent"><Sparkles className="size-3.5" /></span><h3 className="mt-8 text-2xl" style={{ fontFamily: "var(--font-serif)" }}>{type}</h3><p className="mt-1 text-xs text-muted-foreground">{type === "Studio" ? "A physical place to make and gather" : type === "Community" ? "A group built around doing things together" : `A Space for a ${type.toLowerCase()}`}</p></button>)}</div></section>; }
function ImageStep({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) { return <section><Intro kicker="ADD IMAGES" title="Give it a sense of place." copy="Use a cover and profile image so people can recognize the Space. Upload wiring stays isolated for the existing media layer." /><div className="grid gap-5 md:grid-cols-2"><Field label="Cover image URL"><div className="flex items-center gap-2"><ImagePlus className="size-4 text-muted-foreground" /><Input value={draft.coverImage} onChange={(event) => patch({ coverImage: event.target.value })} placeholder="https://…" /></div></Field><Field label="Profile image URL"><div className="flex items-center gap-2"><ImagePlus className="size-4 text-muted-foreground" /><Input value={draft.profileImage} onChange={(event) => patch({ profileImage: event.target.value })} placeholder="https://…" /></div></Field></div><div className="mt-6 rounded-2xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">Image uploads will connect to the existing private media/storage layer. This prototype accepts URLs so the flow can be reviewed without changing backend behavior.</div></section>; }
function LocationStep({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) { return <section><Intro kicker="LOCATION" title="Where does it happen?" copy="Tell people whether this Space is online, physical, or both." /><div className="flex flex-wrap gap-2">{MODES.map((mode) => <button key={mode} type="button" onClick={() => patch({ mode })} className={`rounded-full border px-4 py-2 text-sm ${draft.mode === mode ? "border-accent bg-accent/10 text-accent" : "border-border hover:border-accent/50"}`}>{mode}</button>)}</div>{draft.mode !== "Online" && <div className="mt-6 space-y-5"><Field label="Address or neighborhood"><div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><Input value={draft.location} onChange={(event) => patch({ location: event.target.value })} placeholder="Brooklyn, New York" /></div></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Capacity"><Input value={draft.capacity} onChange={(event) => patch({ capacity: event.target.value })} placeholder="24 people" /></Field><Field label="Amenities"><Input value={draft.amenities} onChange={(event) => patch({ amenities: event.target.value })} placeholder="Wheel, kiln, natural light" /></Field></div><Field label="Accessibility"><Textarea value={draft.accessibility} onChange={(value) => patch({ accessibility: value })} placeholder="Step-free entrance, accessible restroom…" rows={3} /></Field></div>}</section>; }
function CommunityStep({ draft, patch }: { draft: Draft; patch: (value: Partial<Draft>) => void }) { return <section><Intro kicker="COMMUNITY" title="Set the tone for participation." copy="Capture the practical details people need before they join or visit." /><div className="space-y-5"><Field label="Community rules"><Textarea value={draft.rules} onChange={(value) => patch({ rules: value })} placeholder="Be generous with beginners. Leave the wheel ready for the next person." rows={5} /></Field><label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"><input type="checkbox" checked={draft.rental} onChange={(event) => patch({ rental: event.target.checked })} className="mt-1 accent-[var(--accent)]" /><span><span className="block text-sm">Enable “Rent this Space”</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Booking and payment integration will be added through the existing provider later. This only records the owner’s intent in the draft.</span></span></label>{draft.rental && <div className="grid gap-5 sm:grid-cols-2"><Field label="Hourly price"><Input value={draft.hourlyPrice} onChange={(event) => patch({ hourlyPrice: event.target.value })} placeholder="$30" /></Field><Field label="Minimum duration"><Input value={draft.minimumDuration} onChange={(event) => patch({ minimumDuration: event.target.value })} /></Field></div>}</div></section>; }
function PreviewStep({ draft }: { draft: Draft }) { const tags = draft.interests.split(",").map((tag) => tag.trim()).filter(Boolean); return <section><Intro kicker="PREVIEW" title="Make sure it feels like yours." copy="This is how the Space will introduce itself. Publishing remains a protected integration point until persistence is connected." /><div className="overflow-hidden rounded-2xl border border-border bg-card"><div className="h-44 bg-[var(--surface-muted)]" style={draft.coverImage ? { backgroundImage: `url(${draft.coverImage})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} /><div className="p-6"><p className="ns-section-kicker">{draft.category} · {draft.mode}</p><h3 className="mt-3 text-4xl" style={{ fontFamily: "var(--font-serif)" }}>{draft.name || "Your Space"}</h3><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">{draft.description || "A place for the things you are bringing together."}</p><div className="mt-5 flex flex-wrap gap-2">{tags.map((tag) => <span key={tag} className="rounded-full border border-border px-3 py-1.5 text-xs">{tag}</span>)}</div><div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground"><span>{draft.location || "Online"}</span><span>{draft.rental ? "Rental enabled" : "Community Space"}</span></div></div></div></section>; }
