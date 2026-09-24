import { SettingsShell } from "../components/settings/SettingsShell";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { ProfileSection } from "../components/settings/ProfileSection";
import { AccountSection } from "../components/settings/AccountSection";
import { PrivacySection } from "../components/settings/PrivacySection";
import { DataSection } from "../components/settings/DataSection";
import { PauseOrLeaveSection } from "../components/settings/PauseOrLeaveSection";

/**
 * One shell (SettingsShell), six section routes. /settings itself is the
 * mobile index / desktop Appearance-by-default; the other five are their
 * own top-level routes per the redesign spec (/profile, /account,
 * /privacy, /data, /pause-or-leave — not nested under /settings/*, only
 * Appearance is).
 */
export function Settings() {
  return (
    <SettingsShell activeKey="appearance" isIndexRoute>
      <AppearanceSection />
    </SettingsShell>
  );
}

export function AppearanceSettingsPage() {
  return (
    <SettingsShell activeKey="appearance">
      <AppearanceSection />
    </SettingsShell>
  );
}

export function ProfileSettingsPage() {
  return (
    <SettingsShell activeKey="profile">
      <ProfileSection />
    </SettingsShell>
  );
}

export function AccountSettingsPage() {
  return (
    <SettingsShell activeKey="account">
      <AccountSection />
    </SettingsShell>
  );
}

export function PrivacySettingsPage() {
  return (
    <SettingsShell activeKey="privacy">
      <PrivacySection />
    </SettingsShell>
  );
}

export function DataSettingsPage() {
  return (
    <SettingsShell activeKey="data">
      <DataSection />
    </SettingsShell>
  );
}

export function PauseOrLeaveSettingsPage() {
  return (
    <SettingsShell activeKey="pause-or-leave">
      <PauseOrLeaveSection />
    </SettingsShell>
  );
}
