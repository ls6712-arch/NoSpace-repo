import { useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { notify, notifyError } from "../ui/toaster";
import { DROP_COPY } from "../../lib/dropCopy";
import { shareStub } from "../../lib/stubShareImage";
import type { StubFace } from "../../lib/stubFace";
import { firstName } from "../../lib/tasteModel";

/** Share one of your own Stubs as a story image, with your first name on it. Says so when it was saved instead, or could not be made. */
export function useShareStub(): (face: StubFace) => Promise<void> {
  const { profile } = useAuth();
  const name = firstName(profile?.display_name ?? "");
  return useCallback(
    async (face: StubFace) => {
      const outcome = await shareStub(face, name);
      if (outcome === "saved") notify(DROP_COPY.imageSaved);
      else if (outcome === "failed") notifyError(DROP_COPY.imageFailed);
    },
    [name],
  );
}
