"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { ArrowUpRight, CheckCircle2, ListChecks, Pencil, TriangleAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ExceptionType, ForecastException, StatusKey } from "@/types/domain";
import { getException, listExceptions, updateExceptions, type ExceptionRow } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { USERS } from "@/lib/mock/directory";
import { formatDateTime, formatDeltaPercent, formatNumber, formatPercent, formatRelative, pluralize } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { SavedViewsMenu } from "@/components/tables/saved-views";
import { SeverityBadge, StatusBadge, STATUS } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { EntityId, ProductIdentity, UserIdentity } from "@/components/entities/identity";
import { ForecastInterval, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { Sparkline } from "@/components/charts/small-charts";
import { ActivityList } from "@/components/governance/audit";
import { OverrideDialog } from "@/features/forecast-detail/override-dialog";

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  large_delta: "Perubahan perkiraan besar",
  low_confidence: "Rentang lebar",
  high_error: "Selisih perkiraan tinggi",
  data_freshness: "Data belum diperbarui",
  data_quality: "Masalah data",
  model_anomaly: "Anomali model",
  manual_override: "Diubah manual",
  threshold_breach: "Melewati batas",
};

const RECOMMENDED: Record<ExceptionType, string[]> = {
  large_delta: ["Periksa apakah ada promosi, perubahan daftar produk, atau kejadian pasokan yang menjelaskan perubahan ini.", "Jika model kurang konteks, terapkan perubahan manual disertai bukti.", "Jika perubahannya memang diharapkan, tandai selesai dengan catatan."],
  low_confidence: ["Tinjau volatilitas permintaan dan nilai ekstrem terakhir.", "Rencanakan stok pengaman memakai batas atas, bukan angka perkiraan saja.", "Pertimbangkan model permintaan intermiten untuk produk lambat laku."],
  high_error: ["Bandingkan perkiraan terakhir dengan aktual di Detail Perkiraan.", "Tandai untuk tinjauan model bila selisih berlanjut lebih dari 2 minggu."],
  data_freshness: ["Periksa status sumber di Sumber Data.", "Gunakan perkiraan terdampak dengan hati-hati sampai sumber tersinkron."],
  data_quality: ["Buka masalah kualitas data terkait.", "Hindari perubahan manual berdasarkan riwayat terdampak sampai diperbaiki."],
  model_anomaly: ["Tandai untuk tinjauan model.", "Bandingkan dengan model cadangan."],
  manual_override: ["Pastikan perubahan manual masih berlaku."],
  threshold_breach: ["Tinjau terhadap batas yang dikonfigurasi."],
};

/** PAGE-EXCEPTIONS: prioritise forecast items that need human attention. */
export function ExceptionsView() {
  const { can, session } = useSession();
  const state = useListState({ filterKeys: ["severity", "status", "type", "category", "owner"], defaultSort: "severity", defaultDir: "asc" });
  const q = useApiQuery(["exceptions", state.query], (c) => listExceptions(c, state.query), { keepPrevious: true });
  const selectedId = state.getParam("id");
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [bulk, setBulk] = React.useState<null | "resolved" | "dismissed">(null);
  const [note, setNote] = React.useState("");
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  const bulkUpdate = useApiMutation((c, v: { status?: ForecastException["status"]; ownerId?: string | null; note?: string }) => updateExceptions(c, selectedIds, v), {
    invalidate: [["exceptions"], ["exception"], ["overview"], ["nav-counts"], ["forecast-rows"]],
    success: (r) => `${pluralize(r.length, "exception")} updated`,
    failure: "Item tidak dapat diperbarui.",
    onSuccess: (_r, v) => {
      if (v.status === "resolved") track("exception_resolved", { count: selectedIds.length });
      setSelection({});
      setBulk(null);
    },
  });

  const columns = React.useMemo<ColumnDef<ExceptionRow, unknown>[]>(
    () => [
      {
        id: "exception",
        header: "Masalah",
        meta: { width: "minmax(200px, 1.4fr)", pinned: true, label: "Masalah" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{EXCEPTION_TYPE_LABELS[row.original.type]}</span>
            <span className="mono-id text-fg-tertiary">{row.original.id}</span>
          </span>
        ),
      },
      { id: "severity", header: "Tingkat", meta: { width: "110px", sortKey: "severity" } satisfies ColumnMeta, cell: ({ row }) => <SeverityBadge severity={row.original.severity} size="sm" /> },
      { id: "entity", header: "Produk", meta: { width: "minmax(240px, 2fr)", sortKey: "product" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} /> },
      {
        id: "value",
        header: "Nilai",
        meta: { width: "150px", numeric: true, sortKey: "value", description: "Nilai terukur dibanding batas yang dikonfigurasi." } satisfies ColumnMeta,
        cell: ({ row }) => {
          const e = row.original;
          if (e.valueUnit === "%") {
            const v = e.type === "large_delta" ? formatDeltaPercent(e.value) : formatPercent(e.value, 0);
            return (
              <span className="flex flex-col items-end">
                <span className="font-semibold">{v}</span>
                <span className="text-[0.6875rem] text-fg-tertiary">threshold {formatPercent(e.threshold, 0)}</span>
              </span>
            );
          }
          return <span className="text-xs text-fg-secondary">{pluralize(e.affectedSkus, "SKU")}</span>;
        },
      },
      { id: "detected", header: "Terdeteksi", meta: { width: "120px", sortKey: "detectedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatRelative(row.original.detectedAt)}</span> },
      { id: "owner", header: "Penanggung jawab", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      { id: "status", header: "Status", meta: { width: "140px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
    ],
    [],
  );

  const s = q.data?.summary;
  return (
    <PageContainer>
      <PageHeader title="Perlu Ditinjau" description="Item yang memerlukan pemeriksaan atau tindakan, diurutkan berdasarkan tingkat kepentingan. Setiap item menjelaskan mengapa ditandai." />
      <MetricStrip>
        <MetricCard label="Terbuka" value={s ? formatNumber(s.open) : "—"} context="Terbuka, sedang ditelusuri, atau dieskalasi" href="/planning/exceptions?status=open,investigating,escalated" hrefLabel="Lihat yang terbuka" />
        <MetricCard label="Kritis" value={s ? formatNumber(s.critical) : "—"} context="Perubahan 25% atau lebih, atau masalah data yang menghambat" href="/planning/exceptions?severity=critical&status=open,investigating,escalated" hrefLabel="Lihat yang kritis" />
        <MetricCard label="Belum ditugaskan" value={s ? formatNumber(s.unassigned) : "—"} context="Belum ada yang menangani" href="/planning/exceptions?owner=unassigned&status=open" hrefLabel="Lihat yang belum ditugaskan" />
        <MetricCard label="Ditugaskan ke saya" value={s ? formatNumber(s.mine) : "—"} href={`/planning/exceptions?owner=${session.userId}&status=open,investigating,escalated`} hrefLabel="Lihat milik saya" />
      </MetricStrip>
      <DataTable
        label="Item yang perlu ditinjau"
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Item yang perlu ditinjau tidak dapat dimuat."
        storageKey="exceptions"
        activeRowId={selectedId}
        onRowClick={(r) => {
          track("exception_opened", { type: r.type });
          state.setParam("id", r.id);
        }}
        selection={can("exception.update") ? { selected: selection, onChange: setSelection, isSelectable: (r) => r.status !== "resolved" && r.status !== "dismissed" } : undefined}
        bulkBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="body-sm font-semibold">{pluralize(selectedIds.length, "exception")} selected</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ ownerId: session.userId })}>
                <UserCheck aria-hidden /> Assign to me
              </Button>
              <Button size="sm" variant="secondary" loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "investigating", ownerId: session.userId })}>
                Start investigating
              </Button>
              <Button size="sm" variant="primary" onClick={() => { setNote(""); setBulk("resolved"); }}>
                <CheckCircle2 aria-hidden /> Resolve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
                Clear
              </Button>
            </div>
          </div>
        }
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarEnd={<SavedViewsMenu surface="exceptions" />}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Cari ID, produk, atau alasan"
            facets={[
              { key: "status", label: "Status", primary: true, options: (["open", "investigating", "escalated", "resolved", "dismissed"] as StatusKey[]).map((v) => ({ value: v, label: STATUS[v].label })) },
              { key: "severity", label: "Tingkat", primary: true, options: [{ value: "critical", label: "Kritis" }, { value: "warning", label: "Peringatan" }, { value: "info", label: "Info" }] },
              { key: "type", label: "Jenis", options: Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { key: "category", label: "Kategori", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              { key: "owner", label: "Penanggung jawab", options: [{ value: "unassigned", label: "Belum ditugaskan" }, ...USERS.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name }))] },
            ]}
          />
        }
        empty={
          state.activeFilterCount > 0 ? (
            <EmptyState title="Tidak ada item yang cocok dengan filter." action={<Button variant="secondary" onClick={state.clearFilters}>Hapus filter</Button>} />
          ) : (
            <EmptyState icon={ListChecks} title="Tidak ada yang perlu ditinjau." description="Semua perkiraan berada dalam batas yang dikonfigurasi." />
          )
        }
      />
      <ExceptionDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
      <Dialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent
          size="sm"
          title={`Resolve ${pluralize(selectedIds.length, "exception")}?`}
          description="Item yang selesai keluar dari antrean. Catatannya ditambahkan ke aktivitas tiap item dan riwayat aktivitas."
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulk(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={note.trim().length < 5} loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "resolved", note })}>
                Resolve {pluralize(selectedIds.length, "exception")}
              </Button>
            </>
          }
        >
          <Field label="Catatan penyelesaian" htmlFor="bulk-note" required hint="Minimal 5 karakter.">
            <Textarea id="bulk-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="e.g. Confirmed with the category team: expected after range review." />
          </Field>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/** PAGE-EXCEPTION-DETAIL drawer: summary → why triggered → affected → forecast → history → data → actions → activity. */
function ExceptionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, session } = useSession();
  const q = useApiQuery(["exception", id], (c) => getException(c, id as string), { enabled: !!id });
  const [dialog, setDialog] = React.useState<null | "resolved" | "dismissed" | "escalated">(null);
  const [note, setNote] = React.useState("");
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const update = useApiMutation((c, v: { status?: ForecastException["status"]; ownerId?: string | null; note?: string }) => updateExceptions(c, [id as string], v), {
    invalidate: [["exceptions"], ["exception"], ["overview"], ["nav-counts"], ["forecast-rows"]],
    success: (r) => `${r[0]?.id} ${r[0]?.status}`,
    failure: "Item tidak dapat diperbarui.",
    onSuccess: (_r, v) => {
      if (v.status === "resolved") track("exception_resolved", { count: 1 });
      setDialog(null);
    },
  });
  const d = q.data;
  const closed = d && (d.exception.status === "resolved" || d.exception.status === "dismissed");
  return (
    <>
      <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
        {id && (
          <DrawerContent
            size="lg"
            eyebrow={<EntityId value={id} copy={false} />}
            title={d ? EXCEPTION_TYPE_LABELS[d.exception.type] : "Masalah"}
            description={d ? `${d.product.name} · ${d.product.sku}` : undefined}
            footer={
              d && can("exception.update") && !closed ? (
                <>
                  <Button variant="ghost" onClick={() => { setNote(""); setDialog("dismissed"); }}>
                    Dismiss
                  </Button>
                  {d.exception.status !== "escalated" && (
                    <Button variant="secondary" onClick={() => { setNote(""); setDialog("escalated"); }}>
                      <TriangleAlert aria-hidden /> Escalate
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => { setNote(""); setDialog("resolved"); }}>
                    <CheckCircle2 aria-hidden /> Resolve
                  </Button>
                </>
              ) : undefined
            }
          >
            {q.isPending ? (
              <DetailSkeleton />
            ) : q.isError ? (
              <ErrorState compact what="Item ini tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />
            ) : d ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={d.exception.severity} />
                  <StatusBadge status={d.exception.status} />
                  <span className="caption">Detected {formatDateTime(d.exception.detectedAt)}</span>
                </div>
                <section aria-labelledby="ex-why" className="rounded-lg border border-border bg-subtle p-3.5">
                  <h3 id="ex-why" className="mb-1 card-title">
                    Why it was triggered
                  </h3>
                  <p className="body-sm text-fg">{d.exception.reason}</p>
                  {d.exception.valueUnit === "%" && (
                    <p className="mt-1 caption">
                      Measured {d.exception.type === "large_delta" ? formatDeltaPercent(d.exception.value) : formatPercent(d.exception.value, 0)} against a threshold of {formatPercent(d.exception.threshold, 0)}. Thresholds are set in Settings › Forecasting.
                    </p>
                  )}
                </section>
                <DescriptionList
                  columns={2}
                  items={[
                    { label: "Terdampak", value: <ProductIdentity product={d.product} href={`/forecasting/detail/${d.product.id}${d.run ? `?run=${d.run.id}` : ""}`} /> },
                    { label: "Cakupan", value: pluralize(d.exception.affectedSkus, "SKU") },
                    { label: "Proses perkiraan", value: d.run ? <Link href={`/forecasting/runs/${d.run.id}`} className="mono-id text-primary hover:underline">{d.run.id}</Link> : "—" },
                    { label: "Penanggung jawab", value: <UserIdentity userId={d.exception.ownerId} /> },
                  ]}
                />
                {d.row && (
                  <section aria-labelledby="ex-fc">
                    <h3 id="ex-fc" className="mb-2 card-title">
                      Relevant forecast · next {d.run?.horizonDays ?? 28} days
                    </h3>
                    <ForecastInterval lower={d.row.lowerBound} upper={d.row.upperBound} forecast={d.row.forecast} comparison={d.row.previousForecast} unit={d.product.unit} />
                    <div className="mt-3 flex items-center gap-3">
                      <Sparkline values={d.row.trend} forecastFrom={8} width={160} height={36} label={`Weekly demand trend for ${d.product.name}`} />
                      <p className="caption">
                        Historical context: 8 weeks of actuals (grey) then the forecast (blue). Actual in the prior {d.run?.horizonDays ?? 28} days: {formatNumber(d.row.actualLastPeriod)}.
                      </p>
                    </div>
                  </section>
                )}
                {d.dqIssues.length > 0 && (
                  <section aria-labelledby="ex-dq">
                    <h3 id="ex-dq" className="mb-2 card-title">
                      Data quality
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {d.dqIssues.map((i) => (
                        <li key={i.id}>
                          <Link href={`/demand-data/quality?id=${i.id}`} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-hover">
                            <SeverityBadge severity={i.severity} size="sm" />
                            <span className="min-w-0 flex-1 body-sm">{i.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="ex-rec">
                  <h3 id="ex-rec" className="mb-2 card-title">
                    Recommended actions
                  </h3>
                  <ol className="list-decimal pl-5 body-sm text-fg-secondary">
                    {RECOMMENDED[d.exception.type].map((r) => (
                      <li key={r} className="mb-1">
                        {r}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!can("exception.update") ? (
                      <PermissionNotice permission="exception.update" compact />
                    ) : (
                      !closed && (
                        <>
                          {d.exception.ownerId !== session.userId && (
                            <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ ownerId: session.userId })}>
                              <UserCheck aria-hidden /> Assign to me
                            </Button>
                          )}
                          {d.exception.status === "open" && (
                            <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: "investigating", ownerId: d.exception.ownerId ?? session.userId })}>
                              Start investigating
                            </Button>
                          )}
                          {can("forecast.override") && d.row && d.run?.status === "published" && (
                            <Button size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>
                              <Pencil aria-hidden /> Override forecast
                            </Button>
                          )}
                        </>
                      )
                    )}
                    <Link href={`/forecasting/detail/${d.product.id}${d.run ? `?run=${d.run.id}` : ""}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                      Open forecast detail <ArrowUpRight aria-hidden />
                    </Link>
                  </div>
                </section>
                {d.related.length > 0 && (
                  <section aria-labelledby="ex-rel">
                    <h3 id="ex-rel" className="mb-2 card-title">
                      Other exceptions for this product
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {d.related.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 body-sm">
                          <span>
                            <span className="mono-id mr-2">{r.id}</span>
                            {EXCEPTION_TYPE_LABELS[r.type]}
                          </span>
                          <StatusBadge status={r.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="ex-act">
                  <h3 id="ex-act" className="mb-2 card-title">
                    Activity
                  </h3>
                  <ActivityList items={[...d.exception.activity].reverse()} />
                </section>
                {closed && <InlineAlert tone="success" title={`This exception is ${d.exception.status}.`} />}
              </div>
            ) : null}
          </DrawerContent>
        )}
      </Drawer>
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && d && (
          <DialogContent
            size="sm"
            title={dialog === "resolved" ? `Resolve ${d.exception.id}?` : dialog === "dismissed" ? `Dismiss ${d.exception.id}?` : `Escalate ${d.exception.id}?`}
            description={
              dialog === "resolved"
                ? "Jelaskan keputusannya agar orang lain dapat memercayai perkiraan ini."
                : dialog === "dismissed"
                  ? "Item yang diabaikan ditutup tanpa tindakan. Jelaskan mengapa tidak perlu tindakan."
                  : "Item yang dieskalasi diteruskan ke Manajer dan tetap terbuka."
            }
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={note.trim().length < 5} loading={update.isPending} onClick={() => update.mutate({ status: dialog, note })}>
                  {dialog === "resolved" ? "Tandai selesai" : dialog === "dismissed" ? "Abaikan item" : "Eskalasi item"}
                </Button>
              </>
            }
          >
            <Field label="Catatan" htmlFor="ex-note" required hint="Tercatat di aktivitas dan riwayat aktivitas. Minimal 5 karakter.">
              <Textarea id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
          </DialogContent>
        )}
      </Dialog>
      {d?.row && d.run && (
        <OverrideDialog open={overrideOpen} onOpenChange={setOverrideOpen} runId={d.run.id} productIds={[d.product.id]} originalUnits={d.row.forecast} label={d.product.name} horizonDays={d.run.horizonDays} />
      )}
    </>
  );
}
