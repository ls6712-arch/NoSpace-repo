import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { SectionHeader } from "../ui/section-header";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { SettingsPanel, SettingsRow } from "./SettingsRow";

function ComingSoonDialog({
  open,
  onOpenChange,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-serif)" }}>{title}</DialogTitle>
          <DialogDescription>
            This is coming soon and isn't built yet — nothing happens if you select it.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export function PauseOrLeaveSection() {
  const { user, signOut } = useAuth();
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section>
      <SectionHeader n={6} eyebrow="PAUSE OR LEAVE" title="Pause or leave" />
      <p className="mb-4 text-sm text-muted-foreground">
        Step back for a while, or leave for good. Neither is built yet.
      </p>
      <SettingsPanel>
        <SettingsRow label="Pause your account" description="Hide your work until you come back.">
          <Button variant="outline" size="sm" onClick={() => setPauseOpen(true)}>
            Pause
          </Button>
        </SettingsRow>
        <SettingsRow label="Delete your account" description="Permanently remove your account and your work.">
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </SettingsRow>
        {user && (
          <SettingsRow label="Log out" description="Sign out of this device.">
            <Button variant="outline" size="sm" onClick={() => void signOut()}>
              Log out
            </Button>
          </SettingsRow>
        )}
      </SettingsPanel>

      <ComingSoonDialog open={pauseOpen} onOpenChange={setPauseOpen} title="Pausing is coming soon" />
      <ComingSoonDialog open={deleteOpen} onOpenChange={setDeleteOpen} title="Account deletion is coming soon" />
    </section>
  );
}
