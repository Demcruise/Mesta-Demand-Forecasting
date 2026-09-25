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
      { id: "date", header: "Date", meta: { width: "120px", sortKey: "date" } satisfies ColumnMeta, cell: ({ row }) => <span className="tabular whitespace-nowrap">{formatDate(row.original.date)}</span> },
      { id: "product", header: "Product", meta: { width: "minmax(260px, 2.5fr)", pinned: true, label: "Product" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} href={`/forecasting/detail/${row.original.productId}`} /> },
      {
        id: "units",
        header: "Demand",
        meta: { width: "110px", numeric: true, description: "Units sold (POS) or ordered (ERP) on the day." } satisfies ColumnMeta,
        cell: ({ row }) => <span className="font-semibold">{formatNumber(row.original.units)}</span>,
      },
      { id: "unit", header: "Unit", meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.product?.unit}</span> },
      { id: "location", header: "Location", meta: { width: "minmax(140px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: () => <span className="truncate text-fg-secondary">{q.data?.location?.name ?? "All locations"}</span> },
      { id: "source", header: "Source", meta: { width: "90px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <Tag>{SOURCE_LABELS[row.original.sourceId] ?? row.original.sourceId}</Tag> },
      {
        id: "quality",
        header: "Quality",
        meta: { width: "120px", description: "Result of data quality checks for this record." } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.quality === "ok" ? (
            <span className="text-xs text-fg-tertiary">Passed</span>
          ) : (
            <Tooltip content={row.original.quality === "blocking" ? "Missing record: no POS data received for this day (DQ-001)." : "Affected by an open data quality warning."}>
              <span tabIndex={0}>
                <Tag tone={row.original.quality === "blocking" ? "critical" : "warning"}>{row.original.quality === "blocking" ? "Missing" : "Warning"}</Tag>
              </span>
            </Tooltip>
          ),
      },
      { id: "updated", header: "Updated", meta: { width: "150px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateTime(row.original.updatedAt)}</span> },
    ],
    [q.data?.location],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Historical demand"
        description="Daily demand by product, as used by the forecasting models. Records are queried page by page from the demand store."
        meta={
          <>
            {q.data && <span className="text-xs font-medium text-fg-secondary">History available from {formatDate(q.data.window.earliest)}</span>}
            <FreshnessIndicator timestamp={q.data?.page.asOf} label="POS data updated" source="POS transactions" />
          </>
        }
      />
      {state.query.filters?.quality?.length ? (
        <InlineAlert tone="info" title="Quality filter scans at most 5,000 records.">
          Narrow the date range or category for complete results.
        </InlineAlert>
      ) : null}
      <DataTable
        label="Historical demand records"
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Historical demand could not be loaded."
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
            searchPlaceholder="Search product or SKU"
            facets={[
              { key: "category", label: "Category", primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              {
                key: "quality",
                label: "Quality",
                primary: true,
                options: [
                  { value: "blocking", label: "Missing" },
                  { value: "warning", label: "Warning" },
                  { value: "ok", label: "Passed" },
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
              aria-label="Location"
              prefix="Location:"
              value={locationId || "all"}
              onValueChange={(v) => state.setParams({ location: v === "all" ? null : v }, { resetPage: true })}
              options={[{ value: "all", label: "All locations" }, ...facets.locations.map((l) => ({ value: l.id, label: l.name, description: l.region }))]}
            />
          </FilterBar>
        }
        empty={
          <EmptyState
            icon={History}
            title="No demand records match the current filters."
            description="The date range may be outside the loaded history, or no product matches the search."
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
