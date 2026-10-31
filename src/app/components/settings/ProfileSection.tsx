import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { SectionHeader } from "../ui/section-header";
import { AvatarPicker } from "../AvatarPicker";
import { SettingsPanel } from "./SettingsRow";
import { EditableTextRow } from "./EditableTextRow";
import { friendlyError } from "../../lib/friendlyError";
import { nameDismissKey } from "../../lib/displayName";
import { fetchProfile, saveProfileDetails, type OwnerProfile } from "../../lib/profileApi";
import { Switch } from "../ui/switch";
import { Label } from "../ui/label";


/** A signup with the email-prefix bug (fixed on this branch, but existing
 * accounts created before the fix still have it) ended up named after
 * their email. One-time, dismissible — never reappears once dismissed,
 * even if someone genuinely wants their email prefix as their name. */
function EmailPrefixPrompt({ userId, emailPrefix }: { userId: string; emailPrefix: string }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(nameDismissKey(userId)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [userId]);

  if (dismissed) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-4 rounded-control border border-accent/40 bg-accent/5 p-4">
      <p className="text-small leading-relaxed">
        Is this how you’d like to be known? Your name is currently{" "}
        <span style={{ fontFamily: "var(--font-serif)" }}>“{emailPrefix}”</span>, taken from your
        email. You can change it below any time.
      </p>
      <button
        type="button"
        className="min-h-11 shrink-0 text-caption text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        onClick={() => {
          try {
            localStorage.setItem(nameDismissKey(userId), "1");
          } catch {
            // Fine — it just asks again next visit.
          }
          setDismissed(true);
        }}
      >
        Got it
      </button>
    </div>
  );
}

export function ProfileSection() {
  const { user, profile, refreshProfile } = useAuth();
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  // neighborhood and the private-profile switch are not readable columns; the
  // owner's own profile read returns them.
  const [own, setOwn] = useState<OwnerProfile | null>(null);
  const username = profile?.username;
  useEffect(() => {
    if (!username) return;
    void fetchProfile(username).then((r) => {
      if (r.ok && r.value && r.value.role === "owner") setOwn(r.value);
    });
  }, [username]);

  if (!user || !profile) return null;

  const displayName = profile.display_name?.trim() ?? "";
  const emailPrefix = user.email?.split("@")[0]?.trim();
  const showEmailPrefixPrompt = !!emailPrefix && displayName === emailPrefix;

  return (
    <section>
      <SectionHeader n={2} eyebrow="PROFILE" title="Profile" />
      <p className="mb-4 text-small text-muted-foreground">
        What people see on your profile and anywhere you show up.
      </p>

      {showEmailPrefixPrompt && <EmailPrefixPrompt userId={user.id} emailPrefix={emailPrefix} />}

      <div className="mb-4 rounded-control border border-border bg-card p-4 tab:p-5">
        <AvatarPicker
          name={displayName || "You"}
          url={avatar ?? profile.avatar_url}
          onChange={setAvatar}
        />
      </div>

      <SettingsPanel>
        <EditableTextRow
          label="Display name"
          description="Shown wherever your Moments appear."
          value={displayName}
          maxLength={60}
          required
          onSave={async (next) => {
            const { error } = await supabase!
              .from("profiles")
              .update({ display_name: next })
              .eq("id", user.id);
            if (!error) await refreshProfile();
            return { error: error ? friendlyError(error) : null };
          }}
        />
        <EditableTextRow
          label="Bio"
          description="A short line under your name (optional)."
          value={profile.bio ?? ""}
          placeholder="What got you into this, and where it’s going"
          multiline
          maxLength={120}
          emptyLabel="Not set"
          onSave={async (next) => {
            const { error } = await supabase!
              .from("profiles")
              .update({ bio: next || null })
              .eq("id", user.id);
            if (!error) await refreshProfile();
            return { error: error ? friendlyError(error) : null };
          }}
        />
        <EditableTextRow
          label="Neighborhood"
          description="Shown under your name, like Greenpoint, Brooklyn."
          value={own?.neighborhood ?? ""}
          maxLength={80}
          emptyLabel="Not set"
          onSave={async (next) => {
            const r = await saveProfileDetails(next, profile.bio ?? "", own?.isPrivate ?? false);
            if (r.ok) setOwn((cur) => (cur ? { ...cur, neighborhood: next || null } : cur));
            return { error: r.ok ? null : r.message };
          }}
        />
        <div className="flex items-center justify-between gap-4 px-4 py-3 tab:px-5">
          <div>
            <Label htmlFor="private-profile" className="text-small font-medium">Private profile</Label>
            <p className="text-caption text-muted-foreground">People who don’t follow you see only your name and level.</p>
          </div>
          <Switch
            id="private-profile"
            checked={own?.isPrivate ?? false}
            disabled={!own}
            onCheckedChange={async (next) => {
              if (!own) return;
              const before = own;
              setOwn({ ...own, isPrivate: next });
              const r = await saveProfileDetails(own.neighborhood ?? "", profile.bio ?? "", next);
              if (!r.ok) setOwn(before);
            }}
          />
        </div>
      </SettingsPanel>
    </section>
  );
}
