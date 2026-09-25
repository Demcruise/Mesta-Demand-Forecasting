"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { DataQualityIssue } from "@/types/domain";
import { getDataQualityIssue, listDataQuality, retryDataCheck, updateDataQualityIssue } from "@/lib/api/data";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { formatDateTime, formatNumber, formatPercent, formatRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader, PageSection } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { SeverityBadge, StatusBadge } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, PermissionNotice } from "@/components/feedback/states";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EntityId, ProductIdentity, UserIdentity } from "@/components/entities/identity";
import { MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { AuditTimeline } from "@/components/governance/audit";

const TYPE_LABELS: Record<DataQualityIssue["type"], string> = {
  missing_records: "Missing records",
  duplicate_records: "Duplicate records",
  missing_dimensions: "Missing dimensions",
  late_data: "Late data",
  unexpected_zero: "Unexpected zero demand",
  extreme_outlier: "Extreme outlier",
  schema_mismatch: "Schema mismatch",
  source_unavailable: "Source unavailable",
};

/** PAGE-DATA-QUALITY: make data readiness operationally visible. */
export function QualityView() {
  const state = useListState({ filterKeys: ["severity", "status", "source", "type"], defaultSort: "severity", defaultDir: "asc" });
  const q = useApiQuery(["dq", state.query], (c) => listDataQuality(c, state.query), { keepPrevious: true });
  const selectedId = state.getParam("id");
  const sourceName = (id: string) => q.data?.sources.find((s) => s.id === id)?.name ?? id;

  const columns = React.useMemo<ColumnDef<DataQualityIssue, unknown>[]>(
    () => [
      { id: "severity", header: "Severity", meta: { width: "120px", sortKey: "severity" } satisfies ColumnMeta, cell: ({ row }) => <SeverityBadge severity={row.original.severity} size="sm" /> },
      {
        id: "issue",
        header: "Issue",
        meta: { width: "minmax(280px, 3fr)", pinned: true, label: "Issue" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.title}</span>
            <span className="truncate text-xs text-fg-tertiary">
              {TYPE_LABELS[row.original.type]} · {row.original.id.toUpperCase().replace("_", "-")}
            </span>
          </span>
        ),
      },
      { id: "source", header: "Source", meta: { width: "minmax(150px, 1fr)", hideBelow: "md" } satisfies ColumnMeta, cell: ({ row }) => <span className="truncate text-fg-secondary">{sourceName(row.original.sourceId)}</span> },
      { id: "skus", header: "SKUs affected", meta: { width: "120px", numeric: true, sortKey: "affectedSkus" } satisfies ColumnMeta, cell: ({ row }) => formatNumber(row.original.affectedSkus) },
      { id: "detected", header: "Detected", meta: { width: "120px", sortKey: "detectedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatRelative(row.original.detectedAt)}</span> },
      { id: "owner", header: "Owner", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      { id: "status", header: "Status", meta: { width: "140px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data?.sources],
  );

  const s = q.data?.summary;
  return (
    <PageContainer>
      <PageHeader title="Data quality" description="Is the demand data ready for forecasting? Blocking issues stop forecast runs; warnings reduce accuracy." />
      <MetricStrip>
        <MetricCard label="Blocking issues" value={s ? formatNumber(s.blocking) : "—"} context={s?.blocking ? "Runs covering affected SKUs fail validation." : "No blocking issues."} href="/demand-data/quality?severity=blocking" hrefLabel="Show blocking" />
        <MetricCard label="Warnings" value={s ? formatNumber(s.warnings) : "—"} context="May reduce forecast accuracy." href="/demand-data/quality?severity=warning&status=open,investigating" hrefLabel="Show warnings" />
        <MetricCard label="Coverage" value={s ? formatPercent(s.coverage) : "—"} context={s ? `Share of ${formatNumber(s.skus)} SKUs without open issues (estimate)` : undefined} tooltip="Estimated share of SKU-days in the last 28 days that pass all checks." />
        <MetricCard label="Sources with problems" value={q.data ? formatNumber(q.data.sources.filter((x) => x.status === "failed" || x.status === "warning").length) : "—"} context={q.data ? `of ${q.data.sources.length} sources` : undefined} href="/demand-data/sources" hrefLabel="View sources" />
      </MetricStrip>
      {q.data && (
        <PageSection title="Source freshness" description="Freshness determines whether today's forecasts use today's data.">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {q.data.sources.map((src) => (
              <li key={src.id}>
                <Link href={`/demand-data/sources?id=${src.id}`} className="flex h-full flex-col gap-1.5 rounded-lg border border-border bg-surface p-3 hover:border-border-strong">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate body-sm font-semibold">{src.name}</span>
                    <StatusBadge status={src.status} size="sm" />
                  </span>
                  <FreshnessIndicator timestamp={src.lastSuccessAt} label="Last success" source={src.name} />
                </Link>
              </li>
            ))}
          </ul>
        </PageSection>
      )}
      <DataTable
        label="Data quality issues"
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Data quality issues could not be loaded."
        storageKey="dq"
        activeRowId={selectedId}
        onRowClick={(r) => state.setParam("id", r.id)}
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Search issues"
            facets={[
              { key: "severity", label: "Severity", primary: true, options: [{ value: "blocking", label: "Blocking" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }] },
              { key: "status", label: "Status", primary: true, options: ["open", "investigating", "resolved", "dismissed"].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
              { key: "source", label: "Source", options: (q.data?.sources ?? []).map((x) => ({ value: x.id, label: x.name })) },
              { key: "type", label: "Issue type", options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })) },
            ]}
          />
        }
        empty={
          state.activeFilterCount > 0 ? (
            <EmptyState title="No data quality issues match the current filters." action={<Button variant="secondary" onClick={state.clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={ShieldCheck} title="No data quality issues have been detected." description="All checks pass. New issues appear here as soon as a check fails." />
          )
        }
      />
      <IssueDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
    </PageContainer>
  );
}

function IssueDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, session } = useSession();
  const q = useApiQuery(["dq-issue", id], (c) => getDataQualityIssue(c, id as string), { enabled: !!id });
  const [resolve, setResolve] = React.useState<null | "resolved" | "dismissed">(null);
  const [note, setNote] = React.useState("");
  const invalidate = [["dq"], ["dq-issue"], ["overview"], ["nav-counts"]] as const;
  const update = useApiMutation((c, v: { status?: DataQualityIssue["status"]; ownerId?: string | null; note?: string }) => updateDataQualityIssue(c, id as string, v), {
    invalidate,
    success: (i) => `${i.title}: ${i.status}`,
    failure: "The issue was not updated.",
    onSuccess: () => setResolve(null),
  });
  const retry = useApiMutation((c, _v: void) => retryDataCheck(c, id as string), {
    invalidate,
    success: "Check re-run: the issue is still present.",
    successDescription: "The data has not changed at the source. Follow the recommended action.",
    failure: "The check could not be re-run.",
  });
  const d = q.data;
  const closed = d && (d.issue.status === "resolved" || d.issue.status === "dismissed");
  return (
    <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <DrawerContent
          size="md"
          eyebrow={<EntityId value={id.toUpperCase().replace("_", "-")} copy={false} />}
          title={d?.issue.title ?? "Data quality issue"}
          footer={
            d && can("data.manage") && !closed ? (
              <>
                <Button variant="ghost" onClick={() => retry.mutate()} loading={retry.isPending}>
                  <RefreshCw aria-hidden /> Retry check
                </Button>
                <Button variant="secondary" onClick={() => { setNote(""); setResolve("dismissed"); }}>
                  Dismiss
                </Button>
                <Button variant="primary" onClick={() => { setNote(""); setResolve("resolved"); }}>
                  <CheckCircle2 aria-hidden /> Mark resolved
                </Button>
              </>
            ) : undefined
          }
        >
          {q.isPending ? (
            <DetailSkeleton />
          ) : q.isError ? (
            <ErrorState compact what="This issue could not be loaded." error={q.error} onRetry={() => q.refetch()} />
          ) : d ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={d.issue.severity} />
                <StatusBadge status={d.issue.status} />
              </div>
              <section>
                <h3 className="mb-1 card-title">What happened?</h3>
                <p className="body-sm text-fg-secondary">{d.issue.description}</p>
              </section>
              <DescriptionList
                columns={2}
                items={[
                  { label: "Affected scope", value: `${formatNumber(d.issue.affectedSkus)} SKUs · ${formatNumber(d.issue.affectedLocations)} locations` },
                  { label: "Detected", value: formatDateTime(d.issue.detectedAt) },
                  { label: "Source", value: d.source ? <Link href={`/demand-data/sources?id=${d.source.id}`} className="text-primary hover:underline">{d.source.name}</Link> : "—" },
                  { label: "Owner", value: <UserIdentity userId={d.issue.ownerId} /> },
                ]}
              />
              <section className="rounded-lg border border-border bg-subtle p-3.5">
                <h3 className="mb-1 card-title">Forecast impact</h3>
                <p className="body-sm text-fg-secondary">{d.issue.forecastImpact}</p>
                <h3 className="mb-1 mt-3 card-title">Recommended action</h3>
                <p className="body-sm text-fg-secondary">{d.issue.recommendedAction}</p>
              </section>
              {!can("data.manage") ? (
                <PermissionNotice permission="data.manage" compact />
              ) : (
                !closed && (
                  <div className="flex flex-wrap gap-2">
                    {d.issue.ownerId !== session.userId && (
                      <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ ownerId: session.userId })}>
                        <UserCheck aria-hidden /> Assign to me
                      </Button>
                    )}
                    {d.issue.status === "open" && (
                      <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: "investigating", ownerId: d.issue.ownerId ?? session.userId })}>
                        Start investigating
                      </Button>
                    )}
                  </div>
                )
              )}
              {d.products.length > 0 && (
                <section>
                  <h3 className="mb-2 card-title">Sample of affected products</h3>
                  <ul className="flex flex-col gap-2">
                    {d.products.slice(0, 6).map((p) => (
                      <li key={p.id}>
                        <ProductIdentity product={p} href={`/forecasting/detail/${p.id}`} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section>
                <h3 className="mb-2 card-title">Activity</h3>
                <AuditTimeline events={d.activity} emptyText={`No actions yet. Detected ${formatRelative(d.issue.detectedAt)} by automated checks; owner ${actorName(d.issue.ownerId)}.`} />
              </section>
            </div>
          ) : null}
        </DrawerContent>
      )}
      <Dialog open={!!resolve} onOpenChange={(o) => !o && setResolve(null)}>
        {resolve && d && (
          <DialogContent
            size="sm"
            title={resolve === "resolved" ? "Mark this issue resolved?" : "Dismiss this issue?"}
            description={resolve === "resolved" ? "Resolved issues stop blocking validation. Explain how it was fixed." : "Dismissed issues are closed without a fix. Explain why no action is needed."}
            footer={
              <>
                <Button variant="ghost" onClick={() => setResolve(null)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={note.trim().length < 5} loading={update.isPending} onClick={() => update.mutate({ status: resolve, note })}>
                  {resolve === "resolved" ? "Mark resolved" : "Dismiss issue"}
                </Button>
              </>
            }
          >
            <Field label="Note" htmlFor="dq-note" required hint="Recorded in the audit log. At least 5 characters.">
              <Textarea id="dq-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </Drawer>
  );
}
