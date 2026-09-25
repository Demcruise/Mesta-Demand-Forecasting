"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Pencil, TableProperties } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { exportForecastRows, listForecastRows, listRuns, type ExplorerRow } from "@/lib/api/forecasting";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { formatDate, formatDateTime, formatNumber, pluralize } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { downloadExport, type ExportFormat } from "@/lib/export";
import { FilterBar } from "@/components/tables/filter-bar";
import { SavedViewsMenu } from "@/components/tables/saved-views";
import { StatusBadge } from "@/components/feedback/status";
import { EmptyState, InlineAlert } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { ProductIdentity, scopeLabel } from "@/components/entities/identity";
import { ForecastDelta } from "@/components/forecasting/metrics";
import { Sparkline } from "@/components/charts/small-charts";
import { Tooltip } from "@/components/ui/overlay";
import { OverrideDialog } from "@/features/forecast-detail/override-dialog";
import { ForecastDrawer } from "./forecast-drawer";
import { pick } from "@/lib/i18n";

const FILTER_KEYS = ["category", "status", "exceptions", "delta", "lifecycle"] as const;

/**
 * PAGE-FORECAST-EXPLORER: scan forecast outputs across many entities. Clicking a row
 * opens a drawer without losing list context (filters, sort, page stay in the URL).
 */
export function ExplorerView() {
  const { can } = useSession();
  const state = useListState({ filterKeys: FILTER_KEYS, defaultSort: "forecast", defaultDir: "desc" });
  const runParam = state.getParam("run");
  const selectedId = state.getParam("id");
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [overrideOpen, setOverrideOpen] = React.useState(false);

  const runs = useApiQuery(["runs", "with-results"], (c) => listRuns(c, { pageSize: 50, filters: { status: ["published", "completed"] } }));
  const q = useApiQuery(["forecast-rows", runParam, state.query], (c) => listForecastRows(c, runParam, state.query), { keepPrevious: true });
  const run = q.data?.run;
  React.useEffect(() => setSelection({}), [runParam]);

  const exportMutation = useApiMutation(async (c, format: ExportFormat) => ({ format, ...(await exportForecastRows(c, runParam, state.query)) }), {
    failure: pick("Ekspor gagal.", "Export failed."),
    success: (r) => pick(`Mengekspor ${formatNumber(r.rows.length)} baris`, `Exported ${formatNumber(r.rows.length)} rows`),
    successDescription: pick("Filter dan urutan yang aktif diterapkan.", "Current filters and sort were applied."),
    onSuccess: (r) => {
      track("export_requested", { rows: r.rows.length, surface: "explorer", format: r.format });
      downloadExport(
        r.format,
        `forecast-${r.run.id}`,
        [pick("Proses", "Run"), "SKU", pick("Produk", "Product"), pick("Kategori", "Category"), pick("Perkiraan", "Forecast"), "Ubah manual", pick("Perkiraan sebelumnya", "Previous run"), "Aktual periode sebelumnya", pick("Perubahan %", "Change %"), "Batas bawah 80%", "Batas atas 80%", "Status", "Perlu ditinjau"],
        r.rows.map((x) => [r.run.id, x.product.sku, x.product.name, x.product.category, x.forecast, x.overrideUnits, x.previousForecast, x.actualLastPeriod, Number((x.deltaPercent * 100).toFixed(1)), x.lowerBound, x.upperBound, x.status, x.exceptionCount]),
        r.run.id,
      );
    },
  });

  const selectedRows = (q.data?.page.items ?? []).filter((r) => selection[r.id]);
  const selectedUnits = selectedRows.reduce((s, r) => s + r.forecast, 0);

  const columns = React.useMemo<ColumnDef<ExplorerRow, unknown>[]>(
    () => [
      {
        id: "product",
        header: pick("Produk", "Product"),
        meta: { width: "minmax(260px, 2.4fr)", sortKey: "product", pinned: true, label: pick("Produk", "Product") } satisfies ColumnMeta,
        cell: ({ row }) => <ProductIdentity product={row.original.product} />,
      },
      {
        id: "forecast",
        header: "Forecast",
        meta: { width: "120px", numeric: true, sortKey: "forecast", description: pick("Total perkiraan selama periode perkiraan. Nilai yang diubah manual menampilkan hasil ubahannya.", "Total forecast over the run horizon. Overridden values show the override.") } satisfies ColumnMeta,
        cell: ({ row }) => {
          const r = row.original;
          return r.overrideUnits != null ? (
            <Tooltip content={pick(`Perkiraan model ${formatNumber(r.forecast)}; perubahan manual ${formatNumber(r.overrideUnits)}`, `Model forecast ${formatNumber(r.forecast)}; override ${formatNumber(r.overrideUnits)}`)}>
              <span tabIndex={0} className="inline-flex items-center gap-1 font-semibold">
                <Pencil className="size-3 text-primary" aria-label={pick("Diubah manual", "Overridden")} />
                {formatNumber(r.overrideUnits)}
              </span>
            </Tooltip>
          ) : (
            <span className="font-semibold">{formatNumber(r.forecast)}</span>
          );
        },
      },
      {
        id: "previous",
        header: pick("Sebelumnya", "Previous"),
        meta: { width: "110px", numeric: true, sortKey: "previous", hideBelow: "md", description: pick("Perkiraan dari proses terbit sebelumnya untuk periode yang sama.", "Forecast from the previous published run for the same horizon.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className="text-fg-secondary">{formatNumber(row.original.previousForecast)}</span>,
      },
      {
        id: "actual",
        header: pick("Aktual (sebelumnya)", "Actual (prior)"),
        meta: { width: "120px", numeric: true, sortKey: "actual", hideBelow: "lg", description: pick("Permintaan aktual pada jumlah hari yang sama tepat sebelum periode perkiraan.", "Actual demand over the same number of days immediately before the forecast period.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className="text-fg-secondary">{formatNumber(row.original.actualLastPeriod)}</span>,
      },
      {
        id: "delta",
        header: pick("Perubahan", "Change"),
        meta: { width: "100px", numeric: true, sortKey: "deltaPercent", description: pick("Perubahan dibanding perkiraan sebelumnya. Ditandai bila melewati batas tinjauan 15%.", "Change versus the previous run. Highlighted above the 15% review threshold.") } satisfies ColumnMeta,
        cell: ({ row }) => <ForecastDelta percent={row.original.deltaPercent} size="sm" />,
      },
      {
        id: "trend",
        header: pick("Tren", "Trend"),
        meta: { width: "112px", hideBelow: "lg", description: pick("Permintaan mingguan: 8 minggu aktual, lalu minggu perkiraan.", "Weekly demand: 8 weeks of actuals, then forecast weeks.") } satisfies ColumnMeta,
        cell: ({ row }) => <Sparkline values={row.original.trend} forecastFrom={8} />,
      },
      {
        id: "interval",
        header: pick("Rentang 80%", "80% interval"),
        meta: { width: "150px", numeric: true, sortKey: "width", hideBelow: "xl", description: pick("Rentang yang diperkirakan memuat permintaan aktual 80% dari waktu.", "Range expected to contain actual demand 80% of the time.") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="text-xs text-fg-secondary tabular">
            {formatNumber(row.original.lowerBound)}–{formatNumber(row.original.upperBound)}
          </span>
        ),
      },
      {
        id: "status",
        header: "Status",
        meta: { width: "140px", sortKey: "status" } satisfies ColumnMeta,
        cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
      },
      {
        id: "exceptions",
        header: pick("Perlu Ditinjau", "Exceptions"),
        meta: { width: "100px", numeric: true, sortKey: "exceptions", hideBelow: "md" } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.exceptionCount > 0 ? (
            <Link href={`/planning/exceptions?id=${row.original.exceptionIds[0]}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-warning-fg hover:underline">
              {row.original.exceptionCount} terbuka
            </Link>
          ) : (
            <span className="text-fg-tertiary">{pick("Tidak ada", "None")}</span>
          ),
      },
    ],
    [],
  );

  const bulkBar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="body-sm font-semibold text-fg">
        {pluralize(selectedRows.length, pick("perkiraan", "forecast"))} dipilih · {formatNumber(selectedUnits)} unit
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {can("forecast.override") && (
          <Button size="sm" variant="primary" onClick={() => setOverrideOpen(true)} disabled={run?.status !== "published"}>
            <Pencil aria-hidden /> Ubah perkiraan terpilih
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
          Hapus pilihan
        </Button>
      </div>
    </div>
  );

  return (
    <PageContainer>
      <PageHeader
        title={pick("Perkiraan Permintaan", "Forecast explorer")}
        description={pick("Bandingkan perkiraan produk dan lihat perubahan yang perlu ditinjau.", "Scan forecasts across products, find unusual changes and open any product to investigate.")}
        meta={
          run ? (
            <>
              <span className="text-xs font-medium text-fg-secondary">
                {run.status === "published" ? pick("Acuan perencanaan", "Planning baseline") : pick("Belum diterbitkan", "Unpublished run")} · {scopeLabel(run)} · periode {run.horizonDays} hari sejak {formatDate(run.completedAt)}
              </span>
              <FreshnessIndicator timestamp={run.completedAt} label={pick("Dibuat", "Generated")} />
            </>
          ) : undefined
        }
        actions={
          <Select
            className="w-[min(26rem,90vw)]"
            aria-label={pick("Proses perkiraan", "Forecast run")}
            prefix="Run:"
            value={run?.id}
            onValueChange={(v) => state.setParams({ run: v, id: null }, { resetPage: true })}
            placeholder={pick("Perkiraan terbit terakhir", "Latest published run")}
            options={(runs.data?.items ?? []).map((r) => ({ value: r.id, label: `${r.id} · ${r.name}`, description: pick(`${r.status === "published" ? "Diterbitkan" : "Selesai, belum diterbitkan"} · ${formatDateTime(r.completedAt)}`, `${r.status === "published" ? "Published" : "Completed, not published"} · ${formatDateTime(r.completedAt)}`) }))}
          />
        }
      />
      {run && run.status !== "published" && (
        <InlineAlert tone="info" title={pick("Anda melihat proses yang belum diterbitkan.", "You are viewing an unpublished run.")}>
          Perubahan manual hanya dapat diterapkan pada acuan perencanaan yang sudah diterbitkan.{" "}
          <Link href={`/forecasting/runs/${run.id}`} className="font-semibold text-primary hover:underline">
            Open run
          </Link>
        </InlineAlert>
      )}
      <DataTable
        label={pick("Perkiraan per produk", "Forecasts by product")}
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Perkiraan tidak dapat dimuat.", "Forecasts could not be loaded.")}
        storageKey="explorer"
        maxHeight="min(70vh, 44rem)"
        pageSizeOptions={[25, 50, 100, 250]}
        activeRowId={selectedId ? q.data?.page.items.find((r) => r.productId === selectedId)?.id : null}
        onRowClick={(r) => {
          track("forecast_opened", { from: "explorer" });
          state.setParam("id", r.productId);
        }}
        selection={can("forecast.override") ? { selected: selection, onChange: setSelection } : undefined}
        bulkBar={bulkBar}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        onExport={can("export") ? (format) => exportMutation.mutate(format) : undefined}
        exportLabel={exportMutation.isPending ? pick("Mengekspor…", "Exporting…") : pick(`Ekspor ${q.data ? formatNumber(q.data.page.total) : ""} baris`, pick(`Ekspor ${q.data ? formatNumber(q.data.page.total) : ""} baris`, pick(`Ekspor ${q.data ? formatNumber(q.data.page.total) : ""} baris`, `Export ${q.data ? formatNumber(q.data.page.total) : ""} rows`)))}
        toolbarEnd={<SavedViewsMenu surface="explorer" />}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari produk, SKU, atau merek", "Search product, SKU or brand")}
            sortOptions={[
              { value: "forecast:desc", label: pick("Perkiraan terbesar", "Largest forecast"), dir: "desc" },
              { value: "deltaPercent:desc", label: pick("Kenaikan terbesar", "Largest increase"), dir: "desc" },
              { value: "deltaPercent:asc", label: pick("Penurunan terbesar", "Largest decrease"), dir: "asc" },
              { value: "width:desc", label: pick("Rentang terlebar", "Widest interval"), dir: "desc" },
              { value: "exceptions:desc", label: pick("Paling banyak ditinjau", "Most exceptions"), dir: "desc" },
              { value: "product:asc", label: pick("Produk A–Z", "Product A–Z"), dir: "asc" },
            ]}
            facets={[
              { key: "category", label: pick("Kategori", "Category"), primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              {
                key: "status",
                label: "Status",
                primary: true,
                options: [
                  { value: "needs_review", label: pick("Perlu ditinjau", "Needs review") },
                  { value: "overridden", label: pick("Diubah manual", "Overridden") },
                  { value: "normal", label: pick("Tidak ada masalah", "No issues") },
                ],
              },
              {
                key: "delta",
                label: pick("Perubahan vs sebelumnya", "Change vs previous"),
                options: [
                  { value: "increase", label: pick("Naik lebih dari 5%", "Increase over 5%") },
                  { value: "decrease", label: pick("Turun lebih dari 5%", "Decrease over 5%") },
                  { value: "stable", label: pick("Dalam ±5%", "Within ±5%") },
                ],
              },
              {
                key: "exceptions",
                label: pick("Perlu Ditinjau", "Exceptions"),
                options: [
                  { value: "with", label: pick("Ada yang terbuka", "Has open exceptions") },
                  { value: "without", label: pick("Tidak ada yang terbuka", "No open exceptions") },
                ],
              },
              {
                key: "lifecycle",
                label: pick("Siklus produk", "Lifecycle"),
                options: [
                  { value: "new", label: pick("Baru", "New") },
                  { value: "core", label: pick("Inti", "Core") },
                  { value: "seasonal", label: pick("Musiman", "Seasonal") },
                  { value: "end-of-life", label: pick("Akhir masa", "End of life") },
                ],
              },
            ]}
          />
        }
        empty={
          <EmptyState
            icon={TableProperties}
            title={pick("Tidak ada perkiraan yang cocok dengan filter.", "No forecasts match the current filters.")}
            description={pick("Coba kata kunci lain atau hapus filter untuk melihat semua produk pada proses ini.", "Try a different search or clear filters to see all products in this run.")}
            action={
              <Button variant="secondary" onClick={state.clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />
      <ForecastDrawer productId={selectedId} runId={run?.id ?? null} onClose={() => state.setParam("id", null)} />
      {run && (
        <OverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          runId={run.id}
          productIds={selectedRows.map((r) => r.productId)}
          originalUnits={selectedUnits}
          label={selectedRows.length === 1 ? (selectedRows[0]?.product.name ?? "") : `${selectedRows.length} selected SKUs`}
          horizonDays={run.horizonDays}
          onDone={() => setSelection({})}
        />
      )}
    </PageContainer>
  );
}

