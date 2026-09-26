"use client";

import { Checkbox as CB, RadioGroup as RG, Switch as SW, Tabs as TB, ToggleGroup as TG } from "radix-ui";
import { Check, Minus } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Checkbox ──────────────────────────────────────────────────────── */

export const Checkbox = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof CB.Root>>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <CB.Root
      ref={ref}
      className={cn(
        "peer inline-flex size-4 shrink-0 items-center justify-center rounded-xs border border-border-strong bg-input transition-colors hover:border-fg-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
        className,
      )}
      {...props}
    >
      <CB.Indicator className="text-primary-fg">
        {props.checked === "indeterminate" ? <Minus className="size-3" strokeWidth={3} aria-hidden /> : <Check className="size-3" strokeWidth={3} aria-hidden />}
      </CB.Indicator>
    </CB.Root>
  );
});

export function CheckboxField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} disabled={disabled} className="mt-0.5" />
      <div className="min-w-0">
        <label htmlFor={id} className="body-sm font-semibold text-fg">
          {label}
        </label>
        {description && <p className="caption">{description}</p>}
      </div>
    </div>
  );
}

/* ── Radio cards ───────────────────────────────────────────────────── */

export type RadioOption = { value: string; label: React.ReactNode; description?: React.ReactNode; meta?: React.ReactNode; disabled?: boolean };

export function RadioCards({
  value,
  onValueChange,
  options,
  columns = 1,
  "aria-label": ariaLabel,
  name,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: RadioOption[];
  columns?: 1 | 2 | 3;
  "aria-label"?: string;
  name?: string;
}) {
  return (
    <RG.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      name={name}
      className={cn("grid gap-2", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}
    >
      {options.map((o) => (
        <RG.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="group flex h-full w-full items-start gap-3 rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle"
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-input group-data-[state=checked]:border-primary">
            <RG.Indicator className="block size-2 rounded-full bg-primary" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center justify-between gap-2">
              <span className="body-sm font-semibold text-fg">{o.label}</span>
              {o.meta}
            </span>
            {o.description && <span className="caption">{o.description}</span>}
          </span>
        </RG.Item>
      ))}
    </RG.Root>
  );
}

/* ── Switch ────────────────────────────────────────────────────────── */

export const Switch = React.forwardRef<HTMLButtonElement, React.ComponentPropsWithoutRef<typeof SW.Root>>(function Switch(
  { className, ...props },
  ref,
) {
  return (
    <SW.Root
      ref={ref}
      className={cn(
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent bg-border-strong p-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary",
        className,
      )}
      {...props}
    >
      <SW.Thumb className="block size-4 rounded-full bg-surface transition-transform data-[state=checked]:translate-x-4" />
    </SW.Root>
  );
});

export function SwitchField({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="body-sm font-semibold text-fg">
          {label}
        </label>
        {description && <p id={`${id}-desc`} className="caption mt-0.5">{description}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={description ? `${id}-desc` : undefined} />
    </div>
  );
}

/* ── Tabs ──────────────────────────────────────────────────────────── */

export const Tabs = TB.Root;
export const TabsContent = TB.Content;

export function TabsList({ className, children, ...props }: React.ComponentPropsWithoutRef<typeof TB.List>) {
  return (
    <TB.List className={cn("flex items-center gap-1 overflow-x-auto border-b border-border", className)} {...props}>
      {children}
    </TB.List>
  );
}

export function TabsTrigger({ className, children, count, ...props }: React.ComponentPropsWithoutRef<typeof TB.Trigger> & { count?: number }) {
  return (
    <TB.Trigger
      className={cn(
        "-mb-px inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus data-[state=active]:border-primary data-[state=active]:text-fg",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-muted px-1.5 py-px text-[0.6875rem] font-semibold tabular text-fg-secondary">{count}</span>
      )}
    </TB.Trigger>
  );
}

/* ── Segmented control ─────────────────────────────────────────────── */

export function Segmented<T extends string>({
  value,
  onValueChange,
  options,
  "aria-label": ariaLabel,
  size = "md",
}: {
  value: T;
  onValueChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  "aria-label": string;
  size?: "sm" | "md";
}) {
  return (
    <TG.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onValueChange(v as T)}
      aria-label={ariaLabel}
      className={cn("inline-flex shrink-0 items-center rounded-md border border-border-strong bg-muted p-0.5", size === "sm" ? "h-[var(--control-h-sm)]" : "h-[var(--control-h-md)]")}
    >
      {options.map((o) => (
        <TG.Item
          key={o.value}
          value={o.value}
          className="inline-flex h-full items-center gap-1.5 whitespace-nowrap rounded-[5px] px-2.5 text-[0.8125rem] font-semibold text-fg-secondary transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-focus data-[state=on]:bg-surface data-[state=on]:text-fg [&_svg]:size-4"
        >
          {o.icon}
          {o.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}

/* ── Misc ──────────────────────────────────────────────────────────── */

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-xs border border-border bg-subtle px-1 font-mono text-[0.6875rem] font-medium text-fg-secondary", className)}>
      {children}
    </kbd>
  );
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("skeleton", className)} style={style} aria-hidden />;
}

export function Separator({ className, vertical }: { className?: string; vertical?: boolean }) {
  return <div role="separator" aria-orientation={vertical ? "vertical" : "horizontal"} className={cn(vertical ? "h-full w-px" : "h-px w-full", "bg-border", className)} />;
}
