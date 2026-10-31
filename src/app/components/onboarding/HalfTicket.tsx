import { Star } from "lucide-react";

/**
 * What the friend gets (screen 12): the torn half of the ticket with Stubby's
 * star stamp, "{FirstName} saved you a spot", the plan and when. Shown before
 * sending so the sender sees exactly what arrives.
 */
export function HalfTicket({ from, title, when }: { from: string; title: string; when: string | null }) {
  return (
    <article className="ob-half" aria-label={`${from} saved you a spot`}>
      <div className="ob-half-stamp" aria-hidden="true">
        <Star className="size-7" strokeWidth={2.5} fill="var(--ink)" color="var(--ink)" />
      </div>
      <div className="min-w-0">
        <p className="break-words text-title">{`${from} saved you a spot`}</p>
        <p className="ob-label mt-2 break-words text-body">{title}</p>
        {when && <p className="mt-1 text-small">{when}</p>}
      </div>
    </article>
  );
}
