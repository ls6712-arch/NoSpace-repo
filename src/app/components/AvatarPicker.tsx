import { useRef, useState } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

/**
 * A picture of you, or your initials. Both are fine — the initials are a real
 * choice here, not a placeholder someone failed to replace.
 *
 * Stored in the same bucket as post media, under an `avatars/` prefix, so
 * there's one bucket and one set of storage policies to keep straight.
 */
function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AvatarPicker({
  name,
  url,
  onChange,
  size = "size-20 sm:size-24",
}: {
  name: string;
  url?: string;
  onChange: (next: string | undefined) => void;
  size?: string;
}) {
  const { user } = useAuth();
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);

    // No account, or no backend: show it for this session rather than
    // pretending nothing happened.
    if (!supabase || !user) {
      onChange(URL.createObjectURL(file));
      setError("Not signed in — this picture stays in this browser.");
      setBusy(false);
      return;
    }

    const dot = file.name.lastIndexOf(".");
    const ext = (dot > -1 ? file.name.slice(dot + 1) : "jpg")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 5);
    const path = `${user.id}/avatars/${Date.now()}.${ext || "jpg"}`;

    const { error: uploadError } = await supabase.storage
      .from("post-media")
      .upload(path, file, { contentType: file.type || undefined, upsert: true });

    if (uploadError) {
      setError(`Couldn't upload that — ${uploadError.message}`);
      setBusy(false);
      return;
    }

    const publicUrl = supabase.storage.from("post-media").getPublicUrl(path).data.publicUrl;
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ avatar_url: publicUrl })
      .eq("id", user.id);

    if (saveError) setError(`Uploaded, but couldn't save it to your profile — ${saveError.message}`);
    else onChange(publicUrl);
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    if (supabase && user) {
      const { error: saveError } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", user.id);
      if (saveError) setError(saveError.message);
    }
    onChange(undefined);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-5">
      <Avatar className={`${size} shrink-0`}>
        {url && <AvatarImage src={url} alt="" className="object-cover" />}
        <AvatarFallback className="text-xl">{initials(name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={upload}
        />
        <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={upload} />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => libraryRef.current?.click()}
          >
            <ImagePlus className="size-3.5" />
            {url ? "Change photo" : "Upload photo"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="size-3.5" />
            Take photo
          </Button>
          {url && (
            <Button variant="outline" size="sm" disabled={busy} onClick={remove}>
              <Trash2 className="size-3.5" />
              Use initials
            </Button>
          )}
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {busy ? "Working…" : url ? "Shown wherever you appear." : `Showing your initials, ${initials(name)}.`}
        </p>
        {error && <p className="mt-1 text-xs text-[var(--coral-text)]">{error}</p>}
      </div>
    </div>
  );
}
