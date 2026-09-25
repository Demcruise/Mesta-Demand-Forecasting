"use client";

import { ArrowRight, Bot } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ActivityItem, AuditAction, AuditEvent } from "@/types/domain";
import { actorName } from "@/lib/mock/directory";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/entities/identity";
import { Tooltip } from "@/components/ui/overlay";
import { EmptyState } from "@/components/feedback/states";

export const ACTION_LABELS: Record<AuditAction, string> = {
  sign_in: "Masuk",
  sign_out: "Keluar",
  workspace_switch: "Ganti ruang kerja",
  create_forecast_run: "Proses perkiraan",
  cancel_forecast_run: "Membatalkan proses perkiraan",
  retry_forecast_run: "Menjalankan ulang proses perkiraan",
  publish_forecast_run: "Menerbitkan proses perkiraan",
  archive_forecast_run: "Mengarsipkan proses perkiraan",
  approve: "Menyetujui",
  reject: "Menolak",
  request_revision: "Meminta revisi",
  override: "Menerapkan perubahan manual",
  create_scenario: "Membuat skenario",
  edit_scenario: "Mengubah skenario",
  simulate_scenario: "Menyimulasikan skenario",
  submit_scenario: "Mengirim skenario",
  publish_plan: "Menerbitkan rencana",
  update_plan: "Memperbarui rencana",
  resolve_exception: "Menyelesaikan item",
  update_exception: "Memperbarui item",
  change_settings: "Mengubah pengaturan",
  change_permissions: "Mengubah akses",
  integration_update: "Integrasi diperbarui",
  run_backtest: "Menjalankan uji model",
  set_default_model: "Perubahan model",
};

/** Where an audited entity lives, so every event links back to its source (LINEAGE-001). */
export function entityHref(e: Pick<AuditEvent, "entityType" | "entityId">): string | null {
  switch (e.entityType) {
    case "forecast_run":
      return `/forecasting/runs/${e.entityId}`;
    case "scenario":
      return `/scenarios/${e.entityId}`;
    case "approval":
      return `/planning/approvals?id=${e.entityId}`;
    case "exception":
      return `/planning/exceptions?id=${e.entityId}`;
    case "model":
      return `/models/${e.entityId}`;
    case "plan":
      return "/planning";
    case "data_source":
      return e.entityId.startsWith("dq_") ? `/demand-data/quality?id=${e.entityId}` : `/demand-data/sources?id=${e.entityId}`;
    case "backtest":
      return "/models/backtesting";
    case "user":
      return "/administration/users";
    case "settings":
      return "/administration/settings";
    default:
      return null;
  }
}

function describe(e: AuditEvent) {
  if (e.action === "create_forecast_run") {
    if (e.newState === "completed") return "Forecast run completed";
    return "Created forecast run";
  }
  if (e.action === "publish_forecast_run" && e.newState === "superseded") return "Baseline superseded";
  return ACTION_LABELS[e.action];
}

/** AuditEvent anatomy (backlog §41): what, who, when, what changed, why, related object. */
export function AuditEventItem({ event, showEntity = true }: { event: AuditEvent; showEntity?: boolean }) {
  const href = entityHref(event);
  const system = event.actorId === "system";
  return (
    <li className="flex gap-3">
      {system ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-fg-tertiary" aria-hidden>
          <Bot className="size-3.5" />
        </span>
      ) : (
        <Avatar name={actorName(event.actorId)} />
      )}
      <div className="min-w-0 flex-1 pb-4">
        <p className="body-sm text-fg">
          <span className="font-semibold">{actorName(event.actorId)}</span> <span className="text-fg-secondary">{describe(event).toLowerCase()}</span>{" "}
          {showEntity &&
            (href ? (
              <Link href={href} className="font-semibold text-fg hover:text-primary hover:underline underline-offset-2">
                {event.entityLabel}
              </Link>
            ) : (
              <span className="font-semibold">{event.entityLabel}</span>
            ))}
        </p>
        {(event.previousState || event.newState) && (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-fg-secondary">
            {event.previousState && <span className="rounded-xs bg-muted px-1 tabular">{event.previousState}</span>}
            {event.previousState && event.newState && <ArrowRight className="size-3 text-fg-tertiary" aria-label="to" />}
            {event.newState && <span className="rounded-xs bg-muted px-1 tabular">{event.newState}</span>}
          </p>
        )}
        {event.reason && <p className="mt-1 text-xs text-fg-secondary">“{event.reason}”</p>}
        <p className="mt-0.5 text-[0.6875rem] text-fg-tertiary">
          <Tooltip content={formatDateTime(event.timestamp)}>
            <time dateTime={event.timestamp} tabIndex={0}>
              {formatRelative(event.timestamp)}
            </time>
          </Tooltip>
          {" · "}
          {event.source === "system" ? "System" : event.source === "api" ? "API" : "Web"}
        </p>
      </div>
    </li>
  );
}

export function AuditTimeline({ events, emptyText = "Belum ada aktivitas tercatat.", className }: { events: AuditEvent[]; emptyText?: string; className?: string }) {
  if (events.length === 0) return <EmptyState compact title={emptyText} description="Tindakan penting seperti proses, perubahan manual, dan persetujuan dicatat di sini." />;
  return (
    <ol className={cn("relative", className)} aria-label="Activity">
      {events.map((e) => (
        <AuditEventItem key={e.eventId} event={e} />
      ))}
    </ol>
  );
}

export function ActivityList({ items, className }: { items: ActivityItem[]; className?: string }) {
  if (items.length === 0) return <p className="caption">No activity yet.</p>;
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((a, i) => (
        <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < items.length - 1 && <span className="absolute left-3.5 top-8 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />}
          {a.actorId === "system" ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-fg-tertiary" aria-hidden>
              <Bot className="size-3.5" />
            </span>
          ) : (
            <Avatar name={actorName(a.actorId)} />
          )}
          <div className="min-w-0">
            <p className="body-sm">
              <span className="font-semibold">{actorName(a.actorId)}</span>
            </p>
            <p className="body-sm text-fg-secondary">{a.text}</p>
            <p className="text-[0.6875rem] text-fg-tertiary">
              <time dateTime={a.at}>{formatDateTime(a.at)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * ConsequenceSummary (Security UX §66, high-impact actions §31): what, scope,
 * consequence, required permission, approval requirement — shown before confirming.
 */
export function ConsequenceSummary({ rows, className }: { rows: { label: string; value: React.ReactNode; emphasis?: boolean }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border-subtle rounded-lg border border-border", className)}>
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[minmax(7.5rem,10rem)_1fr] gap-3 px-3.5 py-2.5">
          <dt className="caption font-semibold">{r.label}</dt>
          <dd className={cn("min-w-0 body-sm text-fg", r.emphasis && "font-bold")}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
