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

const ENTITY_TYPE_LABELS: Record<AuditEntityType, string> = {
  session: "Sesi",
  workspace: "Ruang kerja",
  forecast_run: "Proses perkiraan",
  forecast: "Perkiraan",
  scenario: "Skenario",
  plan: "Rencana",
  exception: "Perlu Ditinjau",
  approval: "Persetujuan",
  override: "Perubahan manual",
  model: "Model",
  backtest: "Uji model",
  data_source: "Sumber data",
  user: "Pengguna",
  settings: "Pengaturan",
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
    failure: "Riwayat aktivitas tidak dapat diekspor.",
    success: (r) => `Mengekspor ${r.rows.length} aktivitas`,
    onSuccess: ({ format, rows }) => {
      track("export_requested", { surface: "audit", rows: rows.length, format });
      downloadExport(
        format,
        `audit-log-${from}-to-${to}`,
        ["eventId", "timestamp", "actor", "workspace", "action", "entityType", "entityId", "entityLabel", "previousState", "newState", "reason", "source", "requestId"],
        rows.map((e) => [e.eventId, e.timestamp, actorName(e.actorId), e.workspaceId, e.action, e.entityType, e.entityId, e.entityLabel, e.previousState, e.newState, e.reason, e.source, e.requestId]),
        "Riwayat Aktivitas",
      );
    },
  });

  const columns = React.useMemo<ColumnDef<AuditEvent, unknown>[]>(
    () => [
      { id: "time", header: "Kapan", meta: { width: "160px", sortKey: "timestamp" } satisfies ColumnMeta, cell: ({ row }) => <span className="whitespace-nowrap text-xs tabular">{formatDateTime(row.original.timestamp)}</span> },
      { id: "actor", header: "Siapa", meta: { width: "minmax(160px, 1fr)", sortKey: "actor" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.actorId} /> },
      { id: "action", header: "Apa yang terjadi", meta: { width: "minmax(170px, 1fr)", sortKey: "action" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate font-semibold">{ACTION_LABELS[row.original.action]}</span> },
      {
        id: "entity",
        header: "Objek",
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
        header: "Perubahan",
        meta: { width: "minmax(180px, 1.4fr)", hideBelow: "lg" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="truncate text-xs tabular text-fg-secondary">
            {row.original.previousState ?? "—"} → {row.original.newState ?? "—"}
          </span>
        ),
      },
      { id: "reason", header: "Alasan", meta: { width: "minmax(180px, 1.6fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-xs text-fg-secondary" title={row.original.reason ?? undefined}>{row.original.reason ?? ""}</span> },
      { id: "source", header: "Sumber", meta: { width: "90px", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{row.original.source === "system" ? "Sistem" : row.original.source === "api" ? "API" : "Web"}</Tag> },
    ],
    [],
  );

  if (!can("audit.view")) {
    return (
      <PageContainer>
        <PageHeader title="Riwayat Aktivitas" />
        <PermissionNotice permission="audit.view" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title="Riwayat Aktivitas" description="Lihat perubahan dan tindakan di ruang kerja: siapa, kapan, apa yang berubah, dan mengapa. Catatan bersifat tambah-saja dan tidak dapat diubah." />
      <DataTable
        label="Aktivitas"
        columns={columns}
        data={q.data?.items}
        getRowId={(e) => e.eventId}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Riwayat aktivitas tidak dapat dimuat."
        storageKey="audit"
        density="compact"
        activeRowId={selected?.eventId}
        onRowClick={(e) => state.setParam("event", e.eventId)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 50, total: q.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onExport={(format) => exp.mutate(format)}
        exportLabel={q.data ? `Ekspor ${q.data.total} aktivitas` : "Ekspor"}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Cari objek, orang, alasan, atau ID permintaan"
            facets={[
              { key: "action", label: "Tindakan", primary: true, options: (Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => ({ value: a, label: ACTION_LABELS[a] })) },
              { key: "actor", label: "Orang", primary: true, options: [{ value: SYSTEM_ACTOR.id, label: SYSTEM_ACTOR.name }, ...USERS.map((u) => ({ value: u.id, label: u.name }))] },
              { key: "entityType", label: "Jenis objek", options: (["session", "workspace", "forecast_run", "scenario", "plan", "exception", "approval", "override", "model", "backtest", "data_source", "user", "settings"] as AuditEntityType[]).map((t) => ({ value: t, label: ENTITY_TYPE_LABELS[t] })) },
              { key: "source", label: "Sumber", options: [{ value: "web", label: "Web" }, { value: "api", label: "API" }, { value: "system", label: "Sistem" }] },
            ]}
          >
            <DateRangeFilter from={from} to={to} max={isoDate(today)} presets={[1, 7, 30]} onChange={(f, t) => state.setParams({ from: f, to: t }, { resetPage: true })} />
          </FilterBar>
        }
        empty={<EmptyState icon={ScrollText} title="Tidak ada aktivitas yang cocok dengan filter." description="Perlebar rentang tanggal atau hapus filter." action={<Button variant="secondary" onClick={state.clearFilters}>Hapus filter</Button>} />}
      />
      <Drawer open={!!selected} onOpenChange={(o) => !o && state.setParam("event", null)}>
        {selected && (
          <DrawerContent size="md" eyebrow="Aktivitas" title={ACTION_LABELS[selected.action]} description={formatDateTime(selected.timestamp)}>
            <div className="flex flex-col gap-5">
              <DescriptionList
                items={[
                  { label: "Apa yang terjadi?", value: ACTION_LABELS[selected.action] },
                  { label: "Siapa yang melakukannya?", value: <UserIdentity userId={selected.actorId} /> },
                  { label: "Kapan?", value: formatDateTime(selected.timestamp) },
                  { label: "Apa yang berubah?", value: `${selected.previousState ?? "—"} → ${selected.newState ?? "—"}` },
                  { label: "Mengapa?", value: selected.reason ?? "Tidak ada alasan tercatat" },
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
                  { label: "Sumber", value: selected.source === "system" ? "Sistem (proses otomatis)" : selected.source === "api" ? "API" : "Aplikasi web" },
                ]}
              />
              <Panel title="Referensi teknis">
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
