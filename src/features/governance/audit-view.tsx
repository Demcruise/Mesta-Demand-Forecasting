"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { AuditAction, AuditEntityType, AuditEvent } from "@/types/domain";
import { exportAudit, listAudit } from "@/lib/api/governance";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { actorName, SYSTEM_ACTOR, USERS } from "@/lib/mock/directory";
import { addDays, isoDate, startOfToday } from "@/lib/mock/time";
import { formatDateTime } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader, Panel } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { downloadExport, type ExportFormat } from "@/lib/export";
import { DateRangeFilter, FilterBar } from "@/components/tables/filter-bar";
import { EmptyState, PermissionNotice } from "@/components/feedback/states";
import { Tag } from "@/components/feedback/status";
import { EntityId, UserIdentity } from "@/components/entities/identity";
import { ACTION_LABELS, entityHref } from "@/components/governance/audit";
import { pick } from "@/lib/i18n";

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  session: "Sesi",
  workspace: "Ruang kerja",
  forecast_run: pick("Proses perkiraan", "Forecast run"),
  forecast: pick("Perkiraan", "Forecast"),
  scenario: pick("Skenario", "Scenario"),
  plan: pick("Rencana", "Plan workspace"),
  exception: "Perlu Ditinjau",
  approval: pick("Persetujuan", "Approval"),
  override: pick("Perubahan manual", "Override"),
  model: pick("Model", "Model"),
  backtest: pick("Uji model", "Backtests"),
  data_source: pick("Sumber data", "Data sources"),
  user: pick("Pengguna", "User"),
  settings: pick("Pengaturan", "Configuration"),
};

/** PAGE-AUDIT: a trustworthy, immutable record of consequential activity. */
export function AuditView() {
  const { can } = useSession();
  const state = useListState({ filterKeys: ["action", "actor", "entityType", "source"], defaultSort: "timestamp", defaultDir: "desc", defaultPageSize: 50 });
  const today = startOfToday();
  const from = state.getParam("from") ?? isoDate(addDays(today, -30));
  const to = state.getParam("to") ?? isoDate(today);
  const q = useApiQuery(["audit", state.query, from, to], (c) => listAudit(c, { ...state.query, from, to }), { keepPrevious: true, enabled: can("audit.view") });
  const selected = q.data?.items.find((e) => e.eventId === state.getParam("event"));
  const exp = useApiMutation(async (c, format: ExportFormat) => ({ format, rows: await exportAudit(c, { ...state.query, from, to }) }), {
    failure: pick("Riwayat aktivitas tidak dapat diekspor.", "The audit log was not exported."),
    success: (r) => pick(`Mengekspor ${r.rows.length} aktivitas`, `Exported ${r.rows.length} events`),
    onSuccess: ({ format, rows }) => {
      track("export_requested", { surface: "audit", rows: rows.length, format });
      downloadExport(
        format,
        `audit-log-${from}-to-${to}`,
        ["eventId", "timestamp", "actor", "workspace", "action", "entityType", "entityId", "entityLabel", "previousState", "newState", "reason", "source", "requestId"],
        rows.map((e) => [e.eventId, e.timestamp, actorName(e.actorId), e.workspaceId, e.action, e.entityType, e.entityId, e.entityLabel, e.previousState, e.newState, e.reason, e.source, e.requestId]),
        pick("Riwayat Aktivitas", "Audit log"),
      );
    },
  });

  const columns = React.useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      { id: "time", header: pick("Kapan", "When"), meta: { width: "160px", sortKey: "timestamp" } satisfies ColumnMeta, cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular">{formatDateTime(row.original.timestamp)}</span> },
      { id: "actor", header: pick("Siapa", "Who"), meta: { width: "minmax(160px, 1fr)", sortKey: "actor" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.actorId} /> },
      { id: "action", header: pick("Apa yang terjadi", "What happened"), meta: { width: "minmax(170px, 1fr)", sortKey: "action" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate font-semibold">{ACTION_LABELS[row.original.action]}</span> },
      {
        id: "entity",
        header: pick("Objek", "Object"),
        meta: { width: "minmax(220px, 2fr)" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const href = entityHref(row.original);
          return (
            <span className="flex min-w-0 flex-col">
              {href ? (
                <Link href={href} onClick={(e) => e.stopPropagation()} className="truncate text-[0.8125rem] font-semibold hover:text-primary hover:underline">
                  {row.original.entityLabel}
                </Link>
              ) : (
                <span className="truncate text-[0.8125rem] font-semibold">{row.original.entityLabel}</span>
              )}
              <span className="truncate text-xs text-fg-tertiary">{row.original.entityType.replace("_", " ")}</span>
            </span>
          );
        },
      },
      {
        id: "change",
        header: pick("Perubahan", "Change"),
        meta: { width: "minmax(180px, 1.4fr)", hideBelow: "lg" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="truncate text-xs tabular text-fg-secondary">
            {row.original.previousState ?? "—"} → {row.original.newState ?? "—"}
          </span>
        ),
      },
      { id: "reason", header: pick("Alasan", "Why"), meta: { width: "minmax(180px, 1.6fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-xs text-fg-secondary" title={row.original.reason ?? undefined}>{row.original.reason ?? ""}</span> },
      { id: "source", header: pick("Sumber", "Source"), meta: { width: "90px", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{row.original.source === "system" ? pick("Sistem", "System") : row.original.source === "api" ? "API" : "Web"}</Tag> },
    ],
    [],
  );

  if (!can("audit.view")) {
    return (
      <PageContainer>
        <PageHeader title={pick("Riwayat Aktivitas", "Audit log")} />
        <PermissionNotice permission="audit.view" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={pick("Riwayat Aktivitas", "Audit log")} description={pick("Lihat perubahan dan tindakan di ruang kerja: siapa, kapan, apa yang berubah, dan mengapa. Catatan bersifat tambah-saja dan tidak dapat diubah.", "Every consequential action in this workspace: who did it, when, what changed and why. Events are append-only and cannot be edited.")} />
      <DataTable
        label={pick("Aktivitas", "Audit events")}
        columns={columns}
        data={q.data?.items}
        getRowId={(e) => e.eventId}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Riwayat aktivitas tidak dapat dimuat.", "The audit log could not be loaded.")}
        storageKey="audit"
        density="compact"
        activeRowId={selected?.eventId}
        onRowClick={(e) => state.setParam("event", e.eventId)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 50, total: q.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onExport={(format) => exp.mutate(format)}
        exportLabel={q.data ? pick(`Ekspor ${q.data.total} aktivitas`, pick(`Ekspor ${q.data.total} kejadian`, pick(`Ekspor ${q.data.total} kejadian`, `Export ${q.data.total} events`))) : pick("Ekspor", "Export")}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari objek, orang, alasan, atau ID permintaan", "Search object, person, reason or request ID")}
            facets={[
              { key: "action", label: pick("Tindakan", "Action"), primary: true, options: (Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => ({ value: a, label: ACTION_LABELS[a] })) },
              { key: "actor", label: pick("Orang", "Person"), primary: true, options: [{ value: SYSTEM_ACTOR.id, label: SYSTEM_ACTOR.name }, ...USERS.map((u) => ({ value: u.id, label: u.name }))] },
              { key: "entityType", label: pick("Jenis objek", "Object type"), options: (["session", "workspace", "forecast_run", "scenario", "plan", "exception", "approval", "override", "model", "backtest", "data_source", "user", "settings"] as AuditEntityType[]).map((t) => ({ value: t, label: ENTITY_TYPE_LABELS[t] })) },
              { key: "source", label: pick("Sumber", "Source"), options: [{ value: "web", label: "Web" }, { value: "api", label: "API" }, { value: "system", label: pick("Sistem", "System") }] },
            ]}
          >
            <DateRangeFilter from={from} to={to} max={isoDate(today)} presets={[1, 7, 30]} onChange={(f, t) => state.setParams({ from: f, to: t }, { resetPage: true })} />
          </FilterBar>
        }
        empty={<EmptyState icon={ScrollText} title={pick("Tidak ada aktivitas yang cocok dengan filter.", "No audit events match these filters.")} description={pick("Perlebar rentang tanggal atau hapus filter.", "Widen the date range or clear filters.")} action={<Button variant="secondary" onClick={state.clearFilters}>{pick("Hapus filter", "Clear filters")}</Button>} />}
      />
      <Drawer open={!!selected} onOpenChange={(o) => !o && state.setParam("event", null)}>
        {selected && (
          <DrawerContent size="md" eyebrow={pick("Aktivitas", "Audit event")} title={ACTION_LABELS[selected.action]} description={formatDateTime(selected.timestamp)}>
            <div className="flex flex-col gap-5">
              <DescriptionList
                items={[
                  { label: pick("Apa yang terjadi?", "What happened?"), value: ACTION_LABELS[selected.action] },
                  { label: pick("Siapa yang melakukannya?", "Who did it?"), value: <UserIdentity userId={selected.actorId} /> },
                  { label: pick("Kapan?", "When?"), value: formatDateTime(selected.timestamp) },
                  { label: pick("Apa yang berubah?", "What changed?"), value: `${selected.previousState ?? "—"} → ${selected.newState ?? "—"}` },
                  { label: pick("Mengapa?", "Why?"), value: selected.reason ?? pick("Tidak ada alasan tercatat", "No reason recorded") },
                  {
                    label: "Related object",
                    value: entityHref(selected) ? (
                      <Link href={entityHref(selected) as string} className="text-primary hover:underline">
                        {selected.entityLabel}
                      </Link>
                    ) : (
                      selected.entityLabel
                    ),
                    hint: `${selected.entityType.replace("_", " ")} · ${selected.entityId}`,
                  },
                  { label: pick("Sumber", "Source"), value: selected.source === "system" ? pick("Sistem (proses otomatis)", "System (automated job)") : selected.source === "api" ? "API" : pick("Aplikasi web", "Web application") },
                ]}
              />
              <Panel title={pick("Referensi teknis", "Technical reference")}>
                <DescriptionList
                  items={[
                    { label: "Event ID", value: <EntityId value={selected.eventId} /> },
                    { label: "Request ID", value: <EntityId value={selected.requestId} /> },
                    { label: "Workspace", value: <EntityId value={selected.workspaceId} /> },
                  ]}
                />
              </Panel>
            </div>
          </DrawerContent>
        )}
      </Drawer>
    </PageContainer>
  );
}
