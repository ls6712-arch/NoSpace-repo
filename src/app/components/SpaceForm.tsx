import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Camera, ImagePlus, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { createSpace, updateSpace, setSpaceCorners, type SpaceRow } from "../lib/spaces";
import { CornerTagField } from "./CornerTagField";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

function slugify(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

type CornerPick = { spaceSlug: string; slug: string; name: string } | null;

/** Shared by CreateSpace and EditSpace. The slug is create-only — a stable
 * identifier once a Space exists (update_space doesn't take one at all) —
 * but Corners are editable in both modes: create_space links them at
 * creation, and an edit-mode save calls set_space_corners (host-only,
 * 1-3 ids, delete+insert in one transaction) rather than writing
 * space_corners directly — that table has no client-writable policy of
 * its own anymore. */
export function SpaceForm({
  mode,
  space,
  initialCorners,
  initialAddress,
}: {
  mode: "create" | "edit";
  space?: SpaceRow;
  /** Edit mode only — the Space's currently-linked Corners, primary first. */
  initialCorners?: { spaceSlug: string; slug: string; name: string }[];
  /** Edit mode only — the current exact address, if any. */
  initialAddress?: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(space?.name ?? "");
  const [slug, setSlug] = useState(space?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState(space?.description ?? "");
  const [coverImage, setCoverImage] = useState(space?.cover_image ?? "");
  const [uploading, setUploading] = useState(false);
  const [meets, setMeets] = useState<"in_person" | "online" | "both">(space?.meets ?? "online");
  const [neighborhood, setNeighborhood] = useState(space?.neighborhood ?? "");
  const [city, setCity] = useState(space?.city ?? "");
  const [exactAddress, setExactAddress] = useState(initialAddress ?? "");
  const [access, setAccess] = useState<"open" | "closed">(space?.access ?? "open");
  const [memberCap, setMemberCap] = useState(space?.member_cap ? String(space.member_cap) : "");
  const [postingMode, setPostingMode] = useState<"immediate" | "approval">(space?.posting_mode ?? "immediate");
  const [eventsCreatedBy, setEventsCreatedBy] = useState<"hosts" | "members">(space?.events_created_by ?? "hosts");
  const [rules, setRules] = useState(space?.rules ?? "");
  const [corners, setCorners] = useState<[CornerPick, CornerPick, CornerPick]>([
    initialCorners?.[0] ?? null,
    initialCorners?.[1] ?? null,
    initialCorners?.[2] ?? null,
  ]);
  const [cornerSlots, setCornerSlots] = useState(Math.max(1, initialCorners?.length ?? 1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; cover?: string; location?: string; corners?: string }>({});

  const needsLocation = meets === "in_person" || meets === "both";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const uploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supabase || !user) return;
    setUploading(true);
    setError(null);
    const dot = file.name.lastIndexOf(".");
    const ext = (dot > -1 ? file.name.slice(dot + 1) : "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
    const path = `${user.id}/spaces/${Date.now()}.${ext || "jpg"}`;
    const { error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(path, file, { contentType: file.type || undefined, upsert: false });
    if (uploadError) {
      setError(`That photo didn't upload: ${uploadError.message}`);
      setUploading(false);
      return;
    }
    setCoverImage(supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  };

  async function resolveCornerIds(): Promise<number[] | null> {
    const picked = corners.slice(0, cornerSlots).filter((c): c is NonNullable<CornerPick> => !!c);
    if (picked.length === 0) return [];
    if (!supabase) return null;
    const ids: number[] = [];
    for (const c of picked) {
      const { data } = await supabase
        .from("corners")
        .select("id")
        .eq("space_slug", c.spaceSlug)
        .eq("slug", c.slug)
        .maybeSingle();
      if (!data) {
        setError(`Couldn't find the Corner "${c.name}" — try picking it again.`);
        return null;
      }
      ids.push(data.id as number);
    }
    return ids;
  }

  // A blocklisted name is worded the same everywhere this class of error
  // can surface, regardless of which RPC raised it.
  function friendlyError(message: string) {
    return message === "That name isn't available." ? "That name isn't allowed." : message;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);

    const errors: typeof fieldErrors = {};
    if (!name.trim()) errors.name = "Give your Space a name.";
    if (!coverImage) errors.cover = "Add a cover photo.";
    if (needsLocation && (!neighborhood.trim() || !city.trim())) {
      errors.location = "Needed for an in-person Space.";
    }
    if (corners.slice(0, cornerSlots).filter(Boolean).length === 0) {
      errors.corners = "Pick 1-3 Corners.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    const cap = memberCap.trim() ? Number(memberCap) : undefined;

    const cornerIds = await resolveCornerIds();
    if (cornerIds === null) {
      setSaving(false);
      return;
    }

    if (mode === "create") {
      const finalSlug = slug.trim() || slugify(name);
      const { error: err } = await createSpace({
        slug: finalSlug,
        name: name.trim(),
        description: description.trim(),
        coverImage,
        meets,
        access,
        postingMode,
        eventsCreatedBy,
        cornerIds,
        neighborhood: needsLocation ? neighborhood.trim() : undefined,
        city: needsLocation ? city.trim() : undefined,
        memberCap: cap,
        rules: rules.trim() || undefined,
        exactAddress: exactAddress.trim() || undefined,
      });
      setSaving(false);
      if (err) return setError(friendlyError(err));
      navigate(`/space/${finalSlug}`);
    } else {
      if (!space) return;
      const { error: err } = await updateSpace({
        spaceId: space.id,
        name: name.trim(),
        description: description.trim(),
        coverImage,
        meets,
        access,
        postingMode,
        eventsCreatedBy,
        neighborhood: needsLocation ? neighborhood.trim() : undefined,
        city: needsLocation ? city.trim() : undefined,
        memberCap: cap,
        rules: rules.trim() || undefined,
        exactAddress: exactAddress.trim() || undefined,
        clearAddress: !exactAddress.trim() && !!initialAddress,
      });
      if (err) {
        setSaving(false);
        return setError(friendlyError(err));
      }
      const { error: cornersErr } = await setSpaceCorners(space.id, cornerIds);
      setSaving(false);
      if (cornersErr) return setError(`Space saved, but Corners couldn't be updated: ${cornersErr}`);
      navigate(`/space/${space.slug}`);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-8">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-serif)" }}>
        {mode === "create" ? "Create a Space" : "Edit Space"}
      </h1>

      <div>
        <Label>Cover photo <span className="text-destructive">*</span></Label>
        <div className="mt-2">
          {coverImage ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border">
              <img src={coverImage} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverImage("")}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white"
                aria-label="Remove cover photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:border-foreground/30"
            >
              {uploading ? "Uploading…" : (
                <>
                  <ImagePlus className="size-5" />
                  Add a cover photo
                </>
              )}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadCover} />
        </div>
        {fieldErrors.cover && <p className="mt-1 text-xs text-destructive">{fieldErrors.cover}</p>}
      </div>

      <div>
        <Label htmlFor="space-name">Name <span className="text-destructive">*</span></Label>
        <Input
          id="space-name"
          value={name}
          maxLength={80}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="The Clay Collective"
        />
        {fieldErrors.name && <p className="mt-1 text-xs text-destructive">{fieldErrors.name}</p>}
      </div>

      {mode === "create" && (
        <div>
          <Label htmlFor="space-slug">URL</Label>
          <div className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="truncate">{origin}/#/space/</span>
            <Input
              id="space-slug"
              value={slug}
              maxLength={48}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="w-auto flex-1"
            />
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="space-description">Description</Label>
        <Textarea
          id="space-description"
          value={description}
          maxLength={100}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this Space about?"
        />
      </div>

      <div>
        <Label>Corners (1-3) <span className="text-destructive">*</span></Label>
        <div className="mt-2 space-y-3">
          {Array.from({ length: cornerSlots }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <CornerTagField
                  value={corners[i]?.slug ?? ""}
                  onChange={(pickedSlug, pickedName, resolvedSpaceSlug) => {
                    setCorners((prev) => {
                      const next = [...prev] as typeof prev;
                      next[i] = pickedSlug ? { slug: pickedSlug, name: pickedName, spaceSlug: resolvedSpaceSlug } : null;
                      return next;
                    });
                  }}
                />
              </div>
              {i > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCorners((prev) => {
                      const next = [...prev] as typeof prev;
                      next[i] = null;
                      return next;
                    });
                    setCornerSlots((n) => Math.max(1, n - 1));
                  }}
                  className="mt-2 text-muted-foreground hover:text-foreground"
                  aria-label="Remove this Corner"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {cornerSlots < 3 && (
          <button
            type="button"
            onClick={() => setCornerSlots((n) => Math.min(3, n + 1))}
            className="mt-2 text-xs text-[var(--coral-text)]"
          >
            + Add another Corner
          </button>
        )}
        {fieldErrors.corners && <p className="mt-1 text-xs text-destructive">{fieldErrors.corners}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground">
          The first Corner is this Space's primary one.
        </p>
      </div>

      <div>
        <Label>Meets</Label>
        <Select value={meets} onValueChange={(v) => setMeets(v as typeof meets)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="in_person">In person</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {needsLocation && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="space-neighborhood">Neighborhood <span className="text-destructive">*</span></Label>
              <Input id="space-neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="space-city">City <span className="text-destructive">*</span></Label>
              <Input id="space-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          {fieldErrors.location && <p className="mt-1 text-xs text-destructive">{fieldErrors.location}</p>}
        </div>
      )}

      {needsLocation && (
        <div>
          <Label htmlFor="space-address">Exact address (optional)</Label>
          <Input
            id="space-address"
            value={exactAddress}
            onChange={(e) => setExactAddress(e.target.value)}
            placeholder="Only shown to members and RSVP'd guests"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Never shown publicly — only to members, or a specific event's RSVPs.
          </p>
        </div>
      )}

      <div>
        <Label>Who can join</Label>
        <Select value={access} onValueChange={(v) => setAccess(v as typeof access)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open — anyone can join</SelectItem>
            <SelectItem value="closed">Closed — hosts approve requests</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="space-cap">Member cap (optional)</Label>
        <Input
          id="space-cap"
          type="number"
          min={1}
          value={memberCap}
          onChange={(e) => setMemberCap(e.target.value)}
          placeholder="No limit"
        />
      </div>

      <div>
        <Label>Moments posted here</Label>
        <Select value={postingMode} onValueChange={(v) => setPostingMode(v as typeof postingMode)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Show right away</SelectItem>
            <SelectItem value="approval">A host approves first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Who can create events</Label>
        <Select value={eventsCreatedBy} onValueChange={(v) => setEventsCreatedBy(v as typeof eventsCreatedBy)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="hosts">Hosts only</SelectItem>
            <SelectItem value="members">Any member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="space-rules">Rules (optional)</Label>
        <Textarea id="space-rules" value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Anything members should know" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" variant="coral" disabled={saving || uploading}>
          {saving ? "Saving…" : mode === "create" ? "Create Space" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
