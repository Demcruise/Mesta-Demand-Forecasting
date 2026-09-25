"use client";

import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Select (DS-004, Master Prompt §17): one shared pattern.
 *   [ Label/value    ▼ ]   text → chevron 8px, chevron → edge 12px, vertically centred.
 */

export type SelectOption = { value: string; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean };

type SelectProps = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** Leading text inside the trigger, e.g. "Sort:". */
  prefix?: React.ReactNode;
};

export function Select({ value, onValueChange, options, placeholder, id, disabled, className, size = "md", prefix, ...aria }: SelectProps) {
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger
        id={id}
        className={cn(
          "group inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border-strong bg-surface pl-3 pr-3 text-left text-fg transition-colors hover:border-fg-tertiary focus-visible:border-focus focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus/40 disabled:cursor-not-allowed disabled:bg-muted disabled:text-fg-disabled aria-[invalid=true]:border-critical data-[placeholder]:text-fg-tertiary",
          size === "sm" ? "h-[var(--control-h-sm)] text-[0.8125rem]" : "h-[var(--control-h-md)] text-sm",
          className,
        )}
        {...aria}
      >
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          {prefix && <span className="shrink-0 font-medium text-fg-tertiary">{prefix}</span>}
          <span className="truncate font-medium">
            <S.Value placeholder={placeholder} />
          </span>
        </span>
        <S.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-fg-tertiary transition-transform group-data-[state=open]:rotate-180" aria-hidden />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content
          position="popper"
          sideOffset={4}
          className="z-[var(--z-index-popover)] max-h-[min(var(--radix-select-content-available-height),22rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface shadow-popover"
        >
          <S.Viewport className="p-1">
            {options.map((o) => (
              <S.Item
                key={o.value}
                value={o.value}
                disabled={o.disabled}
                className="relative flex cursor-pointer select-none items-start gap-2 rounded-sm py-2 pl-8 pr-3 text-sm text-fg outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-hover data-[disabled]:text-fg-disabled"
              >
                <span className="absolute left-2 top-2.5 flex size-4 items-center justify-center">
                  <S.ItemIndicator>
                    <Check className="size-4 text-primary" aria-hidden />
                  </S.ItemIndicator>
                </span>
                <span className="flex min-w-0 flex-col">
                  <S.ItemText>{o.label}</S.ItemText>
                  {o.description && <span className="caption">{o.description}</span>}
                </span>
              </S.Item>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
