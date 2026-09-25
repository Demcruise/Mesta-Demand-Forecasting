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

/** PAGE-MODEL-REGISTRY: forecasting model versions and their lifecycle. */
export function RegistryView() {
  const router = useRouter();
  const state = useListState({ filterKeys: ["status"], defaultSort: "status", defaultDir: "asc" });
  const q = useApiQuery(["models", state.query], (c) => listModels(c, state.query), { keepPrevious: true });

  const columns = React.useMemo<ColumnDef<ForecastModel, unknown>[]>(
    () => [
      {
        id: "model",
        header: "Model",
        meta: { width: "minmax(260px, 2fr)", sortKey: "name", pinned: true, label: "Model" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <ModelIdentity model={row.original} />
            <span className="truncate text-xs text-fg-tertiary">{row.original.family}</span>
          </span>
        ),
      },
      { id: "status", header: "Status", meta: { width: "130px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "trained", header: "Terakhir dilatih", meta: { width: "120px", sortKey: "lastTrainedAt" } satisfies ColumnMeta, cell: ({ row }) => <span className="tabular text-fg-secondary">{formatDate(row.original.lastTrainedAt)}</span> },
      { id: "period", header: "Periode pelatihan", meta: { width: "200px", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-xs tabular text-fg-secondary">{formatDateRange(row.original.trainingStart, row.original.trainingEnd)}</span> },
      { id: "horizon", header: "Rentang maksimum", meta: { width: "110px", numeric: true, hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => `${row.original.horizonDays} h · ${row.original.frequency === "daily" ? "harian" : "mingguan"}` },
      { id: "wape", header: "WAPE", meta: { width: "90px", numeric: true, sortKey: "wape", description: METRIC_DEFINITIONS.wape.definition } satisfies ColumnMeta, cell: ({ row }) => <span className="font-semibold">{formatPercent(row.original.metrics.wape)}</span> },
      { id: "bias", header: "Bias", meta: { width: "90px", numeric: true, sortKey: "bias", description: METRIC_DEFINITIONS.bias.definition } satisfies ColumnMeta, cell: ({ row }) => <SignedPercent percent={row.original.metrics.bias} /> },
      { id: "coverage", header: "Cakupan", meta: { width: "100px", numeric: true, hideBelow: "lg", description: METRIC_DEFINITIONS.coverage.definition } satisfies ColumnMeta, cell: ({ row }) => formatPercent(row.original.metrics.coverage80, 0) },
      { id: "owner", header: "Penanggung jawab", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.owner} /> },
    ],
    [],
  );

  return (
    <PageContainer>
      <PageHeader
        title="Daftar Model"
        description="Lihat model yang tersedia dan kinerjanya pada evaluasi terakhir."
        actions={
          <Link href="/models/performance" className={buttonVariants({ variant: "secondary" })}>
            <GitCompareArrows aria-hidden /> Compare performance
          </Link>
        }
      />
      <InlineAlert tone="info" title="Angka diambil dari periode evaluasi terakhir tiap model.">
        Compare models over the same window in Model performance or Backtesting before changing the default. The model lifecycle requires validation with analytics owners.
      </InlineAlert>
      <DataTable
        label="Model perkiraan"
        columns={columns}
        data={q.data?.items}
        getRowId={(m) => m.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Model tidak dapat dimuat."
        onRowClick={(m) => router.push(`/models/${m.id}`)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        hideDensityToggle
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Cari model"
            facets={[{ key: "status", label: "Status", primary: true, options: (["production", "candidate", "training", "archived"] as StatusKey[]).map((s) => ({ value: s, label: STATUS[s].label })) }]}
          />
        }
        empty={<EmptyState icon={Cpu} title="Tidak ada model yang cocok dengan filter." />}
      />
    </PageContainer>
  );
}
