"use client";

import { Dialog as D, DropdownMenu as DM, Popover as P, Tooltip as T } from "radix-ui";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { pick } from "@/lib/i18n/core";

/* ── Tooltip ───────────────────────────────────────────────────────── */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return (
    <T.Provider delayDuration={250} skipDelayDuration={150}>
      {children}
    </T.Provider>
  );
}

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  if (!content) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          align={align}
          sideOffset={6}
          className="z-[var(--z-index-tooltip)] max-w-72 rounded-md bg-inverse px-2.5 py-1.5 text-xs font-medium leading-4 text-fg-inverse shadow-popover"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ── Popover ───────────────────────────────────────────────────────── */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export const PopoverContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof P.Content>>(
  function PopoverContent({ className, align = "start", sideOffset = 6, ...props }, ref) {
    return (
      <P.Portal>
        <P.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn("z-[var(--z-index-popover)] rounded-lg border border-border-popover bg-popover p-3 text-fg shadow-popover outline-none", className)}
          {...props}
        />
      </P.Portal>
    );
  },
);

/* ── Dropdown menu ─────────────────────────────────────────────────── */

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DM.Content>>(
  function DropdownMenuContent({ className, align = "end", sideOffset = 6, ...props }, ref) {
    return (
      <DM.Portal>
        <DM.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          className={cn("z-[var(--z-index-popover)] min-w-48 rounded-md border border-border-popover bg-popover p-1 text-fg shadow-popover", className)}
          {...props}
        />
      </DM.Portal>
    );
  },
);

export const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DM.Item> & { destructive?: boolean; icon?: React.ReactNode; shortcut?: string }
>(function DropdownMenuItem({ className, destructive, icon, shortcut, children, ...props }, ref) {
  return (
    <DM.Item
      ref={ref}
      className={cn(
        "relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm px-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-hover data-[disabled]:text-fg-disabled [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-tertiary",
        destructive && "text-critical-fg [&_svg]:text-critical-fg",
        className,
      )}
      {...props}
    >
      {icon}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <span className="ml-4 text-xs text-fg-tertiary">{shortcut}</span>}
    </DM.Item>
  );
});

export function DropdownMenuLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2 pb-1 pt-2 metadata">{children}</DM.Label>;
}

export function DropdownMenuSeparator() {
  return <DM.Separator className="-mx-1 my-1 h-px bg-border" />;
}

/**
 * Checkbox menu item (COLUMNS-CHECK-001). Radix puts `data-state` on the item, not on
 * the box, so the box reads it through `group-data-*`: checked = primary fill + light
 * check, unchecked = white box with border, disabled = muted. Row hover only tints the
 * row, so it never washes out the checked box; focus uses the row highlight + ring.
 */
export const DropdownMenuCheckboxItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DM.CheckboxItem>>(
  function DropdownMenuCheckboxItem({ className, children, ...props }, ref) {
    return (
      <DM.CheckboxItem
        ref={ref}
        className={cn(
          "group relative flex h-9 cursor-pointer select-none items-center gap-2 rounded-sm pl-8 pr-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-hover data-[disabled]:text-fg-disabled focus-visible:ring-2 focus-visible:ring-focus/40",
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="absolute left-2 flex size-4 items-center justify-center rounded-xs border border-border-strong bg-input transition-colors group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=indeterminate]:border-primary group-data-[state=indeterminate]:bg-primary group-data-[disabled]:border-border group-data-[disabled]:bg-muted group-data-[disabled]:group-data-[state=checked]:bg-fg-disabled"
        >
          <DM.ItemIndicator>
            <svg viewBox="0 0 16 16" className="size-3 text-primary-fg" aria-hidden>
              <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </DM.ItemIndicator>
        </span>
        {children}
      </DM.CheckboxItem>
    );
  },
);

export const DropdownMenuRadioGroup = DM.RadioGroup;
export const DropdownMenuRadioItem = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof DM.RadioItem>>(
  function DropdownMenuRadioItem({ className, children, ...props }, ref) {
    return (
      <DM.RadioItem
        ref={ref}
        className={cn("group relative flex h-8 cursor-pointer select-none items-center gap-2 rounded-sm pl-8 pr-2 text-sm outline-none data-[highlighted]:bg-hover", className)}
        {...props}
      >
        {/* v5 §51: selected = primary ring + filled dot; unselected = empty neutral circle. */}
        <span aria-hidden className="absolute left-2.5 flex size-3.5 items-center justify-center rounded-full border border-border-strong bg-input group-data-[state=checked]:border-primary">
          <DM.ItemIndicator>
            <span className="block size-2 rounded-full bg-primary" />
          </DM.ItemIndicator>
        </span>
        {children}
      </DM.RadioItem>
    );
  },
);

/* ── Dialog ────────────────────────────────────────────────────────── */

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof D.Content> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  hideClose?: boolean;
};

/**
 * Dialog (DIALOG-001): focused creation, confirmation, compact configuration,
 * bulk actions and high-impact decisions. Never multi-step workflows.
 */
export function DialogContent({ title, description, size = "md", footer, hideClose, className, children, ...props }: DialogContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[var(--z-index-dialog)] bg-overlay" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[var(--z-index-dialog)] flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-border bg-surface shadow-dialog outline-none",
          size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-5 py-4">
          <div className="min-w-0">
            <D.Title className="section-title">{title}</D.Title>
            {description ? (
              <D.Description className="mt-1 body-sm text-fg-secondary">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
            )}
          </div>
          {!hideClose && (
            <D.Close className="-mr-1.5 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-fg-tertiary hover:bg-hover hover:text-fg" aria-label={pick("Tutup dialog", "Close dialog")}>
              <X className="size-4" aria-hidden />
            </D.Close>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/* ── Drawer ────────────────────────────────────────────────────────── */

export const Drawer = D.Root;
export const DrawerClose = D.Close;

type DrawerContentProps = Omit<React.ComponentPropsWithoutRef<typeof D.Content>, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** DRAWER-001: small 400px, standard 520px, investigation 600px. */
  size?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
  headerActions?: React.ReactNode;
  eyebrow?: React.ReactNode;
};

/**
 * Drawer (DRAWER-001): focus trap and Escape come from Radix Dialog. Full screen below
 * 640px. The page behind keeps its filters and scroll because the drawer is an overlay.
 */
export function DrawerContent({ title, description, size = "md", footer, headerActions, eyebrow, className, children, ...props }: DrawerContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[var(--z-index-drawer)] bg-overlay" />
      <D.Content
        className={cn(
          "fixed inset-y-0 right-0 z-[var(--z-index-drawer)] flex w-full flex-col border-l border-border bg-surface shadow-drawer outline-none",
          size === "sm" ? "sm:w-[var(--drawer-sm)]" : size === "lg" ? "sm:w-[var(--drawer-lg)]" : "sm:w-[var(--drawer-md)]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <div className="mb-1 metadata">{eyebrow}</div>}
            <D.Title className="section-title">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 body-sm text-fg-secondary">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{pick("Detail", "Details")}</D.Description>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {headerActions}
            <D.Close className="inline-flex size-8 items-center justify-center rounded-md text-fg-tertiary hover:bg-hover hover:text-fg" aria-label={pick("Tutup panel", "Close panel")}>
              <X className="size-4" aria-hidden />
            </D.Close>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
