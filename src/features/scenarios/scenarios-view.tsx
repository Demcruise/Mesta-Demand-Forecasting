"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Archive, Copy, Eye, GitCompareArrows, MoreHorizontal, Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { Scenario, StatusKey } from "@/types/domain";
import { archiveScenario, duplicateScenario, listScenarios } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { formatDeltaNumber } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { StatusBadge, STATUS } from "@/components/feedback/status";
import { EmptyState } from "@/components/feedback/states";
import { DateCell, ScenarioIdentity, UserIdentity } from "@/components/entities/identity";
import { ForecastDelta } from "@/components/forecasting/metrics";
import { pick } from "@/lib/i18n";

/** PAGE-SCENARIOS: compare planning outcomes under alternate assumptions. */
export function ScenariosView() {
  const router = useRouter();
  const { can } = useSession();
  const state = useListState({ filterKeys: ["status"], defaultSort: "modifiedAt", defaultDir: "desc" });
  const q = useApiQuery(["scenarios", state.query], (c) => listScenarios(c, state.query), { keepPrevious: true });
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  const duplicate = useApiMutation((c, id: string) => duplicateScenario(c, id), {
    invalidate: [["scenarios"]],
    success: (s) => `Created “${s.name}”`,
    failure: pick("Skenario tidak dapat diduplikat.", "The scenario was not duplicated."),
    onSuccess: (s) => router.push(`/scenarios/${s.id}?edit=1`),
  });
  const archive = useApiMutation((c, id: string) => archiveScenario(c, id), { invalidate: [["scenarios"]], success: (s) => pick(`Mengarsipkan “${s.name}”`, `Archived “${s.name}”`), failure: pick("Skenario tidak dapat diarsipkan.", "The scenario was not archived.") });

  const columns = React.useMemo<ColumnDef<Scenario, unknown>[]>(
    () => [
      { id: "scenario", header: pick("Skenario", "Scenario"), meta: { width: "minmax(260px, 2.5fr)", sortKey: "name", pinned: true, label: pick("Skenario", "Scenario") } satisfies ColumnMeta, cell: ({ row }) => <ScenarioIdentity scenario={row.original} /> },
      { id: "baseline", header: pick("Acuan", "Baseline"), meta: { width: "160px", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="mono-id text-fg-secondary">{row.original.baselineRunId}</span> },
      { id: "assumptions", header: pick("Asumsi", "Assumptions"), meta: { width: "120px", numeric: true, hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => row.original.assumptions.length },
      { id: "owner", header: pick("Penanggung jawab", "Owner"), meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      { id: "status", header: "Status", meta: { width: "130px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
      { id: "modified", header: pick("Diubah", "Modified"), meta: { width: "120px", sortKey: "modifiedAt", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <DateCell value={row.original.modifiedAt} relative /> },
      {
        id: "impact",
        header: pick("Dampak", "Impact"),
        meta: { width: "150px", numeric: true, sortKey: "impact", description: pick("Perubahan total permintaan dibanding acuan selama periode perkiraan.", "Change in total demand versus the baseline over the horizon.") } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.result ? (
            <span className="flex flex-col items-end">
              <ForecastDelta percent={row.original.result.deltaPercent} size="sm" threshold={1} />
              <span className="text-[0.6875rem] tabular text-fg-tertiary">{formatDeltaNumber(row.original.result.deltaUnits)} units</span>
            </span>
          ) : (
            <span className="text-xs text-fg-tertiary">{pick("Belum disimulasikan", "Not simulated")}</span>
          ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{pick("Aksi", "Actions")}</span>,
        meta: { width: "52px", pinned: true, label: pick("Aksi", "Actions") } satisfies ColumnMeta,
        cell: ({ row }) => {
          const s = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${s.name}`} onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/scenarios/${s.id}`)}>
                  Open
                </DropdownMenuItem>
                {s.result && (
                  <DropdownMenuItem icon={<GitCompareArrows />} onSelect={() => router.push(`/scenarios/compare?ids=${s.id}`)}>
                    Compare with baseline
                  </DropdownMenuItem>
                )}
                {can("scenario.create") && (
                  <DropdownMenuItem icon={<Copy />} onSelect={() => duplicate.mutate(s.id)}>
                    Duplicate
                  </DropdownMenuItem>
                )}
                {can("scenario.create") && s.status !== "archived" && s.status !== "in_review" && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem icon={<Archive />} onSelect={() => archive.mutate(s.id)}>
                      Archive
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [can, duplicate, archive, router],
  );

  return (
    <PageContainer>
      <PageHeader
        title={pick("Skenario", "Scenarios")}
        description={pick("Buat dan bandingkan beberapa kemungkinan permintaan berdasarkan acuan yang sudah diterbitkan.", "Alternate assumptions applied to a published baseline, simulated and compared before they are adopted into a plan.")}
        actions={
          <>
            <Link href="/scenarios/compare" className={buttonVariants({ variant: "secondary" })}>
              <GitCompareArrows aria-hidden /> Bandingkan Skenario
            </Link>
            {can("scenario.create") && (
              <Link href="/scenarios/new" className={buttonVariants({ variant: "primary" })}>
                <Plus aria-hidden /> Buat Skenario
              </Link>
            )}
          </>
        }
      />
      <DataTable
        label={pick("Skenario", "Scenarios")}
        columns={columns}
        data={q.data?.items}
        getRowId={(s) => s.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Skenario tidak dapat dimuat.", "Scenarios could not be loaded.")}
        onRowClick={(s) => router.push(`/scenarios/${s.id}`)}
        selection={{ selected: selection, onChange: setSelection, isSelectable: (s) => !!s.result }}
        bulkBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="body-sm font-semibold">{selectedIds.length} dipilih</span>
            <div className="flex gap-2">
              <Link href={`/scenarios/compare?ids=${selectedIds.join(",")}`} className={buttonVariants({ size: "sm", variant: "primary" })}>
                <GitCompareArrows aria-hidden /> Bandingkan yang dipilih
              </Link>
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
                Hapus pilihan
              </Button>
            </div>
          </div>
        }
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.total ?? 0, onPageChange: state.setPage }}
        hideDensityToggle
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder={pick("Cari skenario", "Search scenarios")}
            facets={[{ key: "status", label: "Status", primary: true, options: (["draft", "simulated", "in_review", "approved", "rejected", "archived"] as StatusKey[]).map((s) => ({ value: s, label: STATUS[s].label })) }]}
          />
        }
        empty={
          <EmptyState
            icon={SlidersHorizontal}
            title={state.activeFilterCount ? pick("Tidak ada skenario yang cocok dengan filter.", "No scenarios match the current filters.") : pick("Belum ada skenario di ruang kerja ini.", "No scenarios in this workspace yet.")}
            description={pick("Skenario menerapkan asumsi seperti perubahan harga atau promosi pada perkiraan terbit, lalu menunjukkan dampaknya.", "No scenarios match the current filters.")}
            action={can("scenario.create") ? <Link href="/scenarios/new" className={buttonVariants({ variant: "primary" })}>{pick("Buat Skenario", "Create scenario")}</Link> : undefined}
          />
        }
      />
    </PageContainer>
  );
}
