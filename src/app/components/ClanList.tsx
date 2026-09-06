import { Link } from "react-router";
import { UserPlus, Users } from "lucide-react";
import { useConnections } from "../context/ConnectionsContext";
import { useContent } from "../context/ContentContext";
import { profilePath } from "../lib/people";
import { pickPrimaryHobby } from "./ProfileHeadline";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Your Clan — the people you've actually connected with (an accepted
 * Connection, same data as the "Connect" action on PersonActions), shown as
 * faces rather than a settings-style list. What each of them makes is worked
 * out the same honest way the rest of the app derives a headline: whichever
 * hobby shows up most in their public posts.
 */
export function ClanList({ limit }: { limit?: number } = {}) {
  const { connectedPeople } = useConnections();
  const { posts } = useContent();

  if (connectedPeople.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
        <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
          Nobody in your Clan yet. Connect with someone from their profile once
          you're both making the same kind of thing.
        </p>
        <Link
          to="/discover?tab=people"
          className="mt-3 inline-block text-sm text-[var(--coral-text)] hover:underline"
        >
          Find people →
        </Link>
      </div>
    );
  }

  const shown = limit ? connectedPeople.slice(0, limit) : connectedPeople;

  return (
    <ul className="flex flex-wrap gap-5">
      {shown.map((person) => {
        const theirHobby = pickPrimaryHobby(
          posts.filter((p) => p.userId === person.id),
        );
        return (
          <li key={person.id}>
            <Link
              to={profilePath(person)}
              className="flex w-20 flex-col items-center gap-2 text-center transition-transform duration-200 hover:-translate-y-0.5"
            >
              <Avatar className="size-14">
                {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" className="object-cover" />}
                <AvatarFallback>{initials(person.displayName)}</AvatarFallback>
              </Avatar>
              <span className="w-full truncate text-xs text-foreground">{person.displayName}</span>
              {theirHobby && (
                <span className="w-full truncate text-[10px] text-muted-foreground">
                  {theirHobby.label.replace(/\b\w/g, (c) => c.toUpperCase())}
                </span>
              )}
            </Link>
          </li>
        );
      })}
      {!limit && (
        <li>
          <Link
            to="/discover?tab=people"
            className="flex w-20 flex-col items-center gap-2 text-center"
          >
            <span className="flex size-14 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground transition-colors hover:border-[var(--coral-deep)] hover:text-[var(--coral-text)]">
              <UserPlus className="size-5" strokeWidth={1.7} />
            </span>
            <span className="w-full truncate text-xs text-muted-foreground">Find people</span>
          </Link>
        </li>
      )}
    </ul>
  );
}

/** Icon used alongside "Your Clan" / "People They Make With" headings. */
export const ClanIcon = Users;
