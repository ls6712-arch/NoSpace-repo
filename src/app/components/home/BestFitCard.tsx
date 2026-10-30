import { Link } from "react-router";
import { Check } from "lucide-react";
import { PillButton } from "../ui/PillButton";
import { SuggestionPhoto } from "./SuggestionPhoto";
import { useShownOnce } from "../../lib/useShownOnce";
import { openPathFor } from "../../lib/homeActions";
import type { HomeItem } from "../../lib/homeItems";

/** The label of the one primary action for each kind of suggestion. */
export const PRIMARY_LABEL: Record<HomeItem["kind"], string> = {
  event: "I’m going",
  open_pursuit: "Ask to join",
  at_home: "Start",
};

export type CardState = "idle" | "busy" | "done" | "requested";

/**
 * The top suggestion as a large card: photo, title, when and where, the one
 * why line, one primary action, and Invite a friend. Prices and counts of
 * people are never shown here.
 */
export function BestFitCard({
  item,
  state,
  onShown,
  onOpen,
  onPrimary,
  onInvite,
}: {
  item: HomeItem;
  state: CardState;
  onShown: () => void;
  onOpen: () => void;
  onPrimary: () => void;
  onInvite: () => void;
}) {
  const ref = useShownOnce<HTMLElement>(onShown);
  const atHome = item.kind === "at_home";
  const done = state === "done" || state === "requested";
  return (
    <article ref={ref} className="overflow-hidden rounded-card border border-border bg-card">
      <Link to={openPathFor(item)} onClick={onOpen} className="block" aria-label={item.title} tabIndex={-1}>
        <SuggestionPhoto item={item} width={430} priority className="h-[188px] w-full">
          {atHome && <span className="absolute left-3.5 top-3.5 rounded-full bg-card px-2.5 py-1 text-caption font-semibold text-foreground">At home</span>}
        </SuggestionPhoto>
      </Link>
      <div className="flex flex-col gap-1.5 p-4">
        <h2 className="text-title font-extrabold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          <Link to={openPathFor(item)} onClick={onOpen} className="min-h-11 text-foreground">
            {item.title}
          </Link>
        </h2>
        <p className="text-body">{atHome ? `Your first step: ${item.step ?? ""}` : item.detail}</p>
        {item.why && (
          <p className="flex items-center gap-1.5 text-small font-semibold text-accent-text">
            <Check className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            {item.why}
          </p>
        )}
        <div className="mt-2.5 flex gap-2.5">
          <PillButton
            onClick={onPrimary}
            disabled={state === "busy" || done}
            done={done}
            doneLabel={state === "requested" ? "Requested" : PRIMARY_LABEL[item.kind]}
            className="min-h-12 flex-1"
          >
            {PRIMARY_LABEL[item.kind]}
          </PillButton>
          <PillButton variant="outline" onClick={onInvite} className="min-h-12 px-4">
            Invite a friend
          </PillButton>
        </div>
      </div>
    </article>
  );
}
