"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, Info, Lock, RefreshCw, SearchX, WifiOff, type LucideIcon } from "lucide-react";
import * as React from "react";
import { ApiError } from "@/lib/api/client";
import { PermissionError, rolesWith, ROLE_LABELS, type Permission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/controls";
import { getActiveLocale } from "@/lib/i18n";

/* ── Empty (STATE-EMPTY-001): why the state exists + what to do next ── */

export function EmptyState({
  icon: Icon = SearchX,
  title,
  description,
  action,
  secondaryAction,
  className,
  compact,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border bg-subtle text-fg-tertiary">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="card-title">{title}</p>
      {description && <p className="mt-1 max-w-md body-sm text-fg-secondary">{description}</p>}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}

/* ── Error (STATE-ERROR-001): what failed, why, what to do, retry ───── */

export function ErrorState({
  what,
  error,
  onRetry,
  retryLabel,
  recovery,
  className,
  compact,
}: {
  /** What failed, e.g. "Forecast runs could not be loaded." */
  what: string;
  error: unknown;
  onRetry?: () => void;
  retryLabel?: string;
  recovery?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const isId = getActiveLocale() === "id";
  const label = retryLabel ?? (isId ? "Coba Lagi" : "Try again");
  if (error instanceof PermissionError || (error instanceof ApiError && error.code === "permission")) {
    return <PermissionNotice className={className} message={error.message} detail={error instanceof ApiError ? error.detail : undefined} permission={error instanceof PermissionError ? error.permission : undefined} />;
  }
  const notFound = error instanceof ApiError && error.code === "not_found";
  const unavailable = error instanceof ApiError && error.code === "unavailable";
  const Icon = notFound ? SearchX : unavailable ? WifiOff : AlertOctagon;
  // Raw exception text is not shown to users; it is only surfaced in development.
  const why = error instanceof ApiError ? [error.message, error.detail].filter(Boolean).join(" ") : (isId ? "Terjadi kesalahan saat menampilkan konten ini." : "An error occurred while loading this content.");
  const devDetail = !(error instanceof ApiError) && error instanceof Error && process.env.NODE_ENV === "development" ? error.message : null;
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <span className={cn("mb-3 flex size-10 items-center justify-center rounded-lg border", notFound ? "border-border bg-subtle text-fg-tertiary" : "border-critical/25 bg-critical-subtle text-critical-fg")}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="card-title">{what}</p>
      <p className="mt-1 max-w-md body-sm text-fg-secondary">{why}</p>
      {!notFound && !unavailable && <p className="mt-1 max-w-md caption">{isId ? "Coba lagi. Jika masih gagal, hubungi administrator ruang kerja Anda." : "Try again. If it continues to fail, contact your workspace administrator."}</p>}
      {devDetail && <p className="mt-2 max-w-md mono-id text-fg-tertiary">{devDetail}</p>}
      {(onRetry || recovery) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {onRetry && !notFound && (
            <Button onClick={onRetry} variant="secondary">
              <RefreshCw aria-hidden />
              {label}
            </Button>
          )}
          {recovery}
        </div>
      )}
    </div>
  );
}

export function PermissionNotice({
  permission,
  message,
  detail,
  className,
  compact,
}: {
  permission?: Permission;
  message?: string;
  detail?: string;
  className?: string;
  compact?: boolean;
}) {
  const isId = getActiveLocale() === "id";
  const roles = permission ? rolesWith(permission).map((r) => ROLE_LABELS[r]) : [];
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-border bg-subtle p-4", compact && "p-3", className)} role="note">
      <Lock className="mt-0.5 size-4 shrink-0 text-fg-tertiary" aria-hidden />
      <div className="min-w-0">
        <p className="body-sm font-semibold text-fg">{message ?? (isId ? "Anda tidak memiliki akses untuk melakukan perubahan ini." : "You do not have permission to make this change.")}</p>
        <p className="caption mt-0.5">
          {detail ?? (roles.length > 0 ? (isId ? `Tersedia untuk: ${roles.join(", ")}. Hubungi administrator ruang kerja jika Anda memerlukan akses.` : `Available to: ${roles.join(", ")}. Contact your workspace administrator if you need access.`) : (isId ? "Hubungi administrator ruang kerja jika Anda memerlukan akses." : "Contact your workspace administrator if you need access."))}
        </p>
      </div>
    </div>
  );
}

/* ── Inline alert / callout ────────────────────────────────────────── */

const ALERT_TONES = {
  info: { icon: Info, cls: "border-info/25 bg-info-subtle", iconCls: "text-info" },
  success: { icon: CheckCircle2, cls: "border-success/25 bg-success-subtle", iconCls: "text-success" },
  warning: { icon: AlertTriangle, cls: "border-warning/30 bg-warning-subtle", iconCls: "text-warning" },
  critical: { icon: AlertOctagon, cls: "border-critical/25 bg-critical-subtle", iconCls: "text-critical" },
} as const;

export function InlineAlert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  title: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = ALERT_TONES[tone];
  const Icon = t.icon;
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border px-4 py-3", t.cls, className)} role={tone === "critical" ? "alert" : "status"}>
      <Icon className={cn("mt-0.5 size-4 shrink-0", t.iconCls)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="body-sm font-semibold text-fg">{title}</p>
        {children && <div className="mt-0.5 body-sm text-fg-secondary">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ── Loading skeletons (STATE-LOADING-001): geometry matches final content ── */

function loadingLabel(what: string) {
  return getActiveLocale() === "id" ? `Memuat ${what}` : `Loading ${what}`;
}

export function TableSkeleton({ rows = 8, columns = 6, density = "comfortable" }: { rows?: number; columns?: number; density?: "compact" | "comfortable" }) {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={loadingLabel(isId ? "tabel" : "table")} className="overflow-hidden">
      <div className="flex h-10 items-center gap-4 border-b border-border bg-subtle px-4">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-3" style={{ width: i === 0 ? "22%" : `${10 + ((i * 7) % 8)}%` }} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-border-subtle px-4" style={{ height: density === "compact" ? "var(--row-h-compact)" : "var(--row-h-comfortable)" }}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3" style={{ width: i === 0 ? "22%" : `${10 + ((i * 7 + r) % 8)}%` }} />
          ))}
        </div>
      ))}
      <span className="sr-only">{isId ? "Memuat" : "Loading"}</span>
    </div>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={loadingLabel(isId ? "grafik" : "chart")} className="flex flex-col gap-3">
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {Array.from({ length: 36 }, (_, i) => (
          <Skeleton key={i} className="flex-1 rounded-xs" style={{ height: `${35 + Math.abs(Math.sin(i / 4)) * 45}%` }} />
        ))}
      </div>
      <span className="sr-only">{isId ? "Memuat" : "Loading"}</span>
    </div>
  );
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={isId ? "Memuat" : "Loading"} className={cn("flex flex-col gap-2.5", className)}>
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-7 w-1/2" />
      {Array.from({ length: lines - 1 }, (_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${70 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function DetailSkeleton() {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={loadingLabel(isId ? "detail" : "details")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} lines={2} />
        ))}
      </div>
      <ChartSkeleton height={160} />
      <TimelineSkeleton />
    </div>
  );
}

export function TimelineSkeleton({ items = 4 }: { items?: number }) {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={loadingLabel(isId ? "aktivitas" : "activity")} className="flex flex-col gap-4">
      {Array.from({ length: items }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-7 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  const isId = getActiveLocale() === "id";
  return (
    <div role="status" aria-label={loadingLabel(isId ? "halaman" : "page")} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-4">
            <CardSkeleton lines={2} />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <ChartSkeleton />
      </div>
    </div>
  );
}
