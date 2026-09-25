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
import { pick, localized } from "@/lib/i18n";

const LIFECYCLE: Record<Product["lifecycle"], { label: string; tone: "info" | "neutral" | "warning" | "primary" }> = {
  new: { label: pick("Baru", "New"), tone: "info" },
  core: { label: pick("Inti", "Core"), tone: "neutral" },
  seasonal: { label: pick("Musiman", "Seasonal"), tone: "primary" },
  "end-of-life": { label: pick("Akhir masa", "End of life"), tone: "warning" },
};

/** Product master used for forecasting (from the enterprise data warehouse). */
export function ProductsView() {
  const router = useRouter();
  const { ctx } = useSession();
  const state = useListState({ filterKeys: ["category", "lifecycle", "brand"], defaultSort: "name", defaultDir: "asc" });
  const q = useApiQuery(["products", state.query], (c) => listProducts(c, state.query), { keepPrevious: true });
  const facets = React.useMemo(() => catalogueFacets(ctx), [ctx]);

  const columns = localized(React.useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      { id: "product", header: pick("Produk", "Product"), meta: { width: "minmax(280px, 2.5fr)", sortKey: "name", pinned: true, label: pick("Produk", "Product") } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original} /> },
      { id: "subcategory", header: pick("Subkategori", "Subcategory"), meta: { width: "minmax(140px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{row.original.subcategory}</span> },
      { id: "brand", header: "Brand", meta: { width: "130px", sortKey: "brand", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate">{row.original.brand}</span> },
      { id: "unit", header: "Unit", meta: { width: "100px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{row.original.unit}</span> },
      {
        id: "lifecycle",
        header: pick("Siklus produk", "Lifecycle"),
        meta: { width: "120px", sortKey: "lifecycle", description: pick("Dari master produk. Produk baru memiliki riwayat lebih pendek dan rentang lebih lebar.", "From the product master. New listings have less history and wider intervals.") } satisfies ColumnMeta,
        cell: ({ row }) => <Tag tone={LIFECYCLE[row.original.lifecycle].tone}>{LIFECYCLE[row.original.lifecycle].label}</Tag>,
      },
      { id: "launched", header: "Diluncurkan", meta: { width: "120px", sortKey: "launchedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <DateCell value={row.original.launchedAt} /> },
      {
        id: "actions",
        header: () => <span className="sr-only">{"Aksi"}</span>,
        meta: { width: "120px", pinned: true, label: "Aksi" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <Link href={`/forecasting/detail/${row.original.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-primary hover:underline">
            View forecast
          </Link>
        ),
      },
    ],
    [],
  ), React.useMemo<ColumnDef<Product, unknown>[]>(
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
        header: () => <span className="sr-only">{"Actions"}</span>,
        meta: { width: "120px", pinned: true, label: "Actions" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <Link href={`/forecasting/detail/${row.original.id}`} onClick={(e) => e.stopPropagation()} className="text-xs font-semibold text-primary hover:underline">
            View forecast
          </Link>
        ),
      },
    ],
    [],
  ));

  return (
    <PageContainer>
      <PageHeader
        title={pick("Produk", "Products")}
        description={pick("Master produk yang dipakai untuk perkiraan: hierarki, satuan, dan siklus produk. Hanya baca di sini; dikelola di gudang data.", "The product master used for forecasting: hierarchy, units and lifecycle. Read-only here; maintained in the data warehouse.")}
        meta={
          <>
            <span className="text-xs font-medium text-fg-secondary">{q.data ? pick(`${formatNumber(q.data.total)} produk`, pick(`${formatNumber(q.data.total)} produk`, pick(`${formatNumber(q.data.total)} produk`, `${formatNumber(q.data.total)} products`))) : pick("Memuat…", "Loading…")}</span>
            <FreshnessIndicator timestamp={q.data?.asOf} label={pick("Master produk tersinkron", "Product master synced")} source={pick("Gudang data perusahaan", "Enterprise data warehouse")} />
          </>
        }
      />
      <DataTable
        label={pick("Produk", "Products")}
        columns={columns}
        data={q.data?.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Produk tidak dapat dimuat.", "Products could not be loaded.")}
        storageKey="products"
        onRowClick={(r) => router.push(`/forecasting/detail/${r.id}`)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari nama, SKU, merek", "Search name, SKU, brand")}
            facets={[
              { key: "category", label: pick("Kategori", "Category"), primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              { key: "lifecycle", label: pick("Siklus produk", "Lifecycle"), primary: true, options: Object.entries(LIFECYCLE).map(([value, v]) => ({ value, label: v.label })) },
              { key: "brand", label: "Brand", options: facets.brands.map((b) => ({ value: b, label: b })) },
            ]}
          />
        }
        empty={
          <EmptyState
            icon={Boxes}
            title={pick("Tidak ada produk yang cocok dengan filter.", "No products match the current filters.")}
            description={pick("Periksa ejaan SKU atau hapus filter.", "Check the spelling of the SKU or clear filters.")}
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
