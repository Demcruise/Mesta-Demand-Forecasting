"use client";

import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { ArrowUpRight, CheckCircle2, ListChecks, Pencil, TriangleAlert, UserCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ExceptionType, ForecastException } from "@/types/domain";
import { getException, listExceptions, updateExceptions, type ExceptionRow } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useListState } from "@/hooks/use-list-state";
import { useSession } from "@/lib/session-context";
import { CATEGORIES } from "@/lib/mock/catalog";
import { USERS } from "@/lib/mock/directory";
import { formatDateTime, formatDeltaPercent, formatNumber, formatPercent, formatRelative, pluralize } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, Drawer, DrawerContent } from "@/components/ui/overlay";
import { DescriptionList, PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { FilterBar } from "@/components/tables/filter-bar";
import { SavedViewsMenu } from "@/components/tables/saved-views";
import { SeverityBadge, StatusBadge } from "@/components/feedback/status";
import { DetailSkeleton, EmptyState, ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { EntityId, ProductIdentity, UserIdentity } from "@/components/entities/identity";
import { ForecastInterval, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { Sparkline } from "@/components/charts/small-charts";
import { ActivityList } from "@/components/governance/audit";
import { OverrideDialog } from "@/features/forecast-detail/override-dialog";

export const EXCEPTION_TYPE_LABELS: Record<ExceptionType, string> = {
  large_delta: "Large forecast change",
  low_confidence: "Low confidence",
  high_error: "High forecast error",
  data_freshness: "Data freshness",
  data_quality: "Data quality",
  model_anomaly: "Model anomaly",
  manual_override: "Manual override",
  threshold_breach: "Threshold breach",
};

const RECOMMENDED: Record<ExceptionType, string[]> = {
  large_delta: ["Check for a promotion, listing change or supply event that explains the change.", "If the model is missing context, apply an override with evidence.", "If the change is expected, resolve with a note."],
  low_confidence: ["Review recent demand volatility and outliers.", "Plan safety stock against the upper bound, not the point forecast.", "Consider the intermittent-demand model for slow movers."],
  high_error: ["Compare recent forecasts with actuals in the forecast detail.", "Flag for model review if the error persists for more than 2 weeks."],
  data_freshness: ["Check the source status in Data sources.", "Treat affected forecasts with caution until the source syncs."],
  data_quality: ["Open the related data quality issue.", "Avoid overrides based on affected history until it is corrected."],
  model_anomaly: ["Flag for model review.", "Compare with the fallback model."],
  manual_override: ["Confirm the override is still valid."],
  threshold_breach: ["Review against the configured threshold."],
};

/** PAGE-EXCEPTIONS: prioritise forecast items that need human attention. */
export function ExceptionsView() {
  const { can, session } = useSession();
  const state = useListState({ filterKeys: ["severity", "status", "type", "category", "owner"], defaultSort: "severity", defaultDir: "asc" });
  const q = useApiQuery(["exceptions", state.query], (c) => listExceptions(c, state.query), { keepPrevious: true });
  const selectedId = state.getParam("id");
  const [selection, setSelection] = React.useState<RowSelectionState>({});
  const [bulk, setBulk] = React.useState<null | "resolved" | "dismissed">(null);
  const [note, setNote] = React.useState("");
  const selectedIds = Object.keys(selection).filter((k) => selection[k]);

  const bulkUpdate = useApiMutation((c, v: { status?: ForecastException["status"]; ownerId?: string | null; note?: string }) => updateExceptions(c, selectedIds, v), {
    invalidate: [["exceptions"], ["exception"], ["overview"], ["nav-counts"], ["forecast-rows"]],
    success: (r) => `${pluralize(r.length, "exception")} updated`,
    failure: "The exceptions were not updated.",
    onSuccess: (_r, v) => {
      if (v.status === "resolved") track("exception_resolved", { count: selectedIds.length });
      setSelection({});
      setBulk(null);
    },
  });

  const columns = React.useMemo<ColumnDef<ExceptionRow, unknown>[]>(
    () => [
      {
        id: "exception",
        header: "Exception",
        meta: { width: "minmax(200px, 1.4fr)", pinned: true, label: "Exception" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{EXCEPTION_TYPE_LABELS[row.original.type]}</span>
            <span className="mono-id text-fg-tertiary">{row.original.id}</span>
          </span>
        ),
      },
      { id: "severity", header: "Severity", meta: { width: "110px", sortKey: "severity" } satisfies ColumnMeta, cell: ({ row }) => <SeverityBadge severity={row.original.severity} size="sm" /> },
      { id: "entity", header: "Product", meta: { width: "minmax(240px, 2fr)", sortKey: "product" } satisfies ColumnMeta, cell: ({ row }) => <ProductIdentity product={row.original.product} /> },
      {
        id: "value",
        header: "Value",
        meta: { width: "150px", numeric: true, sortKey: "value", description: "Measured value compared with the configured threshold." } satisfies ColumnMeta,
        cell: ({ row }) => {
          const e = row.original;
          if (e.valueUnit === "%") {
            const v = e.type === "large_delta" ? formatDeltaPercent(e.value) : formatPercent(e.value, 0);
            return (
              <span className="flex flex-col items-end">
                <span className="font-semibold">{v}</span>
                <span className="text-[0.6875rem] text-fg-tertiary">threshold {formatPercent(e.threshold, 0)}</span>
              </span>
            );
          }
          return <span className="text-xs text-fg-secondary">{pluralize(e.affectedSkus, "SKU")}</span>;
        },
      },
      { id: "detected", header: "Detected", meta: { width: "120px", sortKey: "detectedAt", hideBelow: "lg" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{formatRelative(row.original.detectedAt)}</span> },
      { id: "owner", header: "Owner", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      { id: "status", header: "Status", meta: { width: "140px", sortKey: "status" } satisfies ColumnMeta, cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" /> },
    ],
    [],
  );

  const s = q.data?.summary;
  return (
    <PageContainer>
      <PageHeader title="Exceptions" description="Forecasts that need a human decision, ordered by severity. Each one explains why it was raised." />
      <MetricStrip>
        <MetricCard label="Open" value={s ? formatNumber(s.open) : "—"} context="Open, investigating or escalated" href="/planning/exceptions?status=open,investigating,escalated" hrefLabel="Show open" />
        <MetricCard label="Critical" value={s ? formatNumber(s.critical) : "—"} context="Change of 25% or more, or a blocking data issue" href="/planning/exceptions?severity=critical&status=open,investigating,escalated" hrefLabel="Show critical" />
        <MetricCard label="Unassigned" value={s ? formatNumber(s.unassigned) : "—"} context="Nobody is working on these yet" href="/planning/exceptions?owner=unassigned&status=open" hrefLabel="Show unassigned" />
        <MetricCard label="Assigned to me" value={s ? formatNumber(s.mine) : "—"} href={`/planning/exceptions?owner=${session.userId}&status=open,investigating,escalated`} hrefLabel="Show mine" />
      </MetricStrip>
      <DataTable
        label="Forecast exceptions"
        columns={columns}
        data={q.data?.page.items}
        getRowId={(r) => r.id}
        isLoading={q.isPending}
        isFetching={q.isFetching && !q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Exceptions could not be loaded."
        storageKey="exceptions"
        activeRowId={selectedId}
        onRowClick={(r) => {
          track("exception_opened", { type: r.type });
          state.setParam("id", r.id);
        }}
        selection={can("exception.update") ? { selected: selection, onChange: setSelection, isSelectable: (r) => r.status !== "resolved" && r.status !== "dismissed" } : undefined}
        bulkBar={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="body-sm font-semibold">{pluralize(selectedIds.length, "exception")} selected</span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ ownerId: session.userId })}>
                <UserCheck aria-hidden /> Assign to me
              </Button>
              <Button size="sm" variant="secondary" loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "investigating", ownerId: session.userId })}>
                Start investigating
              </Button>
              <Button size="sm" variant="primary" onClick={() => { setNote(""); setBulk("resolved"); }}>
                <CheckCircle2 aria-hidden /> Resolve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelection({})}>
                Clear
              </Button>
            </div>
          </div>
        }
        sort={{ key: state.query.sort, dir: state.query.dir, onChange: state.setSort }}
        pagination={{ page: q.data?.page.page ?? 1, pageSize: state.query.pageSize ?? 25, total: q.data?.page.total ?? 0, onPageChange: state.setPage, onPageSizeChange: state.setPageSize }}
        toolbarEnd={<SavedViewsMenu surface="exceptions" />}
        toolbarStart={
          <FilterBar
            state={state}
            searchPlaceholder="Search exception ID, product or reason"
            facets={[
              { key: "status", label: "Status", primary: true, options: ["open", "investigating", "escalated", "resolved", "dismissed"].map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })) },
              { key: "severity", label: "Severity", primary: true, options: [{ value: "critical", label: "Critical" }, { value: "warning", label: "Warning" }, { value: "info", label: "Info" }] },
              { key: "type", label: "Type", options: Object.entries(EXCEPTION_TYPE_LABELS).map(([value, label]) => ({ value, label })) },
              { key: "category", label: "Category", options: CATEGORIES.map((c) => ({ value: c, label: c })) },
              { key: "owner", label: "Owner", options: [{ value: "unassigned", label: "Unassigned" }, ...USERS.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name }))] },
            ]}
          />
        }
        empty={
          state.activeFilterCount > 0 ? (
            <EmptyState title="No exceptions match the current filters." action={<Button variant="secondary" onClick={state.clearFilters}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={ListChecks} title="No exceptions need review." description="Forecasts are within all configured thresholds." />
          )
        }
      />
      <ExceptionDrawer id={selectedId} onClose={() => state.setParam("id", null)} />
      <Dialog open={!!bulk} onOpenChange={(o) => !o && setBulk(null)}>
        <DialogContent
          size="sm"
          title={`Resolve ${pluralize(selectedIds.length, "exception")}?`}
          description="Resolved exceptions leave the queue. The note is added to each exception's activity and the audit log."
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulk(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={note.trim().length < 5} loading={bulkUpdate.isPending} onClick={() => bulkUpdate.mutate({ status: "resolved", note })}>
                Resolve {pluralize(selectedIds.length, "exception")}
              </Button>
            </>
          }
        >
          <Field label="Resolution note" htmlFor="bulk-note" required hint="At least 5 characters.">
            <Textarea id="bulk-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="e.g. Confirmed with the category team: expected after range review." />
          </Field>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

/** PAGE-EXCEPTION-DETAIL drawer: summary → why triggered → affected → forecast → history → data → actions → activity. */
function ExceptionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, session } = useSession();
  const q = useApiQuery(["exception", id], (c) => getException(c, id as string), { enabled: !!id });
  const [dialog, setDialog] = React.useState<null | "resolved" | "dismissed" | "escalated">(null);
  const [note, setNote] = React.useState("");
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const update = useApiMutation((c, v: { status?: ForecastException["status"]; ownerId?: string | null; note?: string }) => updateExceptions(c, [id as string], v), {
    invalidate: [["exceptions"], ["exception"], ["overview"], ["nav-counts"], ["forecast-rows"]],
    success: (r) => `${r[0]?.id} ${r[0]?.status}`,
    failure: "The exception was not updated.",
    onSuccess: (_r, v) => {
      if (v.status === "resolved") track("exception_resolved", { count: 1 });
      setDialog(null);
    },
  });
  const d = q.data;
  const closed = d && (d.exception.status === "resolved" || d.exception.status === "dismissed");
  return (
    <>
      <Drawer open={!!id} onOpenChange={(o) => !o && onClose()}>
        {id && (
          <DrawerContent
            size="lg"
            eyebrow={<EntityId value={id} copy={false} />}
            title={d ? EXCEPTION_TYPE_LABELS[d.exception.type] : "Exception"}
            description={d ? `${d.product.name} · ${d.product.sku}` : undefined}
            footer={
              d && can("exception.update") && !closed ? (
                <>
                  <Button variant="ghost" onClick={() => { setNote(""); setDialog("dismissed"); }}>
                    Dismiss
                  </Button>
                  {d.exception.status !== "escalated" && (
                    <Button variant="secondary" onClick={() => { setNote(""); setDialog("escalated"); }}>
                      <TriangleAlert aria-hidden /> Escalate
                    </Button>
                  )}
                  <Button variant="primary" onClick={() => { setNote(""); setDialog("resolved"); }}>
                    <CheckCircle2 aria-hidden /> Resolve
                  </Button>
                </>
              ) : undefined
            }
          >
            {q.isPending ? (
              <DetailSkeleton />
            ) : q.isError ? (
              <ErrorState compact what="This exception could not be loaded." error={q.error} onRetry={() => q.refetch()} />
            ) : d ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={d.exception.severity} />
                  <StatusBadge status={d.exception.status} />
                  <span className="caption">Detected {formatDateTime(d.exception.detectedAt)}</span>
                </div>
                <section aria-labelledby="ex-why" className="rounded-lg border border-border bg-subtle p-3.5">
                  <h3 id="ex-why" className="mb-1 card-title">
                    Why it was triggered
                  </h3>
                  <p className="body-sm text-fg">{d.exception.reason}</p>
                  {d.exception.valueUnit === "%" && (
                    <p className="mt-1 caption">
                      Measured {d.exception.type === "large_delta" ? formatDeltaPercent(d.exception.value) : formatPercent(d.exception.value, 0)} against a threshold of {formatPercent(d.exception.threshold, 0)}. Thresholds are set in Settings › Forecasting.
                    </p>
                  )}
                </section>
                <DescriptionList
                  columns={2}
                  items={[
                    { label: "Affected", value: <ProductIdentity product={d.product} href={`/forecasting/detail/${d.product.id}${d.run ? `?run=${d.run.id}` : ""}`} /> },
                    { label: "Scope", value: pluralize(d.exception.affectedSkus, "SKU") },
                    { label: "Forecast run", value: d.run ? <Link href={`/forecasting/runs/${d.run.id}`} className="mono-id text-primary hover:underline">{d.run.id}</Link> : "—" },
                    { label: "Owner", value: <UserIdentity userId={d.exception.ownerId} /> },
                  ]}
                />
                {d.row && (
                  <section aria-labelledby="ex-fc">
                    <h3 id="ex-fc" className="mb-2 card-title">
                      Relevant forecast · next {d.run?.horizonDays ?? 28} days
                    </h3>
                    <ForecastInterval lower={d.row.lowerBound} upper={d.row.upperBound} forecast={d.row.forecast} comparison={d.row.previousForecast} unit={d.product.unit} />
                    <div className="mt-3 flex items-center gap-3">
                      <Sparkline values={d.row.trend} forecastFrom={8} width={160} height={36} label={`Weekly demand trend for ${d.product.name}`} />
                      <p className="caption">
                        Historical context: 8 weeks of actuals (grey) then the forecast (blue). Actual in the prior {d.run?.horizonDays ?? 28} days: {formatNumber(d.row.actualLastPeriod)}.
                      </p>
                    </div>
                  </section>
                )}
                {d.dqIssues.length > 0 && (
                  <section aria-labelledby="ex-dq">
                    <h3 id="ex-dq" className="mb-2 card-title">
                      Data quality
                    </h3>
                    <ul className="flex flex-col gap-2">
                      {d.dqIssues.map((i) => (
                        <li key={i.id}>
                          <Link href={`/demand-data/quality?id=${i.id}`} className="flex items-start gap-3 rounded-md border border-border p-3 hover:bg-hover">
                            <SeverityBadge severity={i.severity} size="sm" />
                            <span className="min-w-0 flex-1 body-sm">{i.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="ex-rec">
                  <h3 id="ex-rec" className="mb-2 card-title">
                    Recommended actions
                  </h3>
                  <ol className="list-decimal pl-5 body-sm text-fg-secondary">
                    {RECOMMENDED[d.exception.type].map((r) => (
                      <li key={r} className="mb-1">
                        {r}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!can("exception.update") ? (
                      <PermissionNotice permission="exception.update" compact />
                    ) : (
                      !closed && (
                        <>
                          {d.exception.ownerId !== session.userId && (
                            <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ ownerId: session.userId })}>
                              <UserCheck aria-hidden /> Assign to me
                            </Button>
                          )}
                          {d.exception.status === "open" && (
                            <Button size="sm" variant="secondary" loading={update.isPending} onClick={() => update.mutate({ status: "investigating", ownerId: d.exception.ownerId ?? session.userId })}>
                              Start investigating
                            </Button>
                          )}
                          {can("forecast.override") && d.row && d.run?.status === "published" && (
                            <Button size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>
                              <Pencil aria-hidden /> Override forecast
                            </Button>
                          )}
                        </>
                      )
                    )}
                    <Link href={`/forecasting/detail/${d.product.id}${d.run ? `?run=${d.run.id}` : ""}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                      Open forecast detail <ArrowUpRight aria-hidden />
                    </Link>
                  </div>
                </section>
                {d.related.length > 0 && (
                  <section aria-labelledby="ex-rel">
                    <h3 id="ex-rel" className="mb-2 card-title">
                      Other exceptions for this product
                    </h3>
                    <ul className="flex flex-col gap-1.5">
                      {d.related.map((r) => (
                        <li key={r.id} className="flex items-center justify-between gap-2 body-sm">
                          <span>
                            <span className="mono-id mr-2">{r.id}</span>
                            {EXCEPTION_TYPE_LABELS[r.type]}
                          </span>
                          <StatusBadge status={r.status} size="sm" />
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section aria-labelledby="ex-act">
                  <h3 id="ex-act" className="mb-2 card-title">
                    Activity
                  </h3>
                  <ActivityList items={[...d.exception.activity].reverse()} />
                </section>
                {closed && <InlineAlert tone="success" title={`This exception is ${d.exception.status}.`} />}
              </div>
            ) : null}
          </DrawerContent>
        )}
      </Drawer>
      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        {dialog && d && (
          <DialogContent
            size="sm"
            title={dialog === "resolved" ? `Resolve ${d.exception.id}?` : dialog === "dismissed" ? `Dismiss ${d.exception.id}?` : `Escalate ${d.exception.id}?`}
            description={
              dialog === "resolved"
                ? "Explain what was decided so others can trust the forecast."
                : dialog === "dismissed"
                  ? "Dismissed exceptions are closed without action. Explain why none is needed."
                  : "Escalated exceptions are raised to a Manager and stay open."
            }
            footer={
              <>
                <Button variant="ghost" onClick={() => setDialog(null)}>
                  Cancel
                </Button>
                <Button variant="primary" disabled={note.trim().length < 5} loading={update.isPending} onClick={() => update.mutate({ status: dialog, note })}>
                  {dialog === "resolved" ? "Resolve exception" : dialog === "dismissed" ? "Dismiss exception" : "Escalate exception"}
                </Button>
              </>
            }
          >
            <Field label="Note" htmlFor="ex-note" required hint="Recorded in the activity and the audit log. At least 5 characters.">
              <Textarea id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            </Field>
          </DialogContent>
        )}
      </Dialog>
      {d?.row && d.run && (
        <OverrideDialog open={overrideOpen} onOpenChange={setOverrideOpen} runId={d.run.id} productIds={[d.product.id]} originalUnits={d.row.forecast} label={d.product.name} horizonDays={d.run.horizonDays} />
      )}
    </>
  );
}
