import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { createEvent } from "../../lib/spaces";

export function CreateEventDialog({
  spaceId,
  open,
  onOpenChange,
  onCreated,
}: {
  spaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meets, setMeets] = useState<"in_person" | "online" | "both">("online");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [exactAddress, setExactAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsLocation = meets === "in_person" || meets === "both";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const reset = () => {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setMeets("online");
    setNeighborhood("");
    setCity("");
    setExactAddress("");
    setError(null);
  };

  const submit = async () => {
    if (saving) return;
    setError(null);
    if (!title.trim()) return setError("Give the event a title.");
    if (!startsAt) return setError("Pick a start time.");
    if (needsLocation && (!neighborhood.trim() || !city.trim())) {
      return setError("An in-person event needs a neighborhood and city.");
    }
    setSaving(true);
    const { error: err } = await createEvent({
      spaceId,
      title: title.trim(),
      description: description.trim() || undefined,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      timezone,
      meets,
      neighborhood: needsLocation ? neighborhood.trim() : undefined,
      city: needsLocation ? city.trim() : undefined,
      exactAddress: exactAddress.trim() || undefined,
    });
    setSaving(false);
    if (err) return setError(err);
    reset();
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>Create an event</DialogTitle>
          <DialogDescription>Members of this Space will be able to RSVP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="event-title">Title</Label>
            <Input id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="event-description">Description (optional)</Label>
            <Textarea id="event-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event-starts">Starts</Label>
              <Input id="event-starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
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
                  <Label htmlFor="event-neighborhood">Neighborhood</Label>
                  <Input id="event-neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="event-city">City</Label>
                  <Input id="event-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
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
          <Button variant="coral" size="sm" onClick={submit} disabled={saving}>{saving ? "Creating…" : "Create event"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
