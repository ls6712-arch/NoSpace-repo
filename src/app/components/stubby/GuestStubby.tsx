import { useRef } from "react";
import { PageShell } from "../layout/PageShell";
import { StubbyStage, type StubbyStageHandle } from "../calendar/StubbyStage";
import { StubbyAccessProvider, useStubbyAccess } from "../../context/StubbyAccess";
import { ASK_COPY } from "../../lib/calendarCopy";

/**
 * Stubby for a signed-out visitor (guest brief §1 and §2): the same stage, field, quick ideas and
 * picks a member gets, with no sign-up first. Making a plan, bringing someone and follow-ups need
 * an account, so they open the sign-up sheet naming what was tried. Nothing on the page is
 * covered or blurred.
 */
export function GuestStubby() {
  return (
    <StubbyAccessProvider guest>
      <GuestStage />
    </StubbyAccessProvider>
  );
}

function GuestStage() {
  const stage = useRef<StubbyStageHandle>(null);
  const access = useStubbyAccess();
  return (
    <PageShell title={ASK_COPY.button}>
      <StubbyStage
        ref={stage}
        greeting={{ now: Date.now(), windows: [], plans: [] }}
        onMakePlans={async () => {
          access.gate("plan");
          return [];
        }}
        onBring={() => access.gate("plan")}
      />
    </PageShell>
  );
}
