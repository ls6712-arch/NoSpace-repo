import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, Check, Settings as SettingsIcon, Share2 } from "lucide-react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { useAuth } from "../context/AuthContext";
import { fetchProfile, isClosed, resolveHandle, type FollowState, type FriendProfile, type OpenProfileDto, type OwnerProfile, type ProfileDto } from "../lib/profileApi";
import { follow, unfollow } from "../lib/profileFollows";
import { firstName, mutualFriendsLine } from "../lib/profileFormat";
import { youBothSentence } from "../lib/youBoth";
import { ERROR_LINE } from "../lib/stateCopy";
import { Button } from "../components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ErrorNotice } from "../components/StateViews";
import { FollowListDialog } from "../components/FollowListDialog";
import { SignUpPrompt } from "../components/SignUpPrompt";
import { notify, notifyError } from "../components/ui/toaster";
import { cn } from "../components/ui/utils";
import { Identity, StatsRow } from "../components/profile/Identity";
import { LevelCard, LevelCardCompact } from "../components/profile/LevelCard";
import { MomentsPane } from "../components/profile/MomentsPane";
import { StubsPane } from "../components/profile/StubsPane";
import { PursuitsPane } from "../components/profile/PursuitsPane";
import { PickPursuits } from "../components/profile/PickPursuits";
import { PlanningCard } from "../components/profile/PlanningCard";
import { PlanTogetherSheet } from "../components/profile/PlanTogetherSheet";
import { ProfileMenu } from "../components/profile/ProfileMenu";
import { IdentitySkeleton, LevelSkeleton } from "../components/profile/Skeletons";
import { NotFound } from "./NotFound";

const TABS = [
  { value: "moments", label: "Moments" },
  { value: "stubs", label: "Stubs" },
  { value: "pursuits", label: "Pursuits" },
] as const;
type TabValue = (typeof TABS)[number]["value"];

type Load = { status: "loading" } | { status: "error" } | { status: "missing" } | { status: "ready"; profile: ProfileDto };

function Tabs({ profile, owner, rev, onPursuitsChanged }: { profile: OpenProfileDto; owner: boolean; rev: number; onPursuitsChanged: () => void }) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: TabValue = TABS.some((t) => t.value === raw) ? (raw as TabValue) : "moments";
  return (
    <TabsPrimitive.Root
      value={tab}
      onValueChange={(v) =>
        setParams((p) => {
          const next = new URLSearchParams(p);
          next.set("tab", v);
          return next;
        }, { replace: true })
      }
    >
      <TabsPrimitive.List aria-label="Profile" className="mb-4 grid grid-cols-3 border-b border-border">
        {TABS.map((t) => (
          <TabsPrimitive.Trigger
            key={t.value}
            value={t.value}
            className="min-h-11 border-b-2 border-transparent text-small font-semibold text-muted-foreground transition-colors focus-visible:ring-[3px] focus-visible:outline-1 data-[state=active]:border-accent data-[state=active]:text-foreground"
          >
            {t.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      <TabsPrimitive.Content value="moments" className="outline-none"><MomentsPane profileId={profile.id} owner={owner} /></TabsPrimitive.Content>
      <TabsPrimitive.Content value="stubs" className="outline-none"><StubsPane profileId={profile.id} owner={owner} /></TabsPrimitive.Content>
      <TabsPrimitive.Content value="pursuits" className="outline-none"><PursuitsPane key={rev} profileId={profile.id} owner={owner} onChanged={onPursuitsChanged} /></TabsPrimitive.Content>
    </TabsPrimitive.Root>
  );
}

function YouBoth({ profile }: { profile: FriendProfile }) {
  const line = youBothSentence(profile.sharedCategories);
  if (!line) return null;
  return (
    <section aria-label="You both" className="rounded-card border border-border bg-surface-muted p-4">
      <p className="text-caption font-medium text-muted-foreground">You both</p>
      <p className="font-[family-name:var(--font-display)] text-lead font-bold">{line}</p>
    </section>
  );
}

function MutualLine({ profile }: { profile: FriendProfile }) {
  if (profile.mutualFriendCount === 0) return null;
  const shown = profile.mutualFriends.slice(0, 2);
  return (
    <p className="flex items-center gap-2 text-small text-muted-foreground">
      <span className="flex -space-x-2" aria-hidden="true">
        {shown.map((m) => (
          <Avatar key={m.id} className="size-6 border border-background">
            {m.avatarUrl && <AvatarImage src={m.avatarUrl} alt="" />}
            <AvatarFallback className="text-caption">{m.name.slice(0, 1)}</AvatarFallback>
          </Avatar>
        ))}
      </span>
      {mutualFriendsLine(profile.mutualFriends.map((m) => m.name), profile.mutualFriendCount)}
    </p>
  );
}

export function Profile() {
  const { username: param } = useParams();
  const { user, profile: me, isConfigured } = useAuth();
  const navigate = useNavigate();
  const username = param ?? me?.username;

  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [unfollowOpen, setUnfollowOpen] = useState(false);
  // The picker stays up once it has been shown, so more than one pill can be picked.
  const [pickerOn, setPickerOn] = useState(false);
  const [rev, setRev] = useState(0);
  const run = useRef(0);

  const fetchIt = useCallback(
    async (silent: boolean) => {
      if (!username) return;
      const mine = ++run.current;
      if (!silent) setLoad({ status: "loading" });
      const r = await fetchProfile(username);
      if (mine !== run.current) return;
      if (!r.ok) {
        if (!silent) setLoad({ status: "error" });
        return;
      }
      if (r.value && r.value.role === "owner" && !r.value.private && r.value.pursuitCount === 0) setPickerOn(true);
      if (!r.value && param) {
        // A link made from a display name: send it to the username it belongs to.
        const h = await resolveHandle(param);
        if (mine !== run.current) return;
        if (h.ok && h.value) {
          navigate(`/u/${encodeURIComponent(h.value)}`, { replace: true });
          return;
        }
      }
      setLoad(r.value ? { status: "ready", profile: r.value } : { status: "missing" });
    },
    [username, param, navigate],
  );

  useEffect(() => {
    void fetchIt(false);
    return () => {
      run.current++;
    };
  }, [fetchIt, user?.id]);

  if (isConfigured && !user && !param) {
    return <SignUpPrompt title="Your profile lives here" body="Make an account to log Moments and start Pursuits." cta="Create an account" />;
  }
  if (load.status === "missing") return <NotFound />;

  const shell = "mx-auto w-full max-w-[640px] px-5 pb-24 pt-4 desk:max-w-[1120px]";
  const grid = "flex flex-col gap-6 desk:grid desk:grid-cols-[360px_1fr] desk:gap-x-10";

  if (load.status === "loading") {
    return (
      <div className={shell} aria-busy="true">
        <div className={grid}>
          <div className="flex flex-col gap-6">
            <IdentitySkeleton />
            <LevelSkeleton />
          </div>
        </div>
      </div>
    );
  }
  if (load.status === "error") {
    return (
      <div className={shell}>
        <ErrorNotice onRetry={() => fetchIt(false)} />
      </div>
    );
  }

  const p = load.profile;
  const name = p.displayName;
  const first = firstName(name);
  const viewerId = user?.id;

  // Optimistic: show the new state now, put the old one back if it fails.
  const setFollowState = (state: FollowState) =>
    setLoad((cur) => (cur.status === "ready" ? { status: "ready", profile: { ...cur.profile, followState: state } as ProfileDto } : cur));
  const doFollow = async () => {
    if (!viewerId) {
      navigate("/login");
      return;
    }
    const before = p.followState;
    setFollowState("pending");
    const ok = await follow(viewerId, p.id);
    if (!ok) {
      setFollowState(before);
      notifyError(ERROR_LINE);
      return;
    }
    void fetchIt(true);
  };
  const doUnfollow = async () => {
    if (!viewerId) return;
    const before = p.followState;
    setFollowState("none");
    const ok = await unfollow(viewerId, p.id);
    if (!ok) {
      setFollowState(before);
      notifyError(ERROR_LINE);
      return;
    }
    void fetchIt(true);
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/#/u/${p.username}`);
      notify("Link copied");
    } catch {
      notifyError(ERROR_LINE);
    }
  };

  // A private account seen by a stranger: identity, level name, follow state.
  if (isClosed(p)) {
    return (
      <div className={shell}>
        <TopBar title={name} onBack={() => navigate(-1)} />
        <div className="flex flex-col gap-4">
          <Identity name={name} avatarUrl={p.avatarUrl} />
          <p className="text-small text-muted-foreground">{p.levelName}</p>
          <FollowButton state={p.followState} followsYou={false} onFollow={doFollow} onUnfollow={() => setUnfollowOpen(true)} />
          <p className="text-small text-muted-foreground">This profile is private.</p>
        </div>
        <UnfollowConfirm open={unfollowOpen} onOpenChange={setUnfollowOpen} name={name} onConfirm={doUnfollow} />
      </div>
    );
  }

  const owner = p.role === "owner";
  const ownerP = owner ? (p as OwnerProfile) : null;
  const friend = p.role === "friend" ? (p as FriendProfile) : null;

  return (
    <div className={shell}>
      {owner ? (
        <header className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-title font-bold">Profile</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" className="size-11" aria-label="Share" onClick={share}>
              <Share2 className="size-4" aria-hidden="true" />
            </Button>
            <Button asChild variant="outline" size="icon" className="size-11">
              <Link to="/settings" aria-label="Settings">
                <SettingsIcon className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </header>
      ) : (
        <TopBar
          title={name}
          onBack={() => navigate(-1)}
          menu={
            <ProfileMenu
              personId={p.id}
              personName={name}
              following={p.followState === "accepted"}
              onUnfollow={doUnfollow}
              onBlocked={() => navigate("/")}
            />
          }
        />
      )}

      <div className={grid}>
        <div className="flex flex-col gap-5 desk:col-start-1">
          <Identity name={name} avatarUrl={p.avatarUrl} neighborhood={p.neighborhood} bio={p.bio} addDetailsLink={owner} />
          {friend && <MutualLine profile={friend} />}
          {p.role === "follower" && p.mutualFriendCount > 0 && (
            <p className="text-small text-muted-foreground">{p.mutualFriendCount === 1 ? "1 friend in common" : `${p.mutualFriendCount} friends in common`}</p>
          )}
          <StatsRow stubs={p.stubCount} pursuits={p.pursuitCount} friends={p.friendCount} onFriends={owner ? () => setFriendsOpen(true) : undefined} />

          {owner ? (
            <div className="grid grid-cols-2 gap-3">
              <Button asChild variant="outline" className="min-h-11">
                <Link to="/profile">Edit profile</Link>
              </Button>
              <Button asChild className="min-h-11">
                <Link to="/create">Log a Moment</Link>
              </Button>
            </div>
          ) : friend ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_auto] gap-3">
                {friend.planningPaused ? (
                  <p className="flex min-h-11 items-center text-small text-muted-foreground">{first} isn’t taking plans right now</p>
                ) : (
                  <Button className="min-h-11" onClick={() => setPlanOpen(true)}>
                    Plan something together
                  </Button>
                )}
                <Button variant="outline" className="min-h-11" onClick={() => setUnfollowOpen(true)}>
                  <Check className="size-4" aria-hidden="true" />
                  Friends
                </Button>
              </div>
              <YouBoth profile={friend} />
            </div>
          ) : (
            <FollowButton state={p.followState} followsYou={"followsYou" in p && p.followsYou} onFollow={doFollow} onUnfollow={() => setUnfollowOpen(true)} />
          )}

          {ownerP ? <LevelCard stubCount={p.stubCount} stubsToNext={ownerP.stubsToNext} /> : <LevelCardCompact index={p.level.index} name={p.level.name} stubCount={p.stubCount} />}
          {ownerP && pickerOn && (
            <PickPursuits
              onChanged={() => {
                setRev((n) => n + 1);
                void fetchIt(true);
              }}
            />
          )}
        </div>

        <div className="desk:col-start-2 desk:row-span-2 desk:row-start-1">
          <Tabs profile={p} owner={owner} rev={rev} onPursuitsChanged={() => void fetchIt(true)} />
        </div>

        {owner && (
          <div className="desk:col-start-1">
            <PlanningCard />
          </div>
        )}
      </div>

      {owner && <FollowListDialog open={friendsOpen} onOpenChange={setFriendsOpen} profileId={p.id} initialTab="following" />}
      {friend && <PlanTogetherSheet open={planOpen} onOpenChange={setPlanOpen} friendId={p.id} firstName={first} />}
      <UnfollowConfirm open={unfollowOpen} onOpenChange={setUnfollowOpen} name={name} onConfirm={doUnfollow} />
    </div>
  );
}

function TopBar({ title, onBack, menu }: { title: string; onBack: () => void; menu?: React.ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-2">
      <Button variant="ghost" size="icon" className="size-11" aria-label="Back" onClick={onBack}>
        <ArrowLeft className="size-5" aria-hidden="true" />
      </Button>
      <p className="min-w-0 flex-1 truncate text-center text-body font-semibold">{title}</p>
      {menu ?? <span className="size-11" aria-hidden="true" />}
    </header>
  );
}

function FollowButton({ state, followsYou, onFollow, onUnfollow }: { state: FollowState; followsYou: boolean; onFollow: () => void; onUnfollow: () => void }) {
  if (state === "pending") {
    return <Button variant="outline" className="min-h-11 w-full" onClick={onUnfollow}>Requested</Button>;
  }
  if (state === "accepted") {
    return (
      <Button variant="outline" className={cn("min-h-11 w-full")} onClick={onUnfollow}>
        Following
      </Button>
    );
  }
  return (
    <Button className="min-h-11 w-full" onClick={onFollow}>
      {followsYou ? "Follow back" : "Follow"}
    </Button>
  );
}

function UnfollowConfirm({ open, onOpenChange, name, onConfirm }: { open: boolean; onOpenChange: (o: boolean) => void; name: string; onConfirm: () => void | Promise<void> }) {
  return <ConfirmDialog open={open} onOpenChange={onOpenChange} title={`Unfollow ${name}?`} confirmLabel="Unfollow" onConfirm={onConfirm} />;
}
