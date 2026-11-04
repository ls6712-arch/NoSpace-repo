import type { ReactNode } from "react";
import { Plus, ArrowUp, ArrowDown, X } from "lucide-react";
import { trackingOptions, type Workflow } from "../../../lib/pursuitWorkflow";
import { newWorkflowId } from "../../../lib/pursuitWorkflowStore";
export const fieldClass =
  "min-h-11 w-full rounded-control border border-border bg-card px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-small font-medium">
      {label}
      {children}
    </label>
  );
}
export function GoalFields({
  value,
  onChange,
  locked = false,
}: {
  value: Workflow;
  onChange: (w: Workflow) => void;
  locked?: boolean;
}) {
  const patch = (p: Partial<Workflow>) => onChange({ ...value, ...p });
  return (
    <div className="space-y-6">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-small font-medium">
          How would you like to track this?
        </legend>
        <div className="grid gap-2 tab:grid-cols-2">
          {trackingOptions.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-card border p-3 ${value.tracking === option.value ? "border-accent bg-surface-muted" : "border-border bg-card"}`}
            >
              <input
                type="radio"
                name="tracking"
                value={option.value}
                checked={value.tracking === option.value}
                disabled={locked}
                onChange={() =>
                  patch({
                    tracking: option.value,
                    unit:
                      option.value === "sessions"
                        ? "sessions"
                        : option.value === "total"
                          ? ""
                          : "",
                    target: undefined,
                  })
                }
              />
              <span>
                <span className="block text-small font-medium">
                  {option.label}
                </span>
                <span className="block text-caption text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
        {locked && (
          <p className="text-caption text-muted-foreground">
            Tracking and unit stay the same once progress is recorded.
          </p>
        )}
      </fieldset>
      {(value.tracking === "sessions" || value.tracking === "total") && (
        <div className="grid gap-4 tab:grid-cols-2">
          <Field label="Target · Optional">
            <input
              className={fieldClass}
              type="number"
              min={value.tracking === "sessions" ? "1" : "0.01"}
              max="100000000"
              step={value.tracking === "sessions" ? "1" : "any"}
              value={value.target ?? ""}
              onChange={(e) =>
                patch({
                  target:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              placeholder={value.tracking === "sessions" ? "10" : "500"}
            />
          </Field>
          {value.tracking === "total" && (
            <Field label="Unit">
              <input
                className={fieldClass}
                maxLength={30}
                disabled={locked}
                value={value.unit}
                placeholder="pages"
                onChange={(e) => patch({ unit: e.target.value })}
              />
            </Field>
          )}
        </div>
      )}
      {value.tracking === "checklist" && (
        <fieldset className="space-y-3">
          <legend className="mb-2 text-small font-medium">Checklist</legend>
          {value.items
            .filter((item) => !item.archived)
            .map((item) => (
              <div key={item.id} className="flex items-center gap-1">
                <input
                  aria-label="Checklist item"
                  className={fieldClass}
                  maxLength={140}
                  value={item.title}
                  onChange={(e) =>
                    patch({
                      items: value.items.map((i) =>
                        i.id === item.id ? { ...i, title: e.target.value } : i,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center"
                  aria-label="Move item up"
                  onClick={() => {
                    const items = [...value.items];
                    const index = items.findIndex((i) => i.id === item.id);
                    if (index > 0) {
                      [items[index - 1], items[index]] = [
                        items[index],
                        items[index - 1],
                      ];
                      patch({ items });
                    }
                  }}
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center"
                  aria-label="Move item down"
                  onClick={() => {
                    const items = [...value.items];
                    const index = items.findIndex((i) => i.id === item.id);
                    if (index < items.length - 1) {
                      [items[index + 1], items[index]] = [
                        items[index],
                        items[index + 1],
                      ];
                      patch({ items });
                    }
                  }}
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  className="flex size-11 shrink-0 items-center justify-center"
                  aria-label="Remove item"
                  onClick={() =>
                    patch({
                      items: item.title.trim()
                        ? value.items.map((i) =>
                            i.id === item.id ? { ...i, archived: true } : i,
                          )
                        : value.items.filter((i) => i.id !== item.id),
                    })
                  }
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          <button
            type="button"
            className="flex min-h-11 items-center gap-2 text-small"
            onClick={() =>
              patch({
                items: [...value.items, { id: newWorkflowId(), title: "" }],
              })
            }
          >
            <Plus className="size-4" />
            Add a checklist item
          </button>
        </fieldset>
      )}
      <Field label="Finish by · Optional">
        <input
          className={fieldClass}
          type="date"
          value={value.finishBy ?? ""}
          onChange={(e) => patch({ finishBy: e.target.value || undefined })}
        />
      </Field>
    </div>
  );
}
