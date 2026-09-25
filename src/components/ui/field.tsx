import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared control surface: one height, padding and focus treatment for every text control. */
export const controlClass =
  "h-[var(--control-h-md)] w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm transition-colors placeholder:text-fg-tertiary hover:border-fg-tertiary focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-fg-disabled aria-[invalid=true]:border-critical";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return <input ref={ref} type={type} className={cn(controlClass, "tabular", className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(controlClass, "h-auto py-2 leading-5", className)} {...props} />;
  },
);

type FieldProps = {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Right-aligned element next to the label (e.g. a counter). */
  aside?: React.ReactNode;
};

/**
 * Field: label → control (6px) → hint/error. Hint and error ids are exposed through
 * `useFieldIds` so controls can set aria-describedby.
 */
export function Field({ label, htmlFor, hint, error, required, optional, className, children, aside }: FieldProps) {
  const hintId = htmlFor ? `${htmlFor}-hint` : undefined;
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={htmlFor} className="label">
          {label}
          {required && (
            <span className="ml-0.5 text-critical-fg" aria-hidden>
              *
            </span>
          )}
          {optional && <span className="ml-1.5 font-medium text-fg-tertiary">Optional</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-xs font-medium text-critical-fg" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="caption">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, opts: { hint?: unknown; error?: unknown }) {
  if (opts.error) return `${id}-error`;
  if (opts.hint) return `${id}-hint`;
  return undefined;
}
