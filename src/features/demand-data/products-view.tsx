"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Boxes } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Product } from "@/types/domain";
import { catalogueFacets, listProducts } from "@/lib/api/data";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { EmptyState } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { Tag } from "@/components/feedback/status";
import { DateCell, ProductIdentity } from "@/components/entities/identity";

const LIFECYCLE: Record<Product["lifecycle"], { label: string; tone: "info" | "neutral" | "warning" | "primary" }> = {
  new: { label: "New", tone: "info" },
  core: { label: "Core", tone: "neutral" },
  seasonal: { label: "Seasonal", tone: "primary" },
  "end-of-life": { label: "End of life", tone: "warning" },
};

/** Product master used for forecasting (from the enterprise data warehouse). */
export function ProductsView() {
  const router = useRouter();
  const { ctx } = useSession();
  const state = useListState({ filterKeys: ["category", "lifecycle", "brand"], defaultSort: "name", defaultDir: "asc" });
  const q = useApiQuery(["products", state.query], (c) => listProducts(c, state.query), { keepPrevious: true });
  const facets = React.useMemo(() => catalogueFacets(ctx), [ctx]);

  const columns = React.useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      { id: "product", header: "Product", meta: { width: "minmax(280px, 2.5fr)", sortKey: "name", pinned: true, label: "Product" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original} /> },
      { id: "subcategory", header: "Subcategory", meta: { width: "minmax(140px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{row.original.subcategory}</span> },
      { id: "brand", header: "Brand", meta: { width: "130px", sortKey: "brand", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate">{row.original.brand}</span> },
      { id: "unit", header: "Unit", meta: { width: "100px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.unit}</span> },
      {
        id: "lifecycle",
        header: "Lifecycle",
        meta: { width: "120px", sortKey: "lifecycle", description: "From the product master. New listings have less history and wider intervals." } satisfies ColumnMeta,
        cell: ({ row }) => <Tag tone={LIFECYCLE[row.original.lifecycle].tone}>{LIFECYCLE[row.original.lifecycle].label}</Tag>,
      },
      { id: "launched", header: "Launched", meta: { width: "120px", sortKey: "launchedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <DateCell value={row.original.launchedAt} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { width: "120px", pinned: true, label: "Actions" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <Link href={`/forecasting/detail/${row.original.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-primary hover:underline">
            View forecast
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Products"
        description="The product master used for forecasting: hierarchy, units and lifecycle. Read-only here; maintained in the data warehouse."
        meta={
          <>
            <span className="text-xs font-medium text-fg-secondary">{q.data ? `${formatNumber(q.data.total)} products` : "Loading…"}</span>
            <FreshnessIndicator timestamp={q.data?.asOf} label="Product master synced" source="Enterprise data warehouse" />
          </>
        }
      />
      <DataTable
        label="Products"
        columns={columns}
        data={q.data?.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Products could not be loaded."
        storageKey="products"
        onRowClick={(r) => router.push(`/forecasting/detail/${r.id}`)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Search name, SKU, brand"
            facets={[
              { key: "category", label: "Category", primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              { key: "lifecycle", label: "Lifecycle", primary: true, options: Object.entries(LIFECYCLE).map(([value, v]) => ({ value, label: v.label })) },
              { key: "brand", label: "Brand", options: facets.brands.map((b) => ({ value: b, label: b })) },
            ]}
          />
        }
        empty={
          <EmptyState
            icon={Boxes}
            title="No products match the current filters."
            description="Check the spelling of the SKU or clear filters."
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
