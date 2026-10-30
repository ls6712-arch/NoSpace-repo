import { Link } from "react-router";
import { MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { pluralWord } from "../../lib/plural";

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

export function Identity({
  name,
  avatarUrl,
  neighborhood,
  bio,
  addDetailsLink,
}: {
  name: string;
  avatarUrl: string | null;
  neighborhood?: string | null;
  bio?: string | null;
  /** Owner with no neighborhood and no bio gets one link to fill them in. */
  addDetailsLink?: boolean;
}) {
  const empty = !neighborhood && !bio;
  return (
    <div className="flex flex-col gap-2">
      <Avatar className="size-[84px]">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="text-title font-bold">{initials(name)}</AvatarFallback>
      </Avatar>
      <h1 className="font-[family-name:var(--font-display)] text-title font-bold">{name}</h1>
      {neighborhood && (
        <p className="flex items-center gap-1 text-small text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          {neighborhood}
        </p>
      )}
      {bio && <p className="text-small text-foreground">{bio}</p>}
      {addDetailsLink && empty && (
        <Link to="/profile" className="inline-flex min-h-11 items-center text-small font-medium text-accent-text underline-offset-4 hover:underline">
          Add your neighborhood and a short bio
        </Link>
      )}
    </div>
  );
}

export function StatsRow({
  stubs,
  pursuits,
  friends,
  onFriends,
}: {
  stubs: number;
  pursuits: number;
  friends: number;
  /** Owner: opens the friends list. Others see the number only. */
  onFriends?: () => void;
}) {
  const cell = "flex min-h-11 flex-col items-start";
  const item = (n: number, one: string, many?: string) => (
    <>
      <span className="text-lead font-bold">{n.toLocaleString("en-US")}</span>
      <span className="text-caption text-muted-foreground">{pluralWord(n, one, many)}</span>
    </>
  );
  return (
    <div className="flex gap-6">
      <div className={cell}>{item(stubs, "Stub")}</div>
      <div className={cell}>{item(pursuits, "Pursuit")}</div>
      {onFriends ? (
        <button type="button" onClick={onFriends} className={`${cell} rounded-control text-left focus-visible:ring-[3px] focus-visible:outline-1`}>
          {item(friends, "Friend")}
        </button>
      ) : (
        <div className={cell}>{item(friends, "Friend")}</div>
      )}
    </div>
  );
}
