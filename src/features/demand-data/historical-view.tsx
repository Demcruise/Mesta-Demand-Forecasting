"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { History } from "lucide-react";
import * as React from "react";
import type { DemandRecord, Product } from "@/types/domain";
import { catalogueFacets, listDemand } from "@/lib/api/data";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { addDays, isoDate, startOfToday } from "@/lib/mock/time";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { DateRangeFilter, FilterBar } from "@/components/tables/filter-bar";
import { EmptyState, InlineAlert } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { Tag } from "@/components/feedback/status";
import { ProductIdentity } from "@/components/entities/identity";
import { Tooltip } from "@/components/ui/overlay";
import { pick } from "@/lib/i18n";

type Row = DemandRecord & { product: Product | undefined };

const SOURCE_LABELS: Record<string, string> = { src_pos: "POS", src_erp: "ERP" };

/** PAGE-DEMAND-DATA: the historical demand used for forecasting, paged server-side. */
export function HistoricalView() {
  const { ctx } = useSession();
  const state = useListState({ filterKeys: ["category", "quality"], defaultSort: "date", defaultDir: "desc" });
  const today = startOfToday();
  const from = state.getParam("from") ?? isoDate(addDays(today, -28));
  const to = state.getParam("to") ?? isoDate(addDays(today, -1));
  const locationId = state.getParam("location") ?? "";
  const facets = React.useMemo(() => catalogueFacets(ctx), [ctx]);
  const q = useApiQuery(["demand", state.query, from, to, locationId], (c) => listDemand(c, { ...state.query, from, to, locationId: locationId || undefined }), { keepPrevious: true });
  const rows: Row[] = (q.data?.page.items ?? []).map((r) => ({ ...r, product: q.data?.products.get(r.productId) }));

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { id: "date", header: pick("Tanggal", "Date"), meta: { width: "120px", sortKey: "date" } satisfies ColumnMeta, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatDate(row.original.date)}</span> },
      { id: "product", header: pick("Produk", "Product"), meta: { width: "minmax(260px, 2.5fr)", pinned: true, label: pick("Produk", "Product") } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      {
        id: "units",
        header: pick("Permintaan", "Demand"),
        meta: { width: "110px", numeric: true, description: pick("Unit terjual (POS) atau dipesan (ERP) pada hari itu.", "Units sold (POS) or ordered (ERP) on the day.") } satisfies ColumnMeta,
        cell: ({ row }) => <span className="font-semibold">{formatNumber(row.original.units)}</span>,
      },
      { id: "unit", header: pick("Satuan", "Unit"), meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.product?.unit}</span> },
      { id: "location", header: pick("Lokasi", "Location"), meta: { width: "minmax(140px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: () => <span className="truncate text-fg-secondary">{q.data?.location?.name ?? pick("Semua lokasi", "All locations")}</span> },
      { id: "source", header: pick("Sumber", "Source"), meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{SOURCE_LABELS[row.original.sourceId] ?? row.original.sourceId}</Tag> },
      {
        id: "quality",
        header: pick("Kualitas", "Quality"),
        meta: { width: "120px", description: pick("Hasil pemeriksaan kualitas data untuk catatan ini.", "Result of data quality checks for this record.") } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.quality === "ok" ? (
            <span className="text-xs text-fg-tertiary">{pick("Lolos", "Passed")}</span>
          ) : (
            <Tooltip content={row.original.quality === "blocking" ? pick("Data hilang: tidak ada data POS untuk hari ini (DQ-001).", "Missing record: no POS data received for this day (DQ-001).") : pick("Terkena peringatan kualitas data yang masih terbuka.", "Affected by an open data quality warning.")}>
              <span tabIndex={0}>
                <Tag tone={row.original.quality === "blocking" ? "critical" : "warning"}>{row.original.quality === "blocking" ? pick("Hilang", "Missing") : pick("Peringatan", "Warning")}</Tag>
              </span>
            </Tooltip>
          ),
      },
      { id: "updated", header: pick("Diperbarui", "Updated"), meta: { width: "150px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateTime(row.original.updatedAt)}</span> },
    ],
    [q.data?.location],
  );

  return (
    <PageContainer>
      <PageHeader
        title={pick("Permintaan Historis", "Historical demand")}
        description={pick("Permintaan harian per produk, seperti yang dipakai model perkiraan. Catatan diambil per halaman dari penyimpanan permintaan.", "Daily demand by product, as used by the forecasting models. Records are queried page by page from the demand store.")}
        meta={
          <>
            {q.data && <span className="text-xs font-medium text-fg-secondary">{pick(`Riwayat tersedia sejak ${formatDate(q.data.window.earliest)}`, `History available from ${formatDate(q.data.window.earliest)}`)}</span>}
            <FreshnessIndicator timestamp={q.data?.page.asOf} label={pick("Data POS diperbarui", "POS data updated")} source={pick("Transaksi POS", "POS transactions")} />
          </>
        }
      />
      {state.query.filters?.quality?.length ? (
        <InlineAlert tone="info" title={pick("Filter kualitas memeriksa maksimal 5.000 catatan.", "Quality filter scans at most 5,000 records.")}>
          {pick("Persempit rentang tanggal atau kategori untuk hasil lengkap.", "Narrow the date range or category for complete results.")}
        </InlineAlert>
      ) : null}
      <DataTable
        label={pick("Catatan permintaan historis", "Historical demand records")}
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Permintaan historis tidak dapat dimuat.", "Historical demand could not be loaded.")}
        storageKey="historical"
        maxHeight="min(70vh, 44rem)"
        pageSizeOptions={[25, 50, 100, 250]}
        sort={{ key: "date", dir: state.query.dir, onChange: (_k, dir) => state.setSort("date", dir) }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari produk atau SKU", "Search product or SKU")}
            facets={[
              { key: "category", label: pick("Kategori", "Category"), primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              {
                key: "quality",
                label: pick("Kualitas", "Quality"),
                primary: true,
                options: [
                  { value: "blocking", label: pick("Hilang", "Missing") },
                  { value: "warning", label: pick("Peringatan", "Warning") },
                  { value: "ok", label: pick("Lolos", "Passed") },
                ],
              },
            ]}
          >
            <DateRangeFilter
              from={from}
              to={to}
              min={q.data?.window.earliest}
              max={isoDate(addDays(today, -1))}
              onChange={(f, t) => state.setParams({ from: f, to: t }, { resetPage: true })}
            />
            <Select
              size="sm"
              className="w-auto min-w-44"
              aria-label={pick("Lokasi", "Location")}
              prefix={pick("Lokasi:", "Location:")}
              value={locationId || "all"}
              onValueChange={(v) => state.setParams({ location: v === "all" ? null : v }, { resetPage: true })}
              options={[{ value: "all", label: pick("Semua lokasi", "All locations") }, ...facets.locations.map((l) => ({ value: l.id, label: l.name, description: l.region }))]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon={History}
            title={pick("Tidak ada catatan permintaan yang cocok dengan filter.", "No demand records match the current filters.")}
            description={pick("Rentang tanggal mungkin di luar riwayat yang dimuat, atau tidak ada produk yang cocok dengan pencarian.", "The date range may be outside the loaded history, or no product matches the search.")}
            action={
              <Button variant="secondary" onClick={state.clearFilters}>
                {pick("Hapus filter", "Clear filters")}
              </Button>
            }
          />
        }
      />
    </PageContainer>
  );
}
