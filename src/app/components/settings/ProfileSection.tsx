import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../../lib/supabase";
import { SectionHeader } from "../ui/section-header";
import { AvatarPicker } from "../AvatarPicker";
import { SettingsPanel } from "./SettingsRow";
import { EditableTextRow } from "./EditableTextRow";

function nameDismissKey(userId: string) {
  return `sushii-name-prompt-dismissed-${userId}`;
}

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
    <div className="mb-4 flex items-start justify-between gap-4 rounded-btn border border-accent/40 bg-accent/5 p-4">
      <p className="text-sm leading-relaxed">
        Is this how you'd like to be known? Your name is currently{" "}
        <span style={{ fontFamily: "var(--font-serif)" }}>"{emailPrefix}"</span> — taken from your
        email. You can change it below any time.
      </p>
      <button
        type="button"
        className="min-h-11 shrink-0 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
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

  if (!user || !profile) return null;

  const displayName = profile.display_name?.trim() ?? "";
  const emailPrefix = user.email?.split("@")[0]?.trim();
  const showEmailPrefixPrompt = !!emailPrefix && displayName === emailPrefix;

  return (
    <section>
      <SectionHeader n={2} eyebrow="PROFILE" title="Profile" />
      <p className="mb-4 text-sm text-muted-foreground">
        What people see on your work — your Shelf, your Studio, and anywhere you show up.
      </p>

      {showEmailPrefixPrompt && <EmailPrefixPrompt userId={user.id} emailPrefix={emailPrefix} />}

      <div className="mb-4 rounded-btn border border-border bg-card p-4 sm:p-5">
        <AvatarPicker
          name={displayName || "You"}
          url={avatar ?? profile.avatar_url}
          onChange={setAvatar}
        />
      </div>

      <SettingsPanel>
        <EditableTextRow
          label="Display name"
          description="Shown wherever your work appears."
          value={displayName}
          maxLength={60}
          required
          onSave={async (next) => {
            const { error } = await supabase!
              .from("profiles")
              .update({ display_name: next })
              .eq("id", user.id);
            if (!error) await refreshProfile();
            return { error: error?.message ?? null };
          }}
        />
        <EditableTextRow
          label="Bio"
          description="A short line under your name. Never required."
          value={profile.bio ?? ""}
          placeholder="What got you into this, and where it's going…"
          multiline
          maxLength={280}
          emptyLabel="Not set"
          onSave={async (next) => {
            const { error } = await supabase!
              .from("profiles")
              .update({ bio: next || null })
              .eq("id", user.id);
            if (!error) await refreshProfile();
            return { error: error?.message ?? null };
          }}
        />
      </SettingsPanel>
    </section>
  );
}
