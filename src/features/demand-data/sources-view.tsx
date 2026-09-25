"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plug, PlugZap, RefreshCw, Unplug } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { DataSource } from "@/types/domain";
import { getSource, listSources, setSourceConnection, syncNow, testConnection, updateSourceSchedule } from "@/lib/api/data";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { formatDateTime, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { SeverityBadge, StatusBadge, Tag } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { UserIdentity } from "@/components/entities/identity";
import { AuditTimeline, ConsequenceSummary } from "@/components/governance/audit";
import { ChartDataTable } from "@/components/charts/chart-frame";
import { pick, localized } from "@/lib/i18n";

type SourceRow = DataSource & { openIssues: number };

const SCHEDULES = localized([pick("Setiap jam", "Every hour"), pick("Setiap 4 jam", "Every 4 hours"), pick("Harian pukul 02:00", "Daily at 02:00"), pick("Harian pukul 04:30", "Daily at 04:30"), pick("Harian pukul 05:00", "Daily at 05:00"), "Manual"], ["Every hour", "Every 4 hours", "Daily at 02:00", "Daily at 04:30", "Daily at 05:00", "Manual"]);

/**
 * PAGE-DATA-SOURCES and PAGE-INTEGRATIONS share this view. `mode="admin"` leads with
 * connection management; `mode="data"` leads with freshness and issues.
 */
export function SourcesView({ mode }: { mode: "data" | "admin" }) {
  const state = useListState({ filterKeys: [] });
  const selectedId = state.getParam("id");
  const q = useApiQuery(["sources"], listSources);

  const columns = React.useMemo<ColumnDef<SourceRow, unknown>[]>(
    () => [
      {
        id: "source",
        header: pick("Sumber", "Source"),
        meta: { width: "minmax(240px, 2fr)", pinned: true, label: pick("Sumber", "Source") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.name}</span>
            <span className="truncate text-xs text-fg-tertiary">{row.original.description}</span>
          </span>
        ),
      },
      { id: "type", header: "Type", meta: { width: "150px", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{row.original.type}</Tag> },
      { id: "status", header: "Status", meta: { width: "140px" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "sync", header: pick("Sinkron terakhir", "Last sync"), meta: { width: "150px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateTime(row.original.lastSyncAt)}</span> },
      { id: "freshness", header: pick("Terakhir Diperbarui", "Freshness"), meta: { width: "190px", description: pick("Waktu sejak sinkronisasi terakhir yang berhasil.", "Time since the last successful sync.") } satisfies ColumnMeta, cell: ({ row }) => <FreshnessIndicator timestamp={row.original.lastSuccessAt} label={pick("Berhasil", "Success")} /> },
      { id: "records", header: pick("Catatan", "Records"), meta: { width: "120px", numeric: true, hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.records) },
      {
        id: "issues",
        header: pick("Masalah terbuka", "Open issues"),
        meta: { width: "110px", numeric: true, hideBelow: "md" } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.openIssues > 0 ? (
            <Link href={`/demand-data/quality?source=${row.original.id}&status=open,investigating`} onClick={(e) => e.stopPropagation()} className="font-semibold text-warning-fg hover:underline">
              {row.original.openIssues}
            </Link>
          ) : (
            <span className="text-fg-tertiary">0</span>
          ),
      },
      { id: "owner", header: "Owner", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.owner} /> },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title={mode === "admin" ? pick("Integrasi", "Integrations") : pick("Sumber Data", pick("Sumber data", "Data sources"))}
        description={
          mode === "admin"
            ? pick("Koneksi yang memasok data permintaan, produk, dan promosi ke perkiraan. Uji, sinkronkan, dan atur jadwalnya di sini.", "Connections that feed demand, product and promotion data into forecasting. Test, sync and schedule them here.")
            : pick("Dari mana data permintaan berasal, seberapa baru, dan sumber mana yang bermasalah.", "Where demand data comes from, how fresh it is, and which sources have problems.")
        }
      />
      {q.data?.some((s) => s.status === "failed") && (
        <InlineAlert tone="warning" title={`${q.data.filter((s) => s.status === "failed").map((s) => s.name).join(", ")} failing.`}>
          Forecasts continue with the last successful data. Open the source to see the error and recovery steps.
        </InlineAlert>
      )}
      <DataTable
        label={pick("Sumber data", "Data sources")}
        columns={columns}
        data={q.data}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Sumber data tidak dapat dimuat.", "Data sources could not be loaded.")}
        activeRowId={selectedId}
        onRowClick={(r) => state.setParam("id", r.id)}
        hideDensityToggle
        empty={<EmptyState icon={Plug} title={pick("Belum ada sumber data yang terhubung ke ruang kerja ini.", pick("Belum ada sumber data yang tersambung ke ruang kerja ini.", "No data sources are connected to this workspace."))} description={pick("Sambungkan sumber POS, ERP, atau gudang data untuk mulai memuat riwayat permintaan.", "Connect a POS, ERP or data warehouse source to start loading demand history.")} />}
      />
      <SourceDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
    </PageContainer>
  );
}

function SourceDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useSession();
  const q = useApiQuery(["source", id], (c) => getSource(c, id as string), { enabled: !!id });
  const [testResult, setTestResult] = React.useState<{ ok: boolean; message: string } | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = React.useState(false);
  React.useEffect(() => setTestResult(null), [id]);
  const invalidate = [["sources"], ["source"], ["dq"], ["overview"], ["monitoring"]] as const;
  const test = useApiMutation((c, _v: void) => testConnection(c, id as string), { failure: pick("Uji koneksi tidak dapat dijalankan.", "The connection test could not run."), onSuccess: (r) => setTestResult(r) });
  const sync = useApiMutation((c, _v: void) => syncNow(c, id as string), {
    invalidate,
    success: (s) => (s.lastError && s.status === "failed" ? null : `${s.name} synced`),
    failure: pick("Sinkronisasi tidak dimulai.", "Sync did not start."),
    onSuccess: (s) => {
      if (s.status === "failed") setTestResult({ ok: false, message: `Sync failed: ${s.lastError ?? "unknown error"}` });
    },
  });
  const connect = useApiMutation((c, connected: boolean) => setSourceConnection(c, id as string, connected), {
    invalidate,
    success: (s) => (s.status === "disconnected" ? `${s.name} disconnected` : `${s.name} connected`),
    failure: pick("Koneksi tidak dapat diubah.", "The connection was not changed."),
    onSuccess: () => setConfirmDisconnect(false),
  });
  const schedule = useApiMutation((c, v: string) => updateSourceSchedule(c, id as string, v), { invalidate, success: (s) => pick(`Jadwal diatur ke “${s.schedule}”`, `Schedule set to “${s.schedule}”`), failure: pick("Jadwal tidak dapat diubah.", "The schedule was not changed.") });
  const d = q.data;
  const manage = can("integration.manage");

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DrawerContent
          size="lg"
          eyebrow={d?.source.type}
          title={d?.source.name ?? pick("Sumber data", "Data source")}
          description={d?.source.description}
          footer={
            d && manage ? (
              d.source.status === "disconnected" ? (
                <Button variant="primary" loading={connect.isPending} onClick={() => connect.mutate(true)}>
                  <PlugZap aria-hidden /> Connect
                </Button>
              ) : (
                <>
                  <Button variant="danger-outline" onClick={() => setConfirmDisconnect(true)}>
                    <Unplug aria-hidden /> Disconnect
                  </Button>
                  <Button variant="secondary" loading={test.isPending} onClick={() => test.mutate()}>
                    Test connection
                  </Button>
                  <Button variant="primary" loading={sync.isPending} loadingText={pick("Menyinkronkan", "Syncing")} onClick={() => sync.mutate()}>
                    <RefreshCw aria-hidden /> Sync now
                  </Button>
                </>
              )
            ) : undefined
          }
        >
          {q.isPending ? (
            <DetailSkeleton />
          ) : q.isError ? (
            <ErrorState compact what={pick("Sumber ini tidak dapat dimuat.", "This source could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
          ) : d ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={d.source.status} />
                <FreshnessIndicator timestamp={d.source.lastSuccessAt} label={pick("Sinkron berhasil terakhir", "Last successful sync")} source={d.source.name} />
              </div>
              {d.source.lastError && (
                <InlineAlert tone={d.source.status === "failed" ? "critical" : "warning"} title={d.source.status === "failed" ? pick("Sinkronisasi terakhir gagal.", "The last sync failed.") : pick("Sinkronisasi terakhir selesai dengan masalah.", "The last sync completed with issues.")}>
                  {d.source.lastError}
                </InlineAlert>
              )}
              {testResult && (
                <InlineAlert tone={testResult.ok ? "success" : "critical"} title={testResult.ok ? pick("Uji koneksi berhasil.", "Connection test passed.") : pick("Uji koneksi gagal.", "Connection test failed.")}>
                  {testResult.message}
                </InlineAlert>
              )}
              {!manage && <PermissionNotice permission="integration.manage" compact message={pick("Anda dapat melihat sumber ini, tetapi tidak mengubahnya.", "You can view this source but not change it.")} />}
              <DescriptionList
                columns={2}
                items={[
                  { label: pick("Koneksi", "Connection"), value: d.source.status === "disconnected" ? pick("Tidak terhubung", "Not connected") : pick(`Konektor ${d.source.type}`, `${d.source.type} connector`) },
                  {
                    label: pick("Jadwal", "Schedule"),
                    value: manage ? (
                      <Select size="sm" aria-label={pick("Jadwal sinkronisasi", "Sync schedule")} value={d.source.schedule} onValueChange={(v) => schedule.mutate(v)} options={SCHEDULES.map((s) => ({ value: s, label: s }))} disabled={schedule.isPending} />
                    ) : (
                      d.source.schedule
                    ),
                  },
                  { label: pick("Sinkron berhasil terakhir", "Last successful sync"), value: formatDateTime(d.source.lastSuccessAt) },
                  { label: pick("Sinkron gagal terakhir", "Last failed sync"), value: formatDateTime(d.source.lastFailureAt) },
                  { label: pick("Catatan", "Records"), value: formatNumber(d.source.records) },
                  { label: pick("Penanggung jawab", "Owner"), value: <UserIdentity userId={d.source.owner} /> },
                ]}
              />
              <section>
                <h3 className="mb-2 card-title">{pick("Pemetaan data", "Data mapping")}</h3>
                <ChartDataTable caption={pick("Pemetaan kolom", "Field mapping")} columns={[{ key: "s", label: pick("Kolom sumber", "Source field") }, { key: "t", label: pick("Kolom Mesta", "Mesta field") }]} rows={d.source.mapping.map((m) => ({ s: <span className="mono-id">{m.source}</span>, t: <span className="mono-id">{m.target}</span> }))} />
              </section>
              <section>
                <h3 className="mb-2 card-title">{pick("Kesehatan", "Health")}</h3>
                {d.issues.length === 0 ? (
                  <p className="caption">{pick("Tidak ada masalah kualitas data dari sumber ini.", "No data quality issues from this source.")}</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {d.issues.map((i) => (
                      <li key={i.id}>
                        <Link href={`/demand-data/quality?id=${i.id}`} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-hover">
                          <SeverityBadge severity={i.severity} size="sm" />
                          <span className="min-w-0 flex-1 body-sm">{i.title}</span>
                          <StatusBadge status={i.status} size="sm" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section>
                <h3 className="mb-2 card-title">{pick("Aktivitas terbaru", "Recent activity")}</h3>
                <AuditTimeline events={d.activity} emptyText={pick("Belum ada perubahan tercatat pada sumber ini.", "No recorded changes to this source.")} />
              </section>
            </div>
          ) : null}
        </DrawerContent>
      )}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        {d && (
          <DialogContent
            size="sm"
            title={pick(`Putuskan ${d.source.name}?`, `Disconnect ${d.source.name}?`)}
            footer={
              <>
                <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>
                  Tetap terhubung
                </Button>
                <Button variant="danger" loading={connect.isPending} onClick={() => connect.mutate(false)}>
                  Putuskan sumber
                </Button>
              </>
            }
          >
            <ConsequenceSummary
              rows={[
                { label: pick("Sumber", "Source"), value: d.source.name },
                { label: pick("Dampak", "Consequence"), value: pick("Tidak ada data baru yang diterima. Perkiraan memakai data terakhir yang dimuat dan muncul peringatan pembaruan.", "No new data is received. Forecasts use the last loaded data and freshness warnings appear."), emphasis: true },
                { label: pick("Izin", "Permission"), value: pick("Mengelola integrasi (Administrator)", "Manage integrations (Administrator)") },
                { label: pick("Dapat dibatalkan", "Reversible"), value: pick("Ya. Sambungkan kembali kapan saja; sinkronisasi yang terlewat akan diisi.", "Yes. Reconnect at any time; missed syncs are backfilled.") },
              ]}
            />
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
