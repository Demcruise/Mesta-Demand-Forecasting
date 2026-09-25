"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Cpu, GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ForecastModel, StatusKey } from "@/types/domain";
import { listModels } from "@/lib/api/models";
import { useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { formatDate, formatDateRange, formatPercent } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { StatusBadge, STATUS } from "@/components/feedback/status";
import { EmptyState, InlineAlert } from "@/components/feedback/states";
import { ModelIdentity, UserIdentity } from "@/components/entities/identity";
import { METRIC_DEFINITIONS } from "./metric-definitions";
import { pick } from "@/lib/i18n";

/** PAGE-MODEL-REGISTRY: forecasting model versions and their lifecycle. */
export function RegistryView() {
  const router = useRouter();
  const state = useListState({ filterKeys: ["status"], defaultSort: "status", defaultDir: "asc" });
  const q = useApiQuery(["models", state.query], (c) => listModels(c, state.query), { keepPrevious: true });

  const columns = React.useMemo<ColumnDef<ForecastModel, unknown>[]>(
    () => [
      {
        id: "model",
        header: pick("Model", "Model"),
        meta: { width: "minmax(260px, 2fr)", sortKey: "name", pinned: true, label: pick("Model", "Model") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <ModelIdentity model={row.original} />
            <span className="truncate text-xs text-fg-tertiary">{row.original.family}</span>
          </span>
        ),
      },
      { id: "status", header: "Status", meta: { width: "130px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "trained", header: pick("Terakhir dilatih", "Last trained"), meta: { width: "120px", sortKey: "lastTrainedAt" } satisfies ColumnMeta, cell: ({ row }) => <span className="tabular text-fg-secondary">{formatDate(row.original.lastTrainedAt)}</span> },
      { id: "period", header: pick("Periode pelatihan", "Training period"), meta: { width: "200px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateRange(row.original.trainingStart, row.original.trainingEnd)}</span> },
      { id: "horizon", header: pick("Rentang maksimum", "Max horizon"), meta: { width: "110px", numeric: true, hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => pick(`${row.original.horizonDays} h · ${row.original.frequency === "daily" ? "harian" : "mingguan"}`, `${row.original.horizonDays} d · ${row.original.frequency}`) },
      { id: "wape", header: "WAPE", meta: { width: "90px", numeric: true, sortKey: "wape", description: METRIC_DEFINITIONS.wape.definition } satisfies ColumnMeta, cell: ({ row }) => <span className="font-semibold">{formatPercent(row.original.metrics.wape)}</span> },
      { id: "bias", header: "Bias", meta: { width: "90px", numeric: true, sortKey: "bias", description: METRIC_DEFINITIONS.bias.definition } satisfies ColumnMeta, cell: ({ row }) => <SignedPercent percent={row.original.metrics.bias} /> },
      { id: "coverage", header: pick("Cakupan", "Coverage"), meta: { width: "100px", numeric: true, hideBelow: "lg", description: METRIC_DEFINITIONS.coverage.definition } satisfies ColumnMeta, cell: ({ row }) => formatPercent(row.original.metrics.coverage80, 0) },
      { id: "owner", header: pick("Penanggung jawab", "Owner"), meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.owner} /> },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title={pick("Daftar Model", pick("Daftar model", "Model registry"))}
        description={pick("Lihat model yang tersedia dan kinerjanya pada evaluasi terakhir.", pick("Versi model perkiraan, statusnya, dan performanya pada evaluasi terakhir.", "Forecasting model versions, their status and how they performed in the latest evaluation."))}
        actions={
          <Link href="/models/performance" className={buttonVariants({ variant: "secondary" })}>
            <GitCompareArrows aria-hidden /> Compare performance
          </Link>
        }
      />
      <InlineAlert tone="info" title={pick("Angka diambil dari periode evaluasi terakhir tiap model.", pick("Metrik berasal dari periode evaluasi terakhir tiap model.", "Metrics are from each model's latest evaluation window."))}>
        Compare models over the same window in Model performance or Backtesting before changing the default. The model lifecycle requires validation with analytics owners.
      </InlineAlert>
      <DataTable
        label={pick("Model perkiraan", "Forecasting models")}
        columns={columns}
        data={q.data?.items}
        getRowId={(m) => m.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Model tidak dapat dimuat.", "Models could not be loaded.")}
        onRowClick={(m) => router.push(`/models/${m.id}`)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        hideDensityToggle
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari model", "Search models")}
            facets={[{ key: "status", label: "Status", primary: true, options: (["production", "candidate", "training", "archived"] as StatusKey[]).map((s) => ({ value: s, label: STATUS[s].label })) }]}
          />
        }
        empty={<EmptyState icon={Cpu} title={pick("Tidak ada model yang cocok dengan filter.", "No models match the current filters.")} />}
      />
    </PageContainer>
  );
}
