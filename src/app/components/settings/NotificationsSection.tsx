import { useSettings, NotificationCategory } from "../../context/SettingsContext";
import { SectionHeader } from "../ui/section-header";
import { Switch } from "../ui/switch";
import { SettingsPanel, SettingsRow } from "./SettingsRow";

/** Labels shown here, kinds gated in the database — see
 * supabase/migrations/20261007000000_communication_phase5_notifications.sql
 * for exactly which notification kinds each category covers. */
const CATEGORY_ROWS: { category: NotificationCategory; label: string; description: string }[] = [
  {
    category: "thoughts",
    label: "Thoughts on your Moments",
    description: "Someone leaves a Thought on something you shared.",
  },
  {
    category: "pursuit_activity",
    label: "Pursuit activity",
    description: "Someone joins, invites you to, or logs progress on a Pursuit.",
  },
  {
    category: "make_together_explore_together",
    label: "Make together and Explore together",
    description: "Someone asks to make or explore together, accepts your request, or joins something you posted.",
  },
  {
    category: "message_requests",
    label: "Message requests",
    description: "Turning this off only stops the bell — the request still waits for you in Messages.",
  },
];

function CategoryRow({ category, label, description }: { category: NotificationCategory; label: string; description: string }) {
  const { mutedNotificationCategories, setNotificationCategoryMuted, notificationPrefsLoaded } = useSettings();
  const enabled = !mutedNotificationCategories[category];

  return (
    <SettingsRow label={label} description={description}>
      <Switch
        checked={enabled}
        onCheckedChange={(next) => void setNotificationCategoryMuted(category, !next)}
        disabled={!notificationPrefsLoaded}
        aria-label={label}
      />
    </SettingsRow>
  );
}

function CircleInvitesRow() {
  const { circleInviteNotificationsEnabled, setCircleInviteNotificationsEnabled, notificationPrefsLoaded } =
    useSettings();

  return (
    <SettingsRow label="Circle invitations" description="Someone invites you to join a Circle.">
      <Switch
        checked={circleInviteNotificationsEnabled}
        onCheckedChange={(next) => void setCircleInviteNotificationsEnabled(next)}
        disabled={!notificationPrefsLoaded}
        aria-label="Circle invitations"
      />
    </SettingsRow>
  );
}

export function NotificationsSection() {
  return (
    <section>
      <SectionHeader n={5} eyebrow="NOTIFICATIONS" title="Notifications" />
      <p className="mb-4 text-sm text-muted-foreground">
        Turning a type off stops new ones. It doesn't remove ones you already have.
      </p>
      <SettingsPanel>
        {CATEGORY_ROWS.map((row) => (
          <CategoryRow key={row.category} {...row} />
        ))}
        <CircleInvitesRow />
      </SettingsPanel>
    </section>
  );
}
