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

type SourceRow = DataSource & { openIssues: number };

const SCHEDULES = ["Setiap jam", "Setiap 4 jam", "Harian pukul 02:00", "Harian pukul 04:30", "Harian pukul 05:00", "Manual"];

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
        header: "Sumber",
        meta: { width: "minmax(240px, 2fr)", pinned: true, label: "Sumber" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.name}</span>
            <span className="truncate text-xs text-fg-tertiary">{row.original.description}</span>
          </span>
        ),
      },
      { id: "type", header: "Type", meta: { width: "150px", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{row.original.type}</Tag> },
      { id: "status", header: "Status", meta: { width: "140px" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "sync", header: "Sinkron terakhir", meta: { width: "150px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateTime(row.original.lastSyncAt)}</span> },
      { id: "freshness", header: "Terakhir Diperbarui", meta: { width: "190px", description: "Waktu sejak sinkronisasi terakhir yang berhasil." } satisfies ColumnMeta, cell: ({ row }) => <FreshnessIndicator timestamp={row.original.lastSuccessAt} label="Berhasil" /> },
      { id: "records", header: "Catatan", meta: { width: "120px", numeric: true, hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.records) },
      {
        id: "issues",
        header: "Masalah terbuka",
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
        title={mode === "admin" ? "Integrasi" : "Sumber Data"}
        description={
          mode === "admin"
            ? "Koneksi yang memasok data permintaan, produk, dan promosi ke perkiraan. Uji, sinkronkan, dan atur jadwalnya di sini."
            : "Dari mana data permintaan berasal, seberapa baru, dan sumber mana yang bermasalah."
        }
      />
      {q.data?.some((s) => s.status === "failed") && (
        <InlineAlert tone="warning" title={`${q.data.filter((s) => s.status === "failed").map((s) => s.name).join(", ")} failing.`}>
          Forecasts continue with the last successful data. Open the source to see the error and recovery steps.
        </InlineAlert>
      )}
      <DataTable
        label="Sumber data"
        columns={columns}
        data={q.data}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Sumber data tidak dapat dimuat."
        activeRowId={selectedId}
        onRowClick={(r) => state.setParam("id", r.id)}
        hideDensityToggle
        empty={<EmptyState icon={Plug} title="Belum ada sumber data yang terhubung ke ruang kerja ini." description="Sambungkan sumber POS, ERP, atau gudang data untuk mulai memuat riwayat permintaan." />}
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
  const test = useApiMutation((c, _v: void) => testConnection(c, id as string), { failure: "Uji koneksi tidak dapat dijalankan.", onSuccess: (r) => setTestResult(r) });
  const sync = useApiMutation((c, _v: void) => syncNow(c, id as string), {
    invalidate,
    success: (s) => (s.lastError && s.status === "failed" ? null : `${s.name} synced`),
    failure: "Sinkronisasi tidak dimulai.",
    onSuccess: (s) => {
      if (s.status === "failed") setTestResult({ ok: false, message: `Sync failed: ${s.lastError ?? "unknown error"}` });
    },
  });
  const connect = useApiMutation((c, connected: boolean) => setSourceConnection(c, id as string, connected), {
    invalidate,
    success: (s) => (s.status === "disconnected" ? `${s.name} disconnected` : `${s.name} connected`),
    failure: "Koneksi tidak dapat diubah.",
    onSuccess: () => setConfirmDisconnect(false),
  });
  const schedule = useApiMutation((c, v: string) => updateSourceSchedule(c, id as string, v), { invalidate, success: (s) => `Jadwal diatur ke “${s.schedule}”`, failure: "Jadwal tidak dapat diubah." });
  const d = q.data;
  const manage = can("integration.manage");

  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DrawerContent
          size="lg"
          eyebrow={d?.source.type}
          title={d?.source.name ?? "Sumber data"}
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
                  <Button variant="primary" loading={sync.isPending} loadingText="Menyinkronkan" onClick={() => sync.mutate()}>
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
            <ErrorState compact what="Sumber ini tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />
          ) : d ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={d.source.status} />
                <FreshnessIndicator timestamp={d.source.lastSuccessAt} label="Sinkron berhasil terakhir" source={d.source.name} />
              </div>
              {d.source.lastError && (
                <InlineAlert tone={d.source.status === "failed" ? "critical" : "warning"} title={d.source.status === "failed" ? "Sinkronisasi terakhir gagal." : "Sinkronisasi terakhir selesai dengan masalah."}>
                  {d.source.lastError}
                </InlineAlert>
              )}
              {testResult && (
                <InlineAlert tone={testResult.ok ? "success" : "critical"} title={testResult.ok ? "Uji koneksi berhasil." : "Uji koneksi gagal."}>
                  {testResult.message}
                </InlineAlert>
              )}
              {!manage && <PermissionNotice permission="integration.manage" compact message="Anda dapat melihat sumber ini, tetapi tidak mengubahnya." />}
              <DescriptionList
                columns={2}
                items={[
                  { label: "Koneksi", value: d.source.status === "disconnected" ? "Tidak terhubung" : `Konektor ${d.source.type}` },
                  {
                    label: "Jadwal",
                    value: manage ? (
                      <Select size="sm" aria-label="Jadwal sinkronisasi" value={d.source.schedule} onValueChange={(v) => schedule.mutate(v)} options={SCHEDULES.map((s) => ({ value: s, label: s }))} disabled={schedule.isPending} />
                    ) : (
                      d.source.schedule
                    ),
                  },
                  { label: "Sinkron berhasil terakhir", value: formatDateTime(d.source.lastSuccessAt) },
                  { label: "Sinkron gagal terakhir", value: formatDateTime(d.source.lastFailureAt) },
                  { label: "Catatan", value: formatNumber(d.source.records) },
                  { label: "Penanggung jawab", value: <UserIdentity userId={d.source.owner} /> },
                ]}
              />
              <section>
                <h3 className="mb-2 card-title">Pemetaan data</h3>
                <ChartDataTable caption="Pemetaan kolom" columns={[{ key: "s", label: "Kolom sumber" }, { key: "t", label: "Kolom Mesta" }]} rows={d.source.mapping.map((m) => ({ s: <span className="mono-id">{m.source}</span>, t: <span className="mono-id">{m.target}</span> }))} />
              </section>
              <section>
                <h3 className="mb-2 card-title">Kesehatan</h3>
                {d.issues.length === 0 ? (
                  <p className="caption">Tidak ada masalah kualitas data dari sumber ini.</p>
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
                <h3 className="mb-2 card-title">Aktivitas terbaru</h3>
                <AuditTimeline events={d.activity} emptyText="Belum ada perubahan tercatat pada sumber ini." />
              </section>
            </div>
          ) : null}
        </DrawerContent>
      )}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        {d && (
          <DialogContent
            size="sm"
            title={`Putuskan ${d.source.name}?`}
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
                { label: "Sumber", value: d.source.name },
                { label: "Dampak", value: "Tidak ada data baru yang diterima. Perkiraan memakai data terakhir yang dimuat dan muncul peringatan pembaruan.", emphasis: true },
                { label: "Izin", value: "Mengelola integrasi (Administrator)" },
                { label: "Dapat dibatalkan", value: "Ya. Sambungkan kembali kapan saja; sinkronisasi yang terlewat akan diisi." },
              ]}
            />
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
