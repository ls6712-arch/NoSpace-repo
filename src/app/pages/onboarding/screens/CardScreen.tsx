import { useEffect, useRef, useState } from "react";
import { AvatarPicker } from "../../../components/AvatarPicker";
import { MemberCard } from "../../../components/onboarding/MemberCard";
import { PillButton } from "../../../components/ui/PillButton";
import { supabase } from "../../../../lib/supabase";
import { useAuth } from "../../../context/AuthContext";
import { formatMonthYear } from "../../../lib/dates";
import { firstName } from "../../../lib/tasteModel";
import { useOnboarding } from "../OnboardingContext";
import { StepStubby } from "../StepStubby";
import { ScreenFrame } from "./ScreenFrame";

/** The person's own member number: the one thing they cannot choose, and the one function that can read it. */
async function fetchMemberNo(): Promise<number | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("my_member_no");
    return error || typeof data !== "number" ? null : data;
  } catch {
    return null;
  }
}

/**
 * Screen 10: "Put a face on your card". The member card shows their number,
 * first name and when they joined. The photo circle and "Add a photo" both
 * open the photo picker (AvatarPicker, with no buttons of its own here). Once
 * there is a photo the button reads Next. Later is always there, the same size.
 */
export function CardScreen() {
  const { next, react } = useOnboarding();
  const { user, profile, refreshProfile } = useAuth();
  const [number, setNumber] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | undefined>(profile?.avatar_url);
  const openPicker = useRef<(() => void) | null>(null);
  const name = firstName(profile?.display_name ?? "") || "You";

  useEffect(() => {
    let live = true;
    void fetchMemberNo().then((n) => live && setNumber(n));
    return () => {
      live = false;
    };
  }, []);

  const onPhoto = (url: string | undefined) => {
    setPhoto(url);
    // AvatarPicker has already saved it; the shared profile catches up so the header and Home show it too.
    void refreshProfile();
    if (url) react("stamped");
  };

  return (
    <ScreenFrame
      title="Put a face on your card"
      hero={<StepStubby size={110} />}
      footer={
        <>
          <PillButton data-variant="primary" className="ob-button w-full min-h-14" onClick={() => (photo ? next() : openPicker.current?.())}>
            {photo ? "Next" : "Add a photo"}
          </PillButton>
          <PillButton data-variant="plain" className="ob-button w-full min-h-14" variant="outline" onClick={() => next()}>
            Later
          </PillButton>
        </>
      }
    >
      <div className="px-2 pt-2">
        <MemberCard
          number={number}
          name={name}
          joined={user?.created_at ? formatMonthYear(user.created_at) : ""}
          photoUrl={photo}
          onPhoto={() => openPicker.current?.()}
        />
      </div>
      <AvatarPicker headless openRef={openPicker} name={profile?.display_name ?? name} url={photo} onChange={onPhoto} />
    </ScreenFrame>
  );
}
