import type { ReactNode } from "react";
import { useTheme } from "../../context/ThemeContext";
import { Stubby } from "../stubby/Stubby";
import type { Plan } from "../../lib/firstPlan";

/**
 * The first plan as a ticket (screen 11): the plan on a signal body, a white
 * tab behind a dashed perforation, Stubby's eyes peeking over the top edge.
 * Every line is optional except the title and the reason, so the ticket never
 * shows a blank row for something that is not known. `children` sits at the
 * bottom of the body (the Add to calendar button once they are going).
 */
export function PlanTicket({ plan, children }: { plan: Plan; children?: ReactNode }) {
  const { resolvedTheme } = useTheme();
  return (
    <article className="ob-ticket" aria-label={plan.title}>
      <div className="ob-ticket-eyes" aria-hidden="true">
        <Stubby size={44} onDark={resolvedTheme === "dark"} />
      </div>
      <div className="ob-ticket-body">
        <h2 className="break-words text-title">{plan.title}</h2>
        {(plan.when || plan.where) && (
          <p className="ob-label mt-2 text-body">{[plan.when, plan.where].filter(Boolean).join(" · ")}</p>
        )}
        {plan.hostName && plan.kind !== "invite" && <p className="ob-label mt-1 text-small">{`With ${plan.hostName}`}</p>}
        {plan.step && <p className="mt-2 text-small">{plan.step}</p>}
        {plan.cost && <p className="ob-label mt-2 text-small">{plan.cost}</p>}
        <p className="mt-3 text-small">{plan.reason}</p>
        {children && <div className="mt-4">{children}</div>}
      </div>
      <div className="ob-ticket-tab text-small" aria-hidden="true">
        Admit one
      </div>
    </article>
  );
}
