import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createEvent, updateEvent, type SpaceRow, type SpaceEventRow } from "../../lib/spaces";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type FieldErrors = { title?: string; startsAt?: string; location?: string };

/** Create or edit an event. In edit mode, `event`'s own values are the
 * starting point; in create mode, defaults come from the Space itself
 * (meets, neighborhood, city, exact address) — all still editable. */
export function CreateEventDialog({
  space,
  event,
  eventAddress,
  open,
  onOpenChange,
  onSaved,
}: {
  space: SpaceRow;
  /** Omit to create a new event. */
  event?: SpaceEventRow;
  /** Edit mode only — the event's current exact address, if any. */
  eventAddress?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const isEdit = !!event;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meets, setMeets] = useState<"in_person" | "online" | "both">("online");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [exactAddress, setExactAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const needsLocation = meets === "in_person" || meets === "both";
  const timezone = event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setError(null);
    if (event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setStartsAt(toLocalInput(event.starts_at));
      setEndsAt(event.ends_at ? toLocalInput(event.ends_at) : "");
      setMeets(event.meets);
      setNeighborhood(event.neighborhood ?? "");
      setCity(event.city ?? "");
      setExactAddress(eventAddress ?? "");
    } else {
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setMeets(space.meets === "online" ? "online" : space.meets);
      setNeighborhood(space.neighborhood ?? "");
      setCity(space.city ?? "");
      setExactAddress("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  const submit = async () => {
    if (saving) return;
    const errors: FieldErrors = {};
    if (!title.trim()) errors.title = "Give the event a title.";
    if (!startsAt) errors.startsAt = "Pick a start time.";
    else if (!isEdit && new Date(startsAt).getTime() <= Date.now()) errors.startsAt = "Must be in the future.";
    if (needsLocation && (!neighborhood.trim() || !city.trim())) {
      errors.location = "Needed for an in-person event.";
    }
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      timezone,
      meets,
      neighborhood: needsLocation ? neighborhood.trim() : undefined,
      city: needsLocation ? city.trim() : undefined,
      exactAddress: exactAddress.trim() || undefined,
    };
    const { error: err } = isEdit
      ? await updateEvent({ eventId: event.id, ...payload, clearAddress: !exactAddress.trim() && !!eventAddress })
      : await createEvent({ spaceId: space.id, ...payload });
    setSaving(false);
    if (err) return setError(err);
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>{isEdit ? "Edit event" : "Create an event"}</DialogTitle>
          <DialogDescription>Members of this Space will be able to RSVP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="event-title">Title <span className="text-destructive">*</span></Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            {fieldErrors.title && <p className="mt-1 text-xs text-destructive">{fieldErrors.title}</p>}
          </div>
          <div>
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea id="event-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event-starts">Starts <span className="text-destructive">*</span></Label>
              <Input id="event-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              {fieldErrors.startsAt && <p className="mt-1 text-xs text-destructive">{fieldErrors.startsAt}</p>}
            </div>
            <div>
              <Label htmlFor="event-ends">Ends (optional)</Label>
              <Input id="event-ends" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
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
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="event-neighborhood">Neighborhood <span className="text-destructive">*</span></Label>
                  <Input id="event-neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="event-city">City <span className="text-destructive">*</span></Label>
                  <Input id="event-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              {fieldErrors.location && <p className="text-xs text-destructive">{fieldErrors.location}</p>}
              <div>
                <Label htmlFor="event-address">Exact address (optional)</Label>
                <Input id="event-address" value={exactAddress} onChange={(e) => setExactAddress(e.target.value)} placeholder="Only shown to members and RSVP'd guests" />
              </div>
            </>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button variant="coral" size="sm" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create event"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
