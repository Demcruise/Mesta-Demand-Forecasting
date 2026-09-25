"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Plus, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ForecastRun } from "@/types/domain";
import { listRuns } from "@/lib/api/forecasting";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { formatDuration, formatNumber } from "@/lib/format";
import { runProgress } from "@/lib/mock/runs";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { SavedViewsMenu } from "@/components/tables/saved-views";
import { StatusBadge, STATUS } from "@/components/feedback/status";
import type { StatusKey } from "@/types/domain";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState } from "@/components/feedback/states";
import { DateCell, RunIdentity, scopeLabel, UserIdentity } from "@/components/entities/identity";
import { RunActionMenu, useRunActions } from "./run-actions";
import { pick } from "@/lib/i18n";

const FILTER_KEYS = ["status", "category", "model"] as const;

/** PAGE-FORECAST-RUNS: operational visibility into forecast generation jobs. */
export function RunsView() {
  const router = useRouter();
  const { can } = useSession();
  const state = useListState({ filterKeys: FILTER_KEYS, defaultSort: "createdAt", defaultDir: "desc" });
  const q = useApiQuery(["runs", state.query], (ctx) => listRuns(ctx, state.query), {
    keepPrevious: true,
    // Poll while any job is active so status reflects backend state.
    refetchInterval: (query) => (query.state.data?.items.some((r) => r.status === "queued" || r.status === "running") ? 3000 : false),
  });
  const baseline = q.data?.items.find((r) => r.status === "published");
  const actions = useRunActions(baseline?.id);

  const columns = React.useMemo<ColumnDef<ForecastRun, unknown>[]>(
    () => [
      {
        id: "run",
        header: pick("Proses", "Run"),
        meta: { width: "minmax(260px, 2.2fr)", sortKey: "name", pinned: true, label: pick("Proses", "Run") } satisfies ColumnMeta,
        cell: ({ row }) => <RunIdentity run={row.original} />,
      },
      {
        id: "status",
        header: "Status",
        meta: { width: "150px", sortKey: "status" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const r = row.original;
          const p = runProgress(r);
          return (
            <span className="flex flex-col gap-0.5">
              <StatusBadge status={r.status} size="sm" />
              {(r.status === "running" || r.status === "queued") && (
                <span className="text-[0.6875rem] text-fg-tertiary">
                  Langkah {Math.min(p.done + 1, p.total)} dari {p.total}
                  {p.current ? ` · ${p.current.label}` : ""}
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: "scope",
        header: pick("Cakupan", "Scope"),
        meta: { width: "minmax(180px, 1.3fr)", hideBelow: "lg" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem]">{scopeLabel(row.original)}</span>
            <span className="text-xs tabular text-fg-tertiary">{formatNumber(row.original.scope.skuCount)} SKU</span>
          </span>
        ),
      },
      {
        id: "model",
        header: pick("Model", "Model"),
        meta: { width: "110px", hideBelow: "xl" } satisfies ColumnMeta,
        cell: ({ row }) => <span className="mono-id">v{row.original.modelVersion}</span>,
      },
      {
        id: "horizon",
        header: pick("Periode", "Horizon"),
        meta: { width: "90px", numeric: true, sortKey: "horizon" } satisfies ColumnMeta,
        cell: ({ row }) => pick(`${row.original.horizonDays} h`, `${row.original.horizonDays} d`),
      },
      {
        id: "created",
        header: pick("Dibuat", "Created"),
        meta: { width: "120px", sortKey: "createdAt" } satisfies ColumnMeta,
        cell: ({ row }) => <DateCell value={row.original.createdAt} relative />,
      },
      {
        id: "duration",
        header: pick("Durasi", "Duration"),
        meta: { width: "100px", numeric: true, hideBelow: "xl", description: pick("Waktu dari mulai sampai selesai.", "Time from start to completion.") } satisfies ColumnMeta,
        cell: ({ row }) => {
          const r = row.original;
          if (!r.startedAt) return <span className="text-fg-tertiary">—</span>;
          if (!r.completedAt) return <span className="text-fg-tertiary">{pick("Sedang berjalan", "In progress")}</span>;
          return formatDuration(new Date(r.completedAt).getTime() - new Date(r.startedAt).getTime());
        },
      },
      {
        id: "freshness",
        header: pick("Terakhir Diperbarui", pick("Kebaruan data", "Data freshness")),
        meta: { width: "170px", hideBelow: "lg", description: pick("Kapan data permintaan terakhir diperbarui.", pick("Kapan data permintaan masukan terakhir diperbarui.", "When the input demand data was last refreshed.")) } satisfies ColumnMeta,
        cell: ({ row }) => <FreshnessIndicator timestamp={row.original.dataAsOf} label={pick("Data", "Data")} />,
      },
      {
        id: "createdBy",
        header: pick("Dibuat oleh", "Created by"),
        meta: { width: "minmax(150px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta,
        cell: ({ row }) => <UserIdentity userId={row.original.createdBy} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{pick("Aksi", "Actions")}</span>,
        meta: { width: "52px", pinned: true, label: pick("Aksi", "Actions") } satisfies ColumnMeta,
        cell: ({ row }) => <RunActionMenu run={row.original} actions={actions} baselineId={baseline?.id} />,
      },
    ],
    [actions, baseline?.id],
  );

  return (
    <PageContainer>
      <PageHeader
        title={pick("Proses Perkiraan", "Forecast runs")}
        description={pick("Lihat proses yang sedang berjalan dan hasil perkiraan sebelumnya.", "Every forecast generation job in this workspace: what it covered, which model produced it and whether it can be used.")}
        actions={
          can("forecast.run.create") ? (
            <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Buat Perkiraan
            </Link>
          ) : undefined
        }
      />
      <DataTable
        label={pick("Proses Perkiraan", "Forecast runs")}
        columns={columns}
        data={q.data?.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Proses perkiraan tidak dapat dimuat.", "Forecast runs could not be loaded.")}
        storageKey="runs"
        onRowClick={(r) => router.push(`/forecasting/runs/${r.id}`)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarEnd={<SavedViewsMenu surface="runs" />}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari ID, nama, atau pembuat proses", "Search run ID, name or creator")}
            facets={[
              {
                key: "status",
                label: "Status",
                primary: true,
                options: (["queued", "running", "completed", "published", "failed", "cancelled", "draft", "archived"] as StatusKey[]).map((s) => ({ value: s, label: STATUS[s].label })),
              },
              { key: "category", label: pick("Kategori", "Category"), primary: true, options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              {
                key: "model",
                label: pick("Model", "Model"),
                options: [
                  { value: "mdl_gbm_24", label: "Gradient-boosted 2.4" },
                  { value: "mdl_gbm_25", label: "Gradient-boosted 2.5" },
                  { value: "mdl_ets_18", label: "Exponential smoothing 1.8" },
                  { value: "mdl_tsb_12", label: "Intermittent demand 1.2" },
                ],
              },
            ]}
          />
        }
        empty={
          state.activeFilterCount > 0 ? (
            <EmptyState title={pick("Tidak ada proses perkiraan yang cocok dengan filter.", "No forecast runs match the current filters.")} description={pick("Hapus filter untuk melihat semua proses di ruang kerja ini.", "Clear filters to see all runs in this workspace.")} action={<button className={buttonVariants({ variant: "secondary" })} onClick={state.clearFilters}>{pick("Hapus filter", "Clear filters")}</button>} />
          ) : (
            <EmptyState
              icon={Workflow}
              title={pick("Belum ada proses perkiraan di ruang kerja ini.", "No forecast runs have been created for this workspace.")}
              description={pick("Buat proses perkiraan untuk mulai melihat hasil.", "Create a forecast run to generate a new demand outlook.")}
              action={
                can("forecast.run.create") ? (
                  <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
                    Buat Perkiraan
                  </Link>
                ) : undefined
              }
            />
          )
        }
        footerNote={q.data && q.data.items.some((r) => r.status === "running" || r.status === "queued") ? pick("Menyegarkan setiap 3 detik selama ada proses berjalan.", "Refreshing every 3 seconds while runs are active.") : undefined}
      />
      {actions.dialog}
    </PageContainer>
  );
}
