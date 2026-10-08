import { Link } from "react-router";

/** The one sign-up consent line. Both documents open in a new tab so what
 * has already been typed isn't lost. */
export function TermsCheckbox({
  checked,
  onChange,
  id = "terms-agree",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  const link = "underline underline-offset-2 hover:text-foreground";
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        className="mt-0.5 size-5 shrink-0 accent-[var(--coral-deep)]"
      />
      <label htmlFor={id} className="min-h-6 text-small leading-snug">
        I’m 16 or older and agree to the{" "}
        <Link to="/terms" target="_blank" rel="noreferrer" className={link}>
          Terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy-policy" target="_blank" rel="noreferrer" className={link}>
          Privacy Policy
        </Link>
      </label>
    </div>
  );
}
