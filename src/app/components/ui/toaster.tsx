import { Toaster as SonnerToaster, toast } from "sonner";
import { useTheme } from "../../context/ThemeContext";
import { TRY_AGAIN } from "../../lib/stateCopy";

/**
 * Quiet confirmations: one short line at the bottom, gone in a few
 * seconds. No icons, no confetti. Mounted once in App.
 */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <SonnerToaster
      theme={resolvedTheme}
      position="bottom-center"
      duration={2500}
      visibleToasts={2}
      offset={{ bottom: 88 }}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-btn border border-border bg-card px-4 py-3 text-sm text-foreground shadow-md",
          error: "border-destructive/40",
          icon: "hidden",
          actionButton: "ml-auto shrink-0 text-sm font-medium text-accent hover:underline",
        },
      }}
    />
  );
}

/** A quiet confirmation ("Changes saved", "Link copied"). */
export function notify(message: string) {
  toast(message);
}

/** A failure that isn't tied to a form on screen (e.g. a rolled-back Love this). */
export function notifyError(message: string, retry?: () => void, retryLabel = TRY_AGAIN) {
  toast.error(message, retry ? { action: { label: retryLabel, onClick: retry } } : undefined);
}
