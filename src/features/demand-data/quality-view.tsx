"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { AlertOctagon, AlertTriangle, CheckCircle2, Database, Gauge, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { DataQualityIssue, StatusKey } from "@/types/domain";
import { getDataQualityIssue, listDataQuality, retryDataCheck, updateDataQualityIssue } from "@/lib/api/data";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader, PageSection } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { SeverityBadge, StatusBadge, STATUS } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, PermissionNotice } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EntityId, ProductIdentity, UserIdentity } from "@/components/entities/identity";
import { MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { AuditTimeline } from "@/components/governance/audit";
import { pick, localized } from "@/lib/i18n";

const TYPE_LABELS: Record<DataQualityIssue["type"], string> = localized({
  missing_records: "Data belum lengkap",
  duplicate_records: "Data duplikat",
  missing_dimensions: "Dimensi belum lengkap",
  late_data: "Data terlambat",
  unexpected_zero: "Permintaan nol tidak wajar",
  extreme_outlier: "Nilai ekstrem",
  schema_mismatch: "Skema tidak cocok",
  source_unavailable: "Sumber tidak tersedia",
}, {
  missing_records: "Missing records",
  duplicate_records: "Duplicate records",
  missing_dimensions: "Missing dimensions",
  late_data: "Late data",
  unexpected_zero: "Unexpected zero demand",
  extreme_outlier: "Extreme outlier",
  schema_mismatch: "Schema mismatch",
  source_unavailable: "Source unavailable",
});

/** PAGE-DATA-QUALITY: make data readiness operationally visible. */
export function QualityView() {
  const state = useListState({ filterKeys: ["severity", "status", "source", "type"], defaultSort: "severity", defaultDir: "asc" });
  const q = useApiQuery(["dq", state.query], (c) => listDataQuality(c, state.query), { keepPrevious: true });
  const selectedId = state.getParam("id");
  const sourceName = (id: string) => q.data?.sources.find((s) => s.id === id)?.name ?? id;

  const columns = React.useMemo<ColumnDef<DataQualityIssue, unknown>[]>(
    () => [
      { id: "severity", header: pick("Tingkat", "Severity"), meta: { width: "120px", sortKey: "severity" } satisfies ColumnMeta, cell: ({ row }) => <SeverityBadge severity={row.original.severity} size="sm" /> },
      {
        id: "issue",
        header: pick("Masalah", "Issue"),
        meta: { width: "minmax(280px, 3fr)", pinned: true, label: pick("Masalah", "Issue") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.title}</span>
            <span className="mt-0.5 truncate text-xs text-fg-tertiary">
              {TYPE_LABELS[row.original.type]} · {row.original.id.toUpperCase().replace("_", "-")}
            </span>
          </span>
        ),
      },
      { id: "source", header: pick("Sumber", "Source"), meta: { width: "minmax(150px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{sourceName(row.original.sourceId)}</span> },
      // Count read as context with the issue, so it shares the left axis (PAGE-DQ-TABLE-002).
      { id: "skus", header: pick("SKU terdampak", "SKUs affected"), meta: { width: "130px", numeric: true, align: "left", sortKey: "affectedSkus" } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.affectedSkus) },
      { id: "detected", header: pick("Terdeteksi", "Detected"), meta: { width: "120px", sortKey: "detectedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatRelative(row.original.detectedAt)}</span> },
      { id: "owner", header: pick("Penanggung jawab", "Owner"), meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      { id: "status", header: "Status", meta: { width: "140px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data?.sources],
  );

  const s = q.data?.summary;
  return (
    <PageContainer>
      <PageHeader title={pick("Kualitas Data", "Data quality")} description={pick("Apakah data siap untuk perkiraan? Masalah yang menghambat menghentikan proses; peringatan menurunkan akurasi.", "Is the demand data ready for forecasting? Blocking issues stop runs; warnings reduce accuracy.")} />
      <MetricStrip>
        <MetricCard
          variant="compact"
          icon={AlertOctagon}
          tone={s?.blocking ? "critical" : "neutral"}
          label={pick("Masalah yang Menghambat", "Blocking issues")}
          value={s ? formatNumber(s.blocking) : "—"}
          meta={s ? (s.blocking ? pick(`${formatNumber(s.blocking)} masalah perlu ditangani`, `${formatNumber(s.blocking)} ${s.blocking === 1 ? "issue needs" : "issues need"} attention`) : pick("Tidak ada yang menghambat", "Nothing blocking")) : undefined}
          href="/demand-data/quality?severity=blocking"
          destination={pick("tampilkan masalah yang menghambat", "shows blocking issues")}
        />
        <MetricCard
          variant="compact"
          icon={AlertTriangle}
          label={pick("Peringatan", "Warnings")}
          value={s ? formatNumber(s.warnings) : "—"}
          meta={pick("Dapat menurunkan akurasi", "May affect forecast accuracy")}
          href="/demand-data/quality?severity=warning&status=open,investigating"
          destination={pick("tampilkan peringatan", "shows warnings")}
        />
        <MetricCard
          variant="compact"
          icon={Gauge}
          label={pick("Cakupan", "Coverage")}
          value={s ? formatPercent(s.coverage) : "—"}
          meta={pick("SKU tanpa masalah terbuka", "of SKUs without open issues")}
          tooltip={s ? pick(`Perkiraan bagian SKU-hari dari ${formatNumber(s.skus)} SKU dalam 28 hari terakhir yang lolos semua pemeriksaan.`, `Estimated share of SKU-days across ${formatNumber(s.skus)} SKUs in the last 28 days that pass all checks.`) : undefined}
        />
        <MetricCard
          variant="compact"
          icon={Database}
          label={pick("Sumber Bermasalah", "Sources with problems")}
          value={q.data ? formatNumber(q.data.sources.filter((x) => x.status === "failed" || x.status === "warning").length) : "—"}
          meta={q.data ? pick(`dari ${q.data.sources.length} sumber`, `of ${q.data.sources.length} sources`) : undefined}
          href="/demand-data/sources"
          destination={pick("buka sumber data", "opens data sources")}
        />
      </MetricStrip>
      {q.data && (
        <PageSection title={pick("Kebaruan Sumber", "Source freshness")}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {q.data.sources.map((src) => (
              <li key={src.id}>
                <Link href={`/demand-data/sources?id=${src.id}`} className="flex h-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-focus">
                  <span className="truncate body-sm font-semibold text-fg" title={src.name}>
                    {src.name}
                  </span>
                  <StatusBadge status={src.status} size="sm" className="self-start" />
                  <FreshnessIndicator variant="cell" className="mt-auto" timestamp={src.lastSuccessAt} label={pick("Berhasil terakhir", "Last success")} source={src.name} />
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
      <DataTable
        label={pick("Masalah kualitas data", "Data quality issues")}
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Masalah kualitas data tidak dapat dimuat.", "Data quality issues could not be loaded.")}
        storageKey="dq"
        activeRowId={selectedId}
        onRowClick={(r) => state.setParam("id", r.id)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari masalah", "Search issues")}
            facets={[
              { key: "severity", label: pick("Tingkat", "Severity"), primary: true, options: [{ value: "blocking", label: pick("Menghambat", "Blocking") }, { value: "warning", label: pick("Peringatan", "Warning") }, { value: "info", label: "Info" }] },
              { key: "status", label: "Status", primary: true, options: (["open", "investigating", "resolved", "dismissed"] as StatusKey[]).map((v) => ({ value: v, label: STATUS[v].label })) },
              { key: "source", label: pick("Sumber", "Source"), options: (q.data?.sources ?? []).map((x) => ({ value: x.id, label: x.name })) },
              { key: "type", label: pick("Jenis masalah", "Issue type"), options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        }
        empty={
          state.activeFilterCount > 0 ? (
            <EmptyState title={pick("Tidak ada masalah kualitas data yang cocok dengan filter.", "No data quality issues match the current filters.")} action={<Button variant="secondary" onClick={state.clearFilters}>{pick("Hapus filter", "Clear filters")}</Button>} />
          ) : (
            <EmptyState icon={ShieldCheck} title={pick("Belum ada masalah kualitas data yang terdeteksi.", "No data quality issues have been detected.")} description={pick("Semua pemeriksaan lolos. Masalah baru muncul di sini begitu ada pemeriksaan yang gagal.", "All checks pass. New issues appear here as soon as a check fails.")} />
          )
        }
      />
      <IssueDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
    </PageContainer>
  );
}

function IssueDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, session } = useSession();
  const q = useApiQuery(["dq-issue", id], (c) => getDataQualityIssue(c, id as string), { enabled: !!id });
  const [resolve, setResolve] = React.useState<null | "resolved" | "dismissed">(null);
  const [note, setNote] = React.useState("");
  const invalidate = [["dq"], ["dq-issue"], ["overview"], ["nav-counts"]] as const;
  const update = useApiMutation((c, v: { status?: DataQualityIssue["status"]; ownerId?: string | null; note?: string }) => updateDataQualityIssue(c, id as string, v), {
    invalidate,
    success: (i) => `${i.title}: ${i.status}`,
    failure: pick("Masalah tidak dapat diperbarui.", "The issue was not updated."),
    onSuccess: () => setResolve(null),
  });
  const retry = useApiMutation((c, _v: void) => retryDataCheck(c, id as string), {
    invalidate,
    success: pick("Pemeriksaan dijalankan ulang: masalah masih ada.", "Check re-run: the issue is still present."),
    successDescription: pick("Data di sumber belum berubah. Ikuti tindakan yang disarankan.", "The data has not changed at the source. Follow the recommended action."),
    failure: pick("Pemeriksaan tidak dapat dijalankan ulang.", "The check could not be re-run."),
  });
  const d = q.data;
  const closed = d && (d.issue.status === "resolved" || d.issue.status === "dismissed");
  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DrawerContent
          size="md"
          eyebrow={<EntityId value={id.toUpperCase().replace("_", "-")} copy={false} />}
          title={d?.issue.title ?? pick("Masalah kualitas data", "Data quality issue")}
          footer={
            d && can("data.manage") && !closed ? (
              <>
                <Button variant="ghost" onClick={() => retry.mutate()} loading={retry.isPending}>
                  <RefreshCw aria-hidden /> {pick("Periksa ulang", "Retry check")}
                </Button>
                <Button variant="secondary" onClick={() => { setNote(""); setResolve("dismissed"); }}>
                  {pick("Abaikan", "Dismiss")}
                </Button>
                <Button variant="primary" onClick={() => { setNote(""); setResolve("resolved"); }}>
                  <CheckCircle2 aria-hidden /> {pick("Tandai selesai", "Mark resolved")}
                </Button>
              </>
            ) : undefined
          }
        >
          {q.isPending ? (
            <DetailSkeleton />
          ) : q.isError ? (
            <ErrorState compact what={pick("Masalah ini tidak dapat dimuat.", "This issue could not be loaded.")} error={q.error} onRetry={() => q.refetch()} />
          ) : d ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={d.issue.severity} />
                <StatusBadge status={d.issue.status} />
              </div>
              <section>
                <h3 className="mb-1 card-title">{pick("Apa yang terjadi?", "What happened?")}</h3>
                <p className="body-sm text-fg-secondary">{d.issue.description}</p>
              </section>
              <DescriptionList
                columns={2}
                items={[
                  { label: pick("Cakupan terdampak", "Affected scope"), value: pick(`${formatNumber(d.issue.affectedSkus)} SKU · ${formatNumber(d.issue.affectedLocations)} lokasi`, `${formatNumber(d.issue.affectedSkus)} SKUs · ${formatNumber(d.issue.affectedLocations)} locations`) },
                  { label: pick("Terdeteksi", "Detected"), value: formatDateTime(d.issue.detectedAt) },
                  { label: pick("Sumber", "Source"), value: d.source ? <Link href={`/demand-data/sources?id=${d.source.id}`} className="text-primary hover:underline">{d.source.name}</Link> : "—" },
                  { label: pick("Penanggung jawab", "Owner"), value: <UserIdentity userId={d.issue.ownerId} /> },
                ]}
              />
              <section className="rounded-lg border border-border bg-subtle p-3.5">
                <h3 className="mb-1 card-title">{pick("Dampak pada perkiraan", "Forecast impact")}</h3>
                <p className="body-sm text-fg-secondary">{d.issue.forecastImpact}</p>
                <h3 className="mb-1 mt-3 card-title">{pick("Tindakan yang disarankan", "Recommended action")}</h3>
                <p className="body-sm text-fg-secondary">{d.issue.recommendedAction}</p>
              </section>
              {!can("data.manage") ? (
                <PermissionNotice permission="data.manage" compact />
              ) : (
                !closed && (
                  <div className="flex flex-wrap gap-2">
                    {d.issue.ownerId !== session.userId && (
                      <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ ownerId: session.userId })}>
                        <UserCheck aria-hidden /> {pick("Tugaskan ke saya", "Assign to me")}
                      </Button>
                    )}
                    {d.issue.status === "open" && (
                      <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: "investigating", ownerId: d.issue.ownerId ?? session.userId })}>
                        {pick("Mulai investigasi", "Start investigating")}
                      </Button>
                    )}
                  </div>
                )
              )}
              {d.products.length > 0 && (
                <section>
                  <h3 className="mb-2 card-title">{pick("Contoh produk terdampak", "Sample of affected products")}</h3>
                  <ul className="flex flex-col gap-2">
                    {d.products.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <ProductIdentity product={p} href={`/forecasting/detail/${p.id}`} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="mb-2 card-title">{pick("Aktivitas", "Activity")}</h3>
                <AuditTimeline events={d.activity} emptyText={pick(`Belum ada tindakan. Terdeteksi ${formatRelative(d.issue.detectedAt)} oleh pemeriksaan otomatis; penanggung jawab ${actorName(d.issue.ownerId)}.`, `No actions yet. Detected ${formatRelative(d.issue.detectedAt)} by automated checks; owner ${actorName(d.issue.ownerId)}.`)} />
              </section>
            </div>
          ) : null}
        </DrawerContent>
      )}
      <Dialog open={!!resolve} onOpenChange={(o) => !o && setResolve(null)}>
        {resolve && d && (
          <DialogContent
            size="sm"
            title={resolve === "resolved" ? pick("Tandai masalah ini selesai?", "Mark this issue resolved?") : pick("Abaikan masalah ini?", "Dismiss this issue?")}
            description={resolve === "resolved" ? pick("Masalah yang selesai tidak lagi menghambat pemeriksaan. Jelaskan cara memperbaikinya.", "Resolved issues stop blocking validation. Explain how it was fixed.") : pick("Masalah yang diabaikan ditutup tanpa perbaikan. Jelaskan mengapa tidak perlu tindakan.", "Dismissed issues are closed without a fix. Explain why no action is needed.")}
            footer={
              <>
                <Button variant="ghost" onClick={() => setResolve(null)}>
                  {pick("Batal", "Cancel")}
                </Button>
                <Button variant="primary" disabled={note.trim().length < 5} loading={update.isPending} onClick={() => update.mutate({ status: resolve, note })}>
                  {resolve === "resolved" ? pick("Tandai selesai", "Mark resolved") : pick("Abaikan masalah", "Dismiss issue")}
                </Button>
              </>
            }
          >
            <Field label={pick("Catatan", "Note")} htmlFor="dq-note" required hint={pick("Tercatat di riwayat aktivitas. Minimal 5 karakter.", "Recorded in the audit log. At least 5 characters.")}>
              <Textarea id="dq-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
