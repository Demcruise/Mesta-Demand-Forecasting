"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./overlay";

/**
 * Combobox for choosing several values from a searchable list (DS-004 Combobox).
 * An empty selection means "all", which is stated explicitly in the trigger.
 */
export function MultiSelect({
  id,
  options,
  value,
  onChange,
  allLabel,
  placeholder = "Search",
  "aria-describedby": describedBy,
}: {
  id?: string;
  options: { value: string; label: string; hint?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  /** Text shown when nothing is selected, e.g. "All categories". */
  allLabel: string;
  placeholder?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const label = value.length === 0 ? allLabel : value.length <= 2 ? value.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ") : `${value.length} selected`;
  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-describedby={describedBy}
          className="flex h-[var(--control-h-md)] w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-3 text-left text-sm hover:border-fg-tertiary focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40"
        >
          <span className={cn("truncate font-medium", value.length === 0 ? "text-fg-secondary" : "text-fg")}>{label}</span>
          <ChevronDown className="size-4 shrink-0 text-fg-tertiary" aria-hidden />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
          <Command>
            <Command.Input placeholder={placeholder} className="h-9 w-full border-b border-border bg-transparent px-3 text-sm outline-none placeholder:text-fg-tertiary" />
            <Command.List className="max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-4 text-center caption">No matches.</Command.Empty>
              {options.map((o) => {
                const on = value.includes(o.value);
                return (
                  <Command.Item
                    key={o.value}
                    value={o.label}
                    onSelect={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                    className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2 text-sm data-[selected=true]:bg-hover"
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-xs border", on ? "border-primary bg-primary text-primary-fg" : "border-border-strong")}>
                      {on && <Check className="size-3" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="text-xs tabular text-fg-tertiary">{o.hint}</span>}
                  </Command.Item>
                );
              })}
            </Command.List>
            {value.length > 0 && (
              <div className="border-t border-border p-1">
                <button type="button" onClick={() => onChange([])} className="h-8 w-full rounded-sm px-2 text-left text-[0.8125rem] font-semibold text-fg-secondary hover:bg-hover">
                  Reset to {allLabel.toLowerCase()}
                </button>
              </div>
            )}
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-subtle pl-2 pr-0.5 text-xs font-semibold text-fg-secondary">
              {options.find((o) => o.value === v)?.label ?? v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} className="inline-flex size-5 items-center justify-center rounded-xs text-fg-tertiary hover:bg-hover hover:text-fg" aria-label={`Remove ${options.find((o) => o.value === v)?.label ?? v}`}>
                <X className="size-3" aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
