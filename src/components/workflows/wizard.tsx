"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wizard step list (workflow system, Master Prompt §30): progress, step state and
 * back navigation. Completed steps are revisitable; future steps are not skippable.
 */
export type WizardStep = { key: string; label: string; description?: string };

export function WizardSteps({
  steps,
  current,
  completed,
  onSelect,
}: {
  steps: WizardStep[];
  current: number;
  completed: Set<number>;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Progress">
      {/* Mobile: compact counter */}
      <p className="mb-2 caption lg:hidden" aria-live="polite">
        Step {current + 1} of {steps.length}: <span className="font-semibold text-fg">{steps[current]?.label}</span>
      </p>
      <div className="h-1 overflow-hidden rounded-full bg-muted lg:hidden" aria-hidden>
        <div className="h-full bg-primary transition-[width]" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden flex-col lg:flex">
        {steps.map((s, i) => {
          const done = completed.has(i) && i !== current;
          const active = i === current;
          const reachable = done || i <= Math.max(current, ...Array.from(completed));
          return (
            <li key={s.key} className="relative pb-5 last:pb-0">
              {i < steps.length - 1 && <span className={cn("absolute left-3 top-7 h-[calc(100%-1.75rem)] w-px", done ? "bg-primary" : "bg-border")} aria-hidden />}
              <button
                type="button"
                disabled={!reachable || active}
                onClick={() => onSelect(i)}
                aria-current={active ? "step" : undefined}
                className="group flex w-full items-start gap-3 rounded-md text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular",
                    done && "border-primary bg-primary text-primary-fg",
                    active && "border-primary bg-surface text-primary ring-4 ring-primary-subtle",
                    !done && !active && "border-border-strong bg-surface text-fg-tertiary",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className="min-w-0 pt-0.5">
                  <span className={cn("block text-[0.8125rem] font-semibold", active ? "text-fg" : done ? "text-fg group-hover:text-primary" : "text-fg-tertiary")}>{s.label}</span>
                  {s.description && <span className="block text-xs text-fg-tertiary">{s.description}</span>}
                  <span className="sr-only">{done ? "(completed)" : active ? "(current step)" : "(not started)"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function WizardLayout({ steps, children }: { steps: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-[calc(var(--topbar-h)+1.5rem)] lg:self-start">{steps}</aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function WizardPanel({ title, description, children, footer }: { title: string; description?: React.ReactNode; children: React.ReactNode; footer: React.ReactNode }) {
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const firstRender = React.useRef(true);
  // Move focus to the step heading on step change so keyboard and screen-reader users land on the new step.
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [title]);
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface">
      <div className="border-b border-border-subtle px-5 py-4">
        <h2 ref={headingRef} tabIndex={-1} className="section-title outline-none">
          {title}
        </h2>
        {description && <p className="mt-0.5 body-sm text-fg-secondary">{description}</p>}
      </div>
      <div className="px-5 py-5">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>
    </section>
  );
}
