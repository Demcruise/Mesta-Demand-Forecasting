"use client";

import { Baby, Box, Check, Copy, CupSoda, Home, Milk, Package, Popcorn, Snowflake, Sparkles, Wheat, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ForecastModel, ForecastRun, Product, Scenario } from "@/types/domain";
import { actorName } from "@/lib/mock/directory";
import { formatDate, formatRelative } from "@/lib/format";
import { getActiveLocale } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { StatusBadge } from "@/components/feedback/status";

/* ── Entity ID: monospace, never breaks, copyable ──────────────────── */

export function EntityId({ value, copy = true, className }: { value: string; copy?: boolean; className?: string }) {
  const isId = getActiveLocale() === "id";
  const [copied, setCopied] = React.useState(false);
  const onCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard unavailable; value stays selectable.
    }
  };
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1", className)}>
      <span className="mono-id truncate whitespace-nowrap text-fg-secondary" title={value}>
        {value}
      </span>
      {copy && (
        <Tooltip content={copied ? (isId ? "Disalin" : "Copied") : isId ? "Salin ID" : "Copy ID"}>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded-xs text-fg-tertiary opacity-70 hover:bg-hover hover:text-fg hover:opacity-100 focus-visible:opacity-100"
            aria-label={copied ? (isId ? `${value} disalin` : `Copied ${value}`) : isId ? `Salin ${value}` : `Copy ${value}`}
          >
            {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
          </button>
        </Tooltip>
      )}
    </span>
  );
}

/* ── Product identity (ENTITY-001) ─────────────────────────────────── */

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Beverages: CupSoda,
  "Dairy & Chilled": Milk,
  Snacks: Popcorn,
  Staples: Wheat,
  "Personal Care": Sparkles,
  Household: Home,
  "Baby & Kids": Baby,
  Frozen: Snowflake,
};

export function categoryIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? Package;
}

/**
 * [icon] Product name
 *        Category · SKU
 * Fixed 32px icon box, 10px gap, name truncates to one line (two in "detail").
 */
export function ProductIdentity({
  product,
  variant = "table",
  href,
  className,
}: {
  product: Pick<Product, "id" | "name" | "sku" | "category"> | null | undefined;
  variant?: "compact" | "table" | "detail";
  href?: string;
  className?: string;
}) {
  if (!product) {
    return (
      <span className={cn("inline-flex items-center gap-2.5 text-fg-tertiary", className)}>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-dashed border-border-strong">
          <Box className="size-4" aria-hidden />
        </span>
        <span className="body-sm">{getActiveLocale() === "id" ? "Produk tidak tersedia" : "Product unavailable"}</span>
      </span>
    );
  }
  const Icon = categoryIcon(product.category);
  const box = variant === "detail" ? "size-11 rounded-lg" : variant === "compact" ? "size-6 rounded-sm" : "size-8 rounded-md";
  const name = (
    <span
      className={cn(
        "min-w-0 font-semibold text-fg",
        variant === "detail" ? "line-clamp-2 text-lg leading-6" : "truncate text-[0.8125rem] leading-5",
        href && "group-hover/id:text-primary group-hover/id:underline underline-offset-2",
      )}
      title={product.name}
    >
      {product.name}
    </span>
  );
  const content = (
    <>
      <span className={cn("flex shrink-0 items-center justify-center border border-border bg-subtle text-fg-secondary", box)} aria-hidden>
        <Icon className={variant === "detail" ? "size-5" : variant === "compact" ? "size-3.5" : "size-4"} />
      </span>
      <span className="flex min-w-0 flex-col">
        {name}
        {variant !== "compact" && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-fg-tertiary">
            <span className="truncate">{product.category}</span>
            <span aria-hidden>·</span>
            <span className="mono-id shrink-0 whitespace-nowrap">{product.sku}</span>
          </span>
        )}
      </span>
    </>
  );
  const cls = cn("group/id inline-flex min-w-0 max-w-full items-center", variant === "compact" ? "gap-2" : "gap-2.5", className);
  if (href) {
    return (
      <Link href={href} className={cn(cls, "rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus")} onClick={(e) => e.stopPropagation()}>
        {content}
      </Link>
    );
  }
  return <span className={cls}>{content}</span>;
}

/* ── People ────────────────────────────────────────────────────────── */

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary-subtle font-bold text-primary-subtle-fg",
        size === "sm" ? "size-6 text-[0.625rem]" : size === "lg" ? "size-10 text-sm" : "size-7 text-[0.6875rem]",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function UserIdentity({ userId, secondary, size = "sm", className }: { userId: string | null | undefined; secondary?: React.ReactNode; size?: "sm" | "md"; className?: string }) {
  const name = actorName(userId);
  if (!userId) return <span className={cn("body-sm text-fg-tertiary", className)}>{getActiveLocale() === "id" ? "Belum ditugaskan" : "Unassigned"}</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar name={name} size={size} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[0.8125rem] font-semibold leading-5 text-fg">{name}</span>
        {secondary && <span className="truncate text-xs text-fg-tertiary">{secondary}</span>}
      </span>
    </span>
  );
}

/* ── Forecast run identity (ENTITY-002) ────────────────────────────── */

export function RunIdentity({ run, href = true, className }: { run: ForecastRun; href?: boolean; className?: string }) {
  const title = (
    <span className="truncate text-[0.8125rem] font-semibold leading-5 text-fg group-hover/run:text-primary group-hover/run:underline underline-offset-2" title={run.name}>
      {run.name}
    </span>
  );
  return (
    <span className={cn("group/run flex min-w-0 flex-col", className)}>
      {href ? (
        <Link href={`/forecasting/runs/${run.id}`} className="min-w-0 truncate rounded-xs focus-visible:outline-2 focus-visible:outline-focus" onClick={(e) => e.stopPropagation()}>
          {title}
        </Link>
      ) : (
        title
      )}
      <span className="mono-id truncate text-fg-tertiary">{run.id}</span>
    </span>
  );
}

export function scopeLabel(run: Pick<ForecastRun, "scope">) {
  const isId = getActiveLocale() === "id";
  const cats =
    run.scope.categories.length === 0
      ? isId ? "Semua kategori" : "All categories"
      : run.scope.categories.length === 1
        ? run.scope.categories[0]
        : `${run.scope.categories.length} ${isId ? "kategori" : "categories"}`;
  const regions =
    run.scope.regions.length === 0
      ? isId ? "Semua wilayah" : "All regions"
      : run.scope.regions.length === 1
        ? run.scope.regions[0]
        : `${run.scope.regions.length} ${isId ? "wilayah" : "regions"}`;
  return `${cats} · ${regions}`;
}

/* ── Model identity (ENTITY-004) ───────────────────────────────────── */

export function ModelIdentity({ model, showStatus = false, href = true, className }: { model: Pick<ForecastModel, "id" | "name" | "version" | "status" | "isDefault"> | null | undefined; showStatus?: boolean; href?: boolean; className?: string }) {
  if (!model) return <span className="text-fg-tertiary">—</span>;
  const label = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[0.8125rem] font-semibold text-fg group-hover/model:text-primary group-hover/model:underline underline-offset-2">{model.name}</span>
      <span className="mono-id shrink-0 rounded-xs bg-muted px-1 text-fg-secondary">v{model.version}</span>
      {model.isDefault && <span className="shrink-0 text-[0.6875rem] font-semibold text-primary">{getActiveLocale() === "id" ? "Bawaan" : "Default"}</span>}
    </span>
  );
  return (
    <span className={cn("group/model inline-flex min-w-0 items-center gap-2", className)}>
      {href ? (
        <Link href={`/models/${model.id}`} className="min-w-0 rounded-xs focus-visible:outline-2 focus-visible:outline-focus" onClick={(e) => e.stopPropagation()}>
          {label}
        </Link>
      ) : (
        label
      )}
      {showStatus && <StatusBadge status={model.status} size="sm" />}
    </span>
  );
}

/* ── Scenario identity (ENTITY-003) ────────────────────────────────── */

export function ScenarioIdentity({ scenario, className }: { scenario: Scenario; className?: string }) {
  return (
    <span className={cn("group/scn flex min-w-0 flex-col", className)}>
      <Link href={`/scenarios/${scenario.id}`} className="min-w-0 truncate rounded-xs text-[0.8125rem] font-semibold leading-5 text-fg hover:text-primary hover:underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-focus" onClick={(e) => e.stopPropagation()}>
        {scenario.name}
      </Link>
      <span className="truncate text-xs text-fg-tertiary">
        {actorName(scenario.ownerId)} · {getActiveLocale() === "id" ? "diubah" : "modified"} {formatRelative(scenario.modifiedAt)}
      </span>
    </span>
  );
}

export function DateCell({ value, relative }: { value: string | null | undefined; relative?: boolean }) {
  if (!value) return <span className="text-fg-tertiary">—</span>;
  return (
    <Tooltip content={new Date(value).toLocaleString(getActiveLocale() === "id" ? "id-ID" : "en-GB", { dateStyle: "full", timeStyle: "short" })}>
      <span tabIndex={0} className="whitespace-nowrap tabular text-fg-secondary">
        {relative ? formatRelative(value) : formatDate(value)}
      </span>
    </Tooltip>
  );
}
