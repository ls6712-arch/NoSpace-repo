import { Link } from "react-router";
import { getHobby } from "../data/hobbies";
import { profilePath, type Person } from "../lib/people";
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
 * A person, described by what they work on — never by how many people follow
 * them. There is no count on this card and no button that would create one:
 * you tap through to their work, and everything you can do from there is a
 * way of being part of something specific.
 */
export function PersonCard({ person, className = "" }: { person: Person; className?: string }) {
  const hobbies = person.hobbyKeys
    .map((key) => getHobby(key)?.shortName)
    .filter((n): n is string => !!n)
    .slice(0, 3);

  return (
    <Link
      to={profilePath(person)}
      className={`flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--coral-deep)] ${className}`}
    >
      <Avatar className="size-11 shrink-0">
        {person.avatarUrl && <AvatarImage src={person.avatarUrl} alt="" />}
        <AvatarFallback className="text-xs">{initials(person.displayName)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm" style={{ fontFamily: "var(--font-serif)" }}>
          {person.displayName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {hobbies.length > 0
            ? hobbies.join(" · ")
            : person.postCount > 0
              ? "Sharing work on NoSpace"
              : "Just joined, nothing shared yet"}
        </span>
      </span>
    </Link>
  );
}

/** A row of people, used under a Space and in search results. */
export function PeopleRow({
  people,
  className = "",
}: {
  people: Person[];
  className?: string;
}) {
  return (
    <ul className={`grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
      {people.map((person) => (
        <li key={person.id}>
          <PersonCard person={person} />
        </li>
      ))}
    </ul>
  );
}
