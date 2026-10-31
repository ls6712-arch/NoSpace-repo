import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";

/** A labelled text field, with an optional hint and error under it. */
export function OnboardingField({
  label,
  hint,
  error,
  prefix,
  inputRef,
  ...input
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** A fixed character in front of the value ("@"). */
  prefix?: string;
  /** For the rare screen that has to focus or select the text itself. */
  inputRef?: Ref<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "prefix">) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div>
      <label htmlFor={id} className="ob-label mb-2 block text-small">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="ob-label pointer-events-none absolute inset-y-0 left-4 flex items-center text-body ob-muted" aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          ref={inputRef}
          className="ob-field"
          style={prefix ? { paddingLeft: "2.25rem" } : undefined}
          aria-invalid={!!error}
          aria-describedby={note ? noteId : undefined}
          {...input}
        />
      </div>
      {/* Always rendered, so a screen reader announces the error when it appears. */}
      <p
        id={note ? noteId : undefined}
        aria-live="polite"
        className={note ? (error ? "ob-label mt-2 text-small" : "mt-2 text-small ob-muted") : "sr-only"}
      >
        {note}
      </p>
    </div>
  );
}
