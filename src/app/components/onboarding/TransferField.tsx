import { useId, type InputHTMLAttributes, type ReactNode } from "react";

/** A labelled text field in the Transfer look, with an optional hint and error under it. */
export function TransferField({
  label,
  hint,
  error,
  prefix,
  ...input
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** A fixed character in front of the value ("@"). */
  prefix?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "prefix">) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="transfer-label mb-2 block text-small">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="transfer-label pointer-events-none absolute inset-y-0 left-4 flex items-center text-body transfer-muted" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          className="transfer-field"
          style={prefix ? { paddingLeft: "2.25rem" } : undefined}
          aria-invalid={!!error}
          aria-describedby={note ? noteId : undefined}
          {...input}
        />
      </div>
      {note && (
        <p id={noteId} role={error ? "alert" : undefined} className={error ? "transfer-label mt-2 text-small" : "mt-2 text-small transfer-muted"}>
          {note}
        </p>
      )}
    </div>
  );
}
