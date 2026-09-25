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
      { id: "date", header: "Tanggal", meta: { width: "120px", sortKey: "date" } satisfies ColumnMeta, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatDate(row.original.date)}</span> },
      { id: "product", header: "Produk", meta: { width: "minmax(260px, 2.5fr)", pinned: true, label: "Produk" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      {
        id: "units",
        header: "Permintaan",
        meta: { width: "110px", numeric: true, description: "Unit terjual (POS) atau dipesan (ERP) pada hari itu." } satisfies ColumnMeta,
        cell: ({ row }) => <span className="font-semibold">{formatNumber(row.original.units)}</span>,
      },
      { id: "unit", header: "Satuan", meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.product?.unit}</span> },
      { id: "location", header: "Lokasi", meta: { width: "minmax(140px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: () => <span className="truncate text-fg-secondary">{q.data?.location?.name ?? "Semua lokasi"}</span> },
      { id: "source", header: "Sumber", meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{SOURCE_LABELS[row.original.sourceId] ?? row.original.sourceId}</Tag> },
      {
        id: "quality",
        header: "Kualitas",
        meta: { width: "120px", description: "Hasil pemeriksaan kualitas data untuk catatan ini." } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.quality === "ok" ? (
            <span className="text-xs text-fg-tertiary">Lolos</span>
          ) : (
            <Tooltip content={row.original.quality === "blocking" ? "Data hilang: tidak ada data POS untuk hari ini (DQ-001)." : "Terkena peringatan kualitas data yang masih terbuka."}>
              <span tabIndex={0}>
                <Tag tone={row.original.quality === "blocking" ? "critical" : "warning"}>{row.original.quality === "blocking" ? "Hilang" : "Peringatan"}</Tag>
              </span>
            </Tooltip>
          ),
      },
      { id: "updated", header: "Diperbarui", meta: { width: "150px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateTime(row.original.updatedAt)}</span> },
    ],
    [q.data?.location],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Permintaan Historis"
        description="Permintaan harian per produk, seperti yang dipakai model perkiraan. Catatan diambil per halaman dari penyimpanan permintaan."
        meta={
          <>
            {q.data && <span className="text-xs font-medium text-fg-secondary">History available from {formatDate(q.data.window.earliest)}</span>}
            <FreshnessIndicator timestamp={q.data?.page.asOf} label="Data POS diperbarui" source="Transaksi POS" />
          </>
        }
      />
      {state.query.filters?.quality?.length ? (
        <InlineAlert tone="info" title="Filter kualitas memeriksa maksimal 5.000 catatan.">
          Narrow the date range or category for complete results.
        </InlineAlert>
      ) : null}
      <DataTable
        label="Catatan permintaan historis"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Permintaan historis tidak dapat dimuat."
        storageKey="historical"
        maxHeight="min(70vh, 44rem)"
        pageSizeOptions={[25, 50, 100, 250]}
        density="compact"
        hideDensityToggle
        sort={{ key: "date", dir: state.query.dir, onChange: (_k, dir) => state.setSort("date", dir) }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Cari produk atau SKU"
            facets={[
              { key: "category", label: "Kategori", primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              {
                key: "quality",
                label: "Kualitas",
                primary: true,
                options: [
                  { value: "blocking", label: "Hilang" },
                  { value: "warning", label: "Peringatan" },
                  { value: "ok", label: "Lolos" },
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
              aria-label="Lokasi"
              prefix="Lokasi:"
              value={locationId || "all"}
              onValueChange={(v) => state.setParams({ location: v === "all" ? null : v }, { resetPage: true })}
              options={[{ value: "all", label: "Semua lokasi" }, ...facets.locations.map((l) => ({ value: l.id, label: l.name, description: l.region }))]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon={History}
            title="Tidak ada catatan permintaan yang cocok dengan filter."
            description="Rentang tanggal mungkin di luar riwayat yang dimuat, atau tidak ada produk yang cocok dengan pencarian."
            action={
              <Button variant="secondary" onClick={state.clearFilters}>
                Clear filters
              </Button>
            }
          />
        }
      />
    </PageContainer>
  );
}
