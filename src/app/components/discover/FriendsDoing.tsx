import { Link } from "react-router";
import { SnapCarousel } from "../ui/SnapCarousel";
import { PersonAvatar } from "../../pages/CreatePursuit";
import type { FriendPursuit } from "../../lib/friendPursuits";

/** "Your friends are doing": a carousel of Pursuits people you follow share. Hidden when there are none. */
export function FriendsDoing({ pursuits }: { pursuits: readonly FriendPursuit[] }) {
  if (pursuits.length === 0) return null;
  return (
    <section aria-labelledby="friends-doing" className="flex flex-col gap-4">
      <h2 id="friends-doing" className="font-[family-name:var(--font-display)] text-title font-bold">
        Your friends are doing
      </h2>
      <SnapCarousel
        name="discover.friends"
        label="Your friends are doing"
        items={pursuits}
        getKey={(p) => p.id}
        itemClassName="w-[calc(100%-3.5rem)] sm:w-64"
        renderItem={(p) => (
          <Link to={`/pursuit/${p.id}`} className="flex h-full flex-col gap-3 rounded-card bg-card p-4">
            <PersonAvatar name={p.ownerName} src={p.ownerAvatar} size="size-10" />
            <div className="min-w-0">
              <p className="truncate text-body font-semibold">{`${p.ownerName.slice(0, 60)} · ${p.what.slice(0, 80)}`}</p>
              {p.progress && <p className="text-small text-muted-foreground">{p.progress}</p>}
            </div>
          </Link>
        )}
      />
    </section>
  );
}
